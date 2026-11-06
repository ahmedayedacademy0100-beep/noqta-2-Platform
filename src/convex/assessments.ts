import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  ERROR_CODES,
  assertAssessmentOwner,
  assertClassAccess,
  classIdsForTeacher,
  deny,
  logAudit,
  requireProfile,
  requireRole,
} from "./lib/guards";
import { notifyMany, notifyUser } from "./lib/notify";
import { snapshotFromQuestion, totalMarks } from "./lib/snapshot";
import { bilingualPair, hasBilingualContent } from "./lib/bilingual";
import {
  questionInput,
  validateQuestion,
  normalizeQuestion,
} from "./questionBank";
import {
  assessmentKindValidator,
  assessmentStatusValidator,
  ROLES,
  releasePolicyValidator,
} from "./schema";

const STAFF = [ROLES.TEACHER, ROLES.SUPER_ADMIN] as const;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function rowsForVersion(
  ctx: QueryCtx,
  assessmentId: Id<"assessments">,
  version: number,
): Promise<Doc<"assessment_questions">[]> {
  const rows = await ctx.db
    .query("assessment_questions")
    .withIndex("by_assessment_version", (q) =>
      q.eq("assessmentId", assessmentId).eq("version", version),
    )
    .collect();
  return rows.sort((a, b) => a.order - b.order);
}

async function recomputeMaxScore(
  ctx: MutationCtx,
  assessmentId: Id<"assessments">,
  version: number,
): Promise<number> {
  const rows = await rowsForVersion(ctx, assessmentId, version);
  const maxScore = totalMarks(rows);
  await ctx.db.patch(assessmentId, { maxScore, updatedAt: Date.now() });
  return maxScore;
}

/**
 * Once an assessment has attempts, its question set is frozen. Any further
 * structural edit is written as a *new version* so historical attempts (which
 * pin the version they started) never change wording, options or marks.
 */
async function ensureEditableVersion(
  ctx: MutationCtx,
  assessment: Doc<"assessments">,
): Promise<number> {
  const attempt = await ctx.db
    .query("attempts")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessment._id))
    .first();
  if (assessment.status === "draft" || !attempt) return assessment.version;
  const nextVersion = assessment.version + 1;
  const rows = await rowsForVersion(ctx, assessment._id, assessment.version);
  for (const row of rows) {
    await ctx.db.insert("assessment_questions", {
      assessmentId: assessment._id,
      questionId: row.questionId,
      order: row.order,
      marks: row.marks,
      version: nextVersion,
      snapshot: row.snapshot,
    });
  }
  await ctx.db.patch(assessment._id, {
    version: nextVersion,
    updatedAt: Date.now(),
  });
  return nextVersion;
}

export async function assignedStudentIds(
  ctx: QueryCtx,
  assessmentId: Id<"assessments">,
): Promise<Id<"users">[]> {
  const ids = new Set<string>();
  const direct = await ctx.db
    .query("assessment_students")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  for (const row of direct) ids.add(row.studentId as string);
  const classAssignments = await ctx.db
    .query("assessment_assignments")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  for (const assignment of classAssignments) {
    const enrollments = await ctx.db
      .query("class_enrollments")
      .withIndex("by_class", (q) => q.eq("classId", assignment.classId))
      .collect();
    for (const enrollment of enrollments) {
      if (enrollment.status === "active") ids.add(enrollment.studentId as string);
    }
  }
  return [...ids] as Id<"users">[];
}

/* -------------------------------------------------------------------------- */
/* Teacher: list + detail                                                     */
/* -------------------------------------------------------------------------- */

export const list = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(assessmentStatusValidator),
    kind: v.optional(assessmentKindValidator),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const all = await ctx.db.query("assessments").collect();
    const mine =
      profile.role === ROLES.SUPER_ADMIN
        ? all
        : all.filter((a) => a.ownerId === userId);
    const subjects = await ctx.db.query("subjects").collect();
    const search = args.search?.trim().toLowerCase();
    const filtered = mine
      .filter((a) => (args.status ? a.status === args.status : true))
      .filter((a) => (args.kind ? a.kind === args.kind : true))
      .filter((a) =>
        search
          ? a.titleEn.toLowerCase().includes(search) || a.titleAr.includes(search)
          : true,
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const rows = await Promise.all(
      filtered.map(async (assessment) => {
        const attempts = await ctx.db
          .query("attempts")
          .withIndex("by_assessment", (q) => q.eq("assessmentId", assessment._id))
          .collect();
        const assigned = await assignedStudentIds(ctx, assessment._id);
        const questionCount = (
          await rowsForVersion(ctx, assessment._id, assessment.version)
        ).length;
        const graded = attempts.filter((a) => a.status === "graded");
        return {
          _id: assessment._id,
          titleEn: assessment.titleEn,
          titleAr: assessment.titleAr,
          kind: assessment.kind,
          status: assessment.status,
          subjectNameEn:
            subjects.find((s) => s._id === assessment.subjectId)?.nameEn ?? "—",
          subjectNameAr:
            subjects.find((s) => s._id === assessment.subjectId)?.nameAr ?? "—",
          maxScore: assessment.maxScore,
          questionCount,
          version: assessment.version,
          openAt: assessment.openAt,
          closeAt: assessment.closeAt,
          durationMinutes: assessment.durationMinutes,
          releasePolicy: assessment.releasePolicy,
          resultsReleasedAt: assessment.resultsReleasedAt,
          assignedStudents: assigned.length,
          attempts: attempts.length,
          submissions: attempts.filter((a) => a.submittedAt).length,
          awaitingGrading: attempts.filter((a) => a.pendingManualCount > 0)
            .length,
          averagePercent:
            graded.length === 0
              ? null
              : Math.round(
                  (graded.reduce((sum, a) => sum + a.percentage, 0) /
                    graded.length) *
                    100,
                ) / 100,
          createdAt: assessment.createdAt,
          updatedAt: assessment.updatedAt,
        };
      }),
    );
    return rows;
  },
});

export const detail = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const assessment = await assertAssessmentOwner(ctx, profile, args.assessmentId);
    const rows = await rowsForVersion(ctx, args.assessmentId, assessment.version);
    const questions = rows.map((row) => ({
      _id: row._id,
      questionId: row.questionId,
      order: row.order,
      marks: row.marks,
      version: row.version,
      snapshot: row.snapshot,
    }));
    const classAssignments = await ctx.db
      .query("assessment_assignments")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();
    const classes = await Promise.all(
      classAssignments.map(async (assignment) => {
        const cls = await ctx.db.get(assignment.classId);
        const enrollments = await ctx.db
          .query("class_enrollments")
          .withIndex("by_class", (q) => q.eq("classId", assignment.classId))
          .collect();
        return {
          assignmentId: assignment._id,
          classId: assignment.classId,
          nameEn: cls?.nameEn ?? "—",
          nameAr: cls?.nameAr ?? "—",
          studentCount: enrollments.filter((e) => e.status === "active").length,
        };
      }),
    );
    const individual = await ctx.db
      .query("assessment_students")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();
    const students = await Promise.all(
      individual.map(async (row) => {
        const studentProfile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", row.studentId))
          .first();
        return {
          studentId: row.studentId,
          name: studentProfile?.name ?? "—",
          email: studentProfile?.email ?? "",
        };
      }),
    );
    const subject = await ctx.db.get(assessment.subjectId);
    const topic = assessment.topicId ? await ctx.db.get(assessment.topicId) : null;
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();
    return {
      assessment: {
        ...assessment,
        subjectNameEn: subject?.nameEn ?? "—",
        subjectNameAr: subject?.nameAr ?? "—",
        topicNameEn: topic?.nameEn,
        topicNameAr: topic?.nameAr,
      },
      questions,
      classes,
      students,
      assignedCount: (await assignedStudentIds(ctx, args.assessmentId)).length,
      attemptsCount: attempts.length,
      submissionsCount: attempts.filter((a) => a.submittedAt).length,
    };
  },
});

/** Classes the caller may assign to (teacher: their own classes). */
export const assignableClasses = query({
  args: {},
  handler: async (ctx) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const all = await ctx.db.query("classes").collect();
    let visible = all.filter((c) => c.archivedAt === undefined);
    if (profile.role === ROLES.TEACHER) {
      const allowed = await classIdsForTeacher(ctx, userId);
      visible = visible.filter((c) => allowed.has(c._id as string));
    }
    return await Promise.all(
      visible.map(async (cls) => {
        const enrollments = await ctx.db
          .query("class_enrollments")
          .withIndex("by_class", (q) => q.eq("classId", cls._id))
          .collect();
        return {
          _id: cls._id,
          nameEn: cls.nameEn,
          nameAr: cls.nameAr,
          studentCount: enrollments.filter((e) => e.status === "active").length,
        };
      }),
    );
  },
});

/* -------------------------------------------------------------------------- */
/* Teacher: create / edit / lifecycle                                         */
/* -------------------------------------------------------------------------- */

const settingsArgs = {
  titleEn: v.string(),
  titleAr: v.string(),
  instructionsEn: v.optional(v.string()),
  instructionsAr: v.optional(v.string()),
  subjectId: v.id("subjects"),
  topicId: v.optional(v.id("topics")),
  durationMinutes: v.number(),
  attemptsAllowed: v.number(),
  passThreshold: v.number(),
  shuffleQuestions: v.boolean(),
  shuffleOptions: v.boolean(),
  allowLate: v.boolean(),
  releasePolicy: releasePolicyValidator,
  showAnswersToStudents: v.boolean(),
  openAt: v.optional(v.number()),
  closeAt: v.optional(v.number()),
};

function validateSettings(args: {
  titleEn: string;
  titleAr: string;
  durationMinutes: number;
  attemptsAllowed: number;
  passThreshold: number;
  openAt?: number;
  closeAt?: number;
  releasePolicy: "immediate" | "manual" | "on_close";
}) {
  // A title may be written in one language only; the filled side is mirrored.
  if (!hasBilingualContent(args.titleEn, args.titleAr, 3)) {
    deny(
      ERROR_CODES.INVALID,
      "Give the assessment a title (in any language).",
      "أدخل عنواناً للتقييم (بأي لغة).",
    );
  }
  if (args.durationMinutes < 1 || args.durationMinutes > 600) {
    deny(ERROR_CODES.INVALID, "Duration must be 1–600 minutes.", "المدة يجب أن تكون بين ١ و٦٠٠ دقيقة.");
  }
  if (args.attemptsAllowed < 1 || args.attemptsAllowed > 10) {
    deny(ERROR_CODES.INVALID, "Attempts allowed must be 1–10.", "عدد المحاولات يجب أن يكون بين ١ و١٠.");
  }
  if (args.passThreshold < 0 || args.passThreshold > 100) {
    deny(ERROR_CODES.INVALID, "Pass threshold must be 0–100.", "نسبة النجاح يجب أن تكون بين ٠ و١٠٠.");
  }
  if (args.openAt && args.closeAt && args.closeAt <= args.openAt) {
    deny(
      ERROR_CODES.INVALID,
      "The deadline must be after the opening time.",
      "يجب أن يكون الموعد النهائي بعد وقت الفتح.",
    );
  }
}

export const create = mutation({
  args: {
    kind: assessmentKindValidator,
    ...settingsArgs,
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    validateSettings(args);
    const subject = await ctx.db.get(args.subjectId);
    if (!subject) deny(ERROR_CODES.NOT_FOUND, "Subject not found.", "لم يتم العثور على المادة.");
    const now = Date.now();
    const title = bilingualPair(args.titleEn, args.titleAr);
    const instructions =
      args.instructionsEn?.trim() || args.instructionsAr?.trim()
        ? bilingualPair(args.instructionsEn, args.instructionsAr)
        : { en: undefined, ar: undefined };
    const id = await ctx.db.insert("assessments", {
      ownerId: userId,
      kind: args.kind,
      titleEn: title.en,
      titleAr: title.ar,
      instructionsEn: instructions.en,
      instructionsAr: instructions.ar,
      subjectId: args.subjectId,
      topicId: args.topicId,
      status: "draft",
      openAt: args.openAt,
      closeAt: args.closeAt,
      durationMinutes: args.durationMinutes,
      attemptsAllowed: args.attemptsAllowed,
      passThreshold: args.passThreshold,
      shuffleQuestions: args.shuffleQuestions,
      shuffleOptions: args.shuffleOptions,
      allowLate: args.allowLate,
      releasePolicy: args.releasePolicy,
      showAnswersToStudents: args.showAnswersToStudents,
      maxScore: 0,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "assessment.create",
      entity: "assessments",
      entityId: id as string,
      summaryEn: `Created ${args.kind} "${args.titleEn}".`,
      summaryAr: `تم إنشاء ${args.kind} "${args.titleAr}".`,
    });
    return { id };
  },
});

export const update = mutation({
  args: {
    assessmentId: v.id("assessments"),
    kind: v.optional(assessmentKindValidator),
    ...settingsArgs,
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const assessment = await assertAssessmentOwner(ctx, profile, args.assessmentId);
    if (assessment.status === "archived") {
      deny(
        ERROR_CODES.CLOSED,
        "Restore the assessment before editing it.",
        "أعد التقييم من الأرشيف قبل تعديله.",
      );
    }
    validateSettings(args);
    const title = bilingualPair(args.titleEn, args.titleAr);
    const instructions =
      args.instructionsEn?.trim() || args.instructionsAr?.trim()
        ? bilingualPair(args.instructionsEn, args.instructionsAr)
        : { en: undefined, ar: undefined };
    await ctx.db.patch(args.assessmentId, {
      kind: args.kind ?? assessment.kind,
      titleEn: title.en,
      titleAr: title.ar,
      instructionsEn: instructions.en,
      instructionsAr: instructions.ar,
      subjectId: args.subjectId,
      topicId: args.topicId,
      durationMinutes: args.durationMinutes,
      attemptsAllowed: args.attemptsAllowed,
      passThreshold: args.passThreshold,
      shuffleQuestions: args.shuffleQuestions,
      shuffleOptions: args.shuffleOptions,
      allowLate: args.allowLate,
      releasePolicy: args.releasePolicy,
      showAnswersToStudents: args.showAnswersToStudents,
      openAt: args.openAt,
      closeAt: args.closeAt,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "assessment.update",
      entity: "assessments",
      entityId: args.assessmentId as string,
      summaryEn: `Updated settings of "${assessment.titleEn}".`,
      summaryAr: `تم تحديث إعدادات "${assessment.titleAr}".`,
      details: { releasePolicy: args.releasePolicy, durationMinutes: args.durationMinutes },
    });
    return { ok: true };
  },
});

export const addQuestions = mutation({
  args: {
    assessmentId: v.id("assessments"),
    items: v.array(
      v.object({
        questionId: v.id("questions"),
        marks: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const assessment = await assertAssessmentOwner(ctx, profile, args.assessmentId);
    if (assessment.status === "archived") {
      deny(ERROR_CODES.CLOSED, "Restore the assessment first.", "أعد التقييم من الأرشيف أولاً.");
    }
    if (args.items.length === 0) {
      deny(ERROR_CODES.INVALID, "Select at least one question.", "اختر سؤالاً واحداً على الأقل.");
    }
    const version = await ensureEditableVersion(ctx, assessment);
    const existing = await rowsForVersion(ctx, assessment._id, version);
    let order = existing.length;
    const added: string[] = [];
    for (const item of args.items) {
      const question = await ctx.db.get(item.questionId);
      if (!question) {
        deny(ERROR_CODES.NOT_FOUND, "Question not found.", "لم يتم العثور على السؤال.");
      }
      const bank = await ctx.db.get(question.bankId);
      if (!bank) deny(ERROR_CODES.NOT_FOUND, "Bank not found.", "لم يتم العثور على البنك.");
      if (
        bank.ownerId !== userId &&
        bank.visibility === "private" &&
        profile.role !== ROLES.SUPER_ADMIN
      ) {
        deny(
          ERROR_CODES.FORBIDDEN,
          "You cannot use questions from another teacher's private bank.",
          "لا يمكنك استخدام أسئلة من بنك خاص بمعلّم آخر.",
        );
      }
      const topic = question.topicId ? await ctx.db.get(question.topicId) : null;
      const marks = item.marks ?? question.defaultMarks;
      if (marks <= 0 || marks > 100) {
        deny(ERROR_CODES.INVALID, "Marks must be 1–100 per question.", "الدرجة يجب أن تكون بين ١ و١٠٠ لكل سؤال.");
      }
      const rowId = await ctx.db.insert("assessment_questions", {
        assessmentId: assessment._id,
        questionId: question._id,
        order,
        marks,
        version,
        snapshot: snapshotFromQuestion(question, topic),
      });
      added.push(rowId as string);
      order += 1;
    }
    const maxScore = await recomputeMaxScore(ctx, assessment._id, version);
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "assessment.questions_add",
      entity: "assessments",
      entityId: args.assessmentId as string,
      summaryEn: `Added ${added.length} question(s) to "${assessment.titleEn}" (version ${version}).`,
      summaryAr: `تمت إضافة ${added.length} سؤالاً إلى "${assessment.titleAr}" (النسخة ${version}).`,
    });
    return { version, maxScore, added: added.length };
  },
});

/**
 * Authoring questions straight inside a quiz / exam / homework.
 *
 * The teacher does not have to visit the question bank first: each draft is
 * written into their private "Direct questions" bank (created on demand) and
 * attached to the assessment in the same call, so several questions can be
 * added to the same assessment in one go. Drafts may be written in a single
 * language — the filled side is mirrored into the other one.
 */
export const createAndAddQuestions = mutation({
  args: {
    assessmentId: v.id("assessments"),
    items: v.array(
      v.object({
        ...questionInput,
        marks: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const assessment = await assertAssessmentOwner(ctx, profile, args.assessmentId);
    if (assessment.status === "archived") {
      deny(ERROR_CODES.CLOSED, "Restore the assessment first.", "أعد التقييم من الأرشيف أولاً.");
    }
    if (args.items.length === 0) {
      deny(ERROR_CODES.INVALID, "Add at least one question.", "أضف سؤالاً واحداً على الأقل.");
    }
    if (args.items.length > 50) {
      deny(
        ERROR_CODES.INVALID,
        "Add up to 50 questions at a time.",
        "يمكن إضافة ٥٠ سؤالاً كحد أقصى في المرة.",
      );
    }
    for (const item of args.items) {
      const error = validateQuestion(item);
      if (error) {
        deny(ERROR_CODES.INVALID, `Invalid question: ${error}`, `سؤال غير صالح: ${error}`);
      }
    }

    // Questions always live in a bank; reuse (or create) this teacher's own
    // private bank so direct authoring never leaks into a shared one.
    let bank = await ctx.db
      .query("question_banks")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .filter((q) => q.eq(q.field("name"), "Direct questions"))
      .first();
    if (!bank) {
      const bankId = await ctx.db.insert("question_banks", {
        ownerId: userId,
        name: "Direct questions",
        visibility: "private",
        subjectId: assessment.subjectId,
        createdAt: Date.now(),
      });
      bank = await ctx.db.get(bankId);
    }
    if (!bank) {
      deny(ERROR_CODES.CONFLICT, "Could not open a question bank.", "تعذّر فتح بنك الأسئلة.");
    }

    const version = await ensureEditableVersion(ctx, assessment);
    const existing = await rowsForVersion(ctx, assessment._id, version);
    let order = existing.length;
    const created: string[] = [];
    const now = Date.now();

    for (const item of args.items) {
      const marks = item.marks ?? item.defaultMarks;
      if (marks <= 0 || marks > 100) {
        deny(ERROR_CODES.INVALID, "Marks must be 1–100 per question.", "الدرجة يجب أن تكون بين ١ و١٠٠ لكل سؤال.");
      }
      const normalized = normalizeQuestion(item);
      const topic = item.topicId ? await ctx.db.get(item.topicId) : null;
      const questionId = await ctx.db.insert("questions", {
        bankId: bank._id,
        ownerId: userId,
        type: item.type,
        promptEn: normalized.promptEn,
        promptAr: normalized.promptAr,
        instructionsEn: normalized.instructionsEn,
        instructionsAr: normalized.instructionsAr,
        imageUrl: item.imageUrl,
        subjectId: item.subjectId ?? assessment.subjectId,
        topicId: item.topicId,
        difficulty: item.difficulty,
        defaultMarks: item.defaultMarks,
        options: normalized.options,
        acceptedAnswers: item.acceptedAnswers,
        gradingMode: item.gradingMode,
        feedbackEn: normalized.feedbackEn,
        feedbackAr: normalized.feedbackAr,
        createdAt: now,
        updatedAt: now,
      });
      const question = await ctx.db.get(questionId);
      if (!question) continue;
      await ctx.db.insert("assessment_questions", {
        assessmentId: assessment._id,
        questionId,
        order,
        marks,
        version,
        snapshot: snapshotFromQuestion(question, topic),
      });
      created.push(questionId as string);
      order += 1;
    }

    const maxScore = await recomputeMaxScore(ctx, assessment._id, version);
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "assessment.questions_create_inline",
      entity: "assessments",
      entityId: args.assessmentId as string,
      summaryEn: `Wrote and added ${created.length} question(s) to "${assessment.titleEn}" (version ${version}).`,
      summaryAr: `تمت كتابة وإضافة ${created.length} سؤالاً إلى "${assessment.titleAr}" (النسخة ${version}).`,
    });
    return { version, maxScore, added: created.length };
  },
});

export const updateQuestionMarks = mutation({
  args: {
    assessmentQuestionId: v.id("assessment_questions"),
    marks: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const row = await ctx.db.get(args.assessmentQuestionId);
    if (!row) deny(ERROR_CODES.NOT_FOUND, "Question not found.", "لم يتم العثور على السؤال.");
    const assessment = await assertAssessmentOwner(ctx, profile, row.assessmentId);
    if (args.marks <= 0 || args.marks > 100) {
      deny(ERROR_CODES.INVALID, "Marks must be 1–100.", "الدرجة يجب أن تكون بين ١ و١٠٠.");
    }
    const version = await ensureEditableVersion(ctx, assessment);
    if (version === assessment.version) {
      await ctx.db.patch(row._id, { marks: args.marks });
    } else {
      const rows = await rowsForVersion(ctx, assessment._id, version);
      const target = rows.find((r) => r.order === row.order);
      if (target) await ctx.db.patch(target._id, { marks: args.marks });
    }
    const maxScore = await recomputeMaxScore(ctx, assessment._id, version);
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "assessment.marks_update",
      entity: "assessments",
      entityId: assessment._id as string,
      summaryEn: `Changed a question's marks in "${assessment.titleEn}".`,
      summaryAr: `تم تغيير درجة سؤال في "${assessment.titleAr}".`,
      details: { previous: row.marks, next: args.marks, version },
    });
    return { version, maxScore };
  },
});

export const removeQuestion = mutation({
  args: { assessmentQuestionId: v.id("assessment_questions") },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const row = await ctx.db.get(args.assessmentQuestionId);
    if (!row) deny(ERROR_CODES.NOT_FOUND, "Question not found.", "لم يتم العثور على السؤال.");
    const assessment = await assertAssessmentOwner(ctx, profile, row.assessmentId);
    const version = await ensureEditableVersion(ctx, assessment);
    const rows = await rowsForVersion(ctx, assessment._id, version);
    const target =
      version === assessment.version
        ? row
        : rows.find((r) => r.order === row.order);
    if (!target) {
      deny(ERROR_CODES.NOT_FOUND, "Question not found in the current version.", "لم يتم العثور على السؤال في النسخة الحالية.");
    }
    const answered = await ctx.db
      .query("attempt_answers")
      .withIndex("by_question", (q) =>
        q.eq("assessmentQuestionId", target._id),
      )
      .first();
    if (answered) {
      deny(
        ERROR_CODES.CONFLICT,
        "This question has student answers recorded against it and cannot be removed.",
        "هذا السؤال مرتبط بإجابات طلاب ولا يمكن حذفه.",
      );
    }
    await ctx.db.delete(target._id);
    const remaining = await rowsForVersion(ctx, assessment._id, version);
    for (const [index, item] of remaining.entries()) {
      if (item.order !== index) await ctx.db.patch(item._id, { order: index });
    }
    const maxScore = await recomputeMaxScore(ctx, assessment._id, version);
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "assessment.question_remove",
      entity: "assessments",
      entityId: assessment._id as string,
      summaryEn: `Removed a question from "${assessment.titleEn}".`,
      summaryAr: `تم حذف سؤال من "${assessment.titleAr}".`,
      details: { version },
    });
    return { version, maxScore };
  },
});

export const reorderQuestions = mutation({
  args: {
    assessmentId: v.id("assessments"),
    orderedIds: v.array(v.id("assessment_questions")),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const assessment = await assertAssessmentOwner(ctx, profile, args.assessmentId);
    const version = await ensureEditableVersion(ctx, assessment);
    const rows = await rowsForVersion(ctx, assessment._id, version);
    const byOrder = new Map(rows.map((r) => [r.order, r]));
    for (const [index, id] of args.orderedIds.entries()) {
      const current = byOrder.get(index);
      if (!current) continue;
      const desired = rows.find((r) => r._id === id);
      if (!desired) continue;
      await ctx.db.patch(current._id, { order: 1000 + index });
    }
    for (const [index, id] of args.orderedIds.entries()) {
      const desired = rows.find((r) => r._id === id);
      if (desired) await ctx.db.patch(desired._id, { order: index });
    }
    await ctx.db.patch(assessment._id, { updatedAt: Date.now() });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "assessment.reorder",
      entity: "assessments",
      entityId: args.assessmentId as string,
      summaryEn: `Reordered questions in "${assessment.titleEn}".`,
      summaryAr: `تمت إعادة ترتيب أسئلة "${assessment.titleAr}".`,
    });
    return { version };
  },
});

export const publish = mutation({
  args: {
    assessmentId: v.id("assessments"),
    schedule: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const assessment = await assertAssessmentOwner(ctx, profile, args.assessmentId);
    const rows = await rowsForVersion(ctx, assessment._id, assessment.version);
    if (rows.length === 0) {
      deny(
        ERROR_CODES.INVALID,
        "Add at least one question before publishing.",
        "أضف سؤالاً واحداً على الأقل قبل النشر.",
      );
    }
    const assigned = await assignedStudentIds(ctx, assessment._id);
    if (assigned.length === 0) {
      deny(
        ERROR_CODES.INVALID,
        "Assign the assessment to a class or to individual students before publishing.",
        "أسند التقييم إلى صف أو إلى طلاب محددين قبل النشر.",
      );
    }
    const totalMarksValue = totalMarks(rows);
    if (totalMarksValue <= 0) {
      deny(ERROR_CODES.INVALID, "Total marks must be greater than zero.", "مجموع الدرجات يجب أن يكون أكبر من صفر.");
    }
    const now = Date.now();
    const scheduled =
      args.schedule && assessment.openAt !== undefined && assessment.openAt > now;
    await ctx.db.patch(args.assessmentId, {
      status: scheduled ? "scheduled" : "published",
      publishedAt: assessment.publishedAt ?? now,
      maxScore: totalMarksValue,
      updatedAt: now,
    });
    await notifyMany(ctx, assigned, {
      type: "assignment",
      titleEn: `${assessment.kind === "homework" ? "New homework" : "New assessment"}: ${assessment.titleEn}`,
      titleAr: `${assessment.kind === "homework" ? "واجب جديد" : "تقييم جديد"}: ${assessment.titleAr}`,
      bodyEn: scheduled
        ? "It opens automatically at the scheduled time."
        : "It is open now. Check the deadline before you start.",
      bodyAr: scheduled
        ? "سيفتح تلقائياً في الوقت المحدد."
        : "متاح الآن. تحقق من الموعد النهائي قبل البدء.",
      link: `/assessments/${args.assessmentId}`,
    });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: scheduled ? "assessment.schedule" : "assessment.publish",
      entity: "assessments",
      entityId: args.assessmentId as string,
      summaryEn: `${scheduled ? "Scheduled" : "Published"} "${assessment.titleEn}" for ${assigned.length} student(s).`,
      summaryAr: `${scheduled ? "تم جدولة" : "تم نشر"} "${assessment.titleAr}" لـ ${assigned.length} طالباً.`,
    });
    return { ok: true, assigned: assigned.length, maxScore: totalMarksValue };
  },
});

export const setStatus = mutation({
  args: {
    assessmentId: v.id("assessments"),
    status: v.union(
      v.literal("draft"),
      v.literal("closed"),
      v.literal("archived"),
      v.literal("published"),
    ),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const assessment = await assertAssessmentOwner(ctx, profile, args.assessmentId);
    const now = Date.now();
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };
    if (args.status === "closed") patch.closedAt = now;
    if (args.status === "archived") patch.archivedAt = now;
    if (args.status === "published") patch.archivedAt = undefined;
    if (args.status === "draft") {
      const attempts = await ctx.db
        .query("attempts")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
        .first();
      if (attempts) {
        deny(
          ERROR_CODES.CONFLICT,
          "This assessment already has attempts, so it cannot go back to draft. Close or archive it instead.",
          "يوجد محاولات مسجلة لهذا التقييم، لذا لا يمكن إعادته إلى المسودة. أغلقه أو أرشفه بدلاً من ذلك.",
        );
      }
    }
    await ctx.db.patch(args.assessmentId, patch);
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: `assessment.status_${args.status}`,
      entity: "assessments",
      entityId: args.assessmentId as string,
      summaryEn: `Set "${assessment.titleEn}" to ${args.status}.`,
      summaryAr: `تم تعيين "${assessment.titleAr}" إلى ${args.status}.`,
    });
    return { ok: true };
  },
});

export const duplicate = mutation({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const assessment = await assertAssessmentOwner(ctx, profile, args.assessmentId);
    const rows = await rowsForVersion(ctx, assessment._id, assessment.version);
    const now = Date.now();
    const newId = await ctx.db.insert("assessments", {
      ownerId: userId,
      kind: assessment.kind,
      titleEn: `${assessment.titleEn} (copy)`,
      titleAr: `${assessment.titleAr} (نسخة)`,
      instructionsEn: assessment.instructionsEn,
      instructionsAr: assessment.instructionsAr,
      subjectId: assessment.subjectId,
      topicId: assessment.topicId,
      status: "draft",
      openAt: undefined,
      closeAt: undefined,
      durationMinutes: assessment.durationMinutes,
      attemptsAllowed: assessment.attemptsAllowed,
      passThreshold: assessment.passThreshold,
      shuffleQuestions: assessment.shuffleQuestions,
      shuffleOptions: assessment.shuffleOptions,
      allowLate: assessment.allowLate,
      releasePolicy: assessment.releasePolicy,
      showAnswersToStudents: assessment.showAnswersToStudents,
      maxScore: assessment.maxScore,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    for (const row of rows) {
      await ctx.db.insert("assessment_questions", {
        assessmentId: newId,
        questionId: row.questionId,
        order: row.order,
        marks: row.marks,
        version: 1,
        snapshot: row.snapshot,
      });
    }
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "assessment.duplicate",
      entity: "assessments",
      entityId: newId as string,
      summaryEn: `Duplicated "${assessment.titleEn}" into a new draft.`,
      summaryAr: `تم نسخ "${assessment.titleAr}" إلى مسودة جديدة.`,
    });
    return { id: newId };
  },
});

/* -------------------------------------------------------------------------- */
/* Assignment                                                                 */
/* -------------------------------------------------------------------------- */

export const assignClasses = mutation({
  args: {
    assessmentId: v.id("assessments"),
    classIds: v.array(v.id("classes")),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const assessment = await assertAssessmentOwner(ctx, profile, args.assessmentId);
    for (const classId of args.classIds) {
      await assertClassAccess(ctx, profile, classId);
    }
    const existing = await ctx.db
      .query("assessment_assignments")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();
    const desired = new Set(args.classIds.map((id) => id as string));
    for (const assignment of existing) {
      if (!desired.has(assignment.classId as string)) {
        await ctx.db.delete(assignment._id);
      }
    }
    for (const classId of args.classIds) {
      const found = existing.find((a) => a.classId === classId);
      if (!found) {
        await ctx.db.insert("assessment_assignments", {
          assessmentId: args.assessmentId,
          classId,
          assignedBy: userId,
          assignedAt: Date.now(),
        });
      }
    }
    const assigned = await assignedStudentIds(ctx, args.assessmentId);
    if (assessment.status === "published") {
      await notifyMany(ctx, assigned, {
        type: "schedule",
        titleEn: `Assignment updated: ${assessment.titleEn}`,
        titleAr: `تم تحديث الإسناد: ${assessment.titleAr}`,
        bodyEn: "Your class list for this assessment changed. Check the details.",
        bodyAr: "تغيّرت صفوفك لهذا التقييم. راجع التفاصيل.",
        link: `/assessments/${args.assessmentId}`,
      });
    }
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "assessment.assign_classes",
      entity: "assessments",
      entityId: args.assessmentId as string,
      summaryEn: `Assigned "${assessment.titleEn}" to ${args.classIds.length} class(es).`,
      summaryAr: `تم إسناد "${assessment.titleAr}" إلى ${args.classIds.length} صفاً.`,
    });
    return { assigned: assigned.length };
  },
});

export const assignStudents = mutation({
  args: {
    assessmentId: v.id("assessments"),
    studentIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const assessment = await assertAssessmentOwner(ctx, profile, args.assessmentId);
    const existing = await ctx.db
      .query("assessment_students")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();
    const desired = new Set(args.studentIds.map((id) => id as string));
    for (const row of existing) {
      if (!desired.has(row.studentId as string)) {
        await ctx.db.delete(row._id);
      }
    }
    for (const studentId of args.studentIds) {
      const studentProfile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", studentId))
        .first();
      if (!studentProfile || studentProfile.role !== ROLES.STUDENT) {
        deny(ERROR_CODES.INVALID, "Only students can be assigned.", "يمكن إسناد التقييم للطلاب فقط.");
      }
      const found = existing.find((a) => a.studentId === studentId);
      if (!found) {
        await ctx.db.insert("assessment_students", {
          assessmentId: args.assessmentId,
          studentId,
          source: "individual",
          assignedBy: userId,
          assignedAt: Date.now(),
        });
        if (assessment.status === "published") {
          await notifyUser(ctx, studentId, {
            type: "assignment",
            titleEn: `Assigned to you: ${assessment.titleEn}`,
            titleAr: `تم إسنادها إليك: ${assessment.titleAr}`,
            bodyEn: "Open the assessment to read the instructions and start.",
            bodyAr: "افتح التقييم لقراءة التعليمات والبدء.",
            link: `/assessments/${args.assessmentId}`,
          });
        }
      }
    }
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "assessment.assign_students",
      entity: "assessments",
      entityId: args.assessmentId as string,
      summaryEn: `Set individual assignment for ${args.studentIds.length} student(s).`,
      summaryAr: `تم تحديد إسناد فردي لـ ${args.studentIds.length} طالباً.`,
    });
    return { ok: true };
  },
});

/* -------------------------------------------------------------------------- */
/* Grading                                                                    */
/* -------------------------------------------------------------------------- */

export const gradingQueue = query({
  args: { assessmentId: v.optional(v.id("assessments")) },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const all = await ctx.db.query("assessments").collect();
    const mine =
      profile.role === ROLES.SUPER_ADMIN
        ? all
        : all.filter((a) => a.ownerId === userId);
    const scoped = args.assessmentId
      ? mine.filter((a) => a._id === args.assessmentId)
      : mine;
    const rows: {
      attemptId: Id<"attempts">;
      assessmentId: Id<"assessments">;
      titleEn: string;
      titleAr: string;
      studentName: string;
      submittedAt?: number;
      pendingManualCount: number;
      status: Doc<"attempts">["status"];
      releasedAt?: number;
      autoScore: number;
      maxScore: number;
    }[] = [];
    for (const assessment of scoped) {
      const attempts = await ctx.db
        .query("attempts")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", assessment._id))
        .collect();
      for (const attempt of attempts) {
        if (attempt.status === "in_progress") continue;
        const studentProfile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", attempt.studentId))
          .first();
        rows.push({
          attemptId: attempt._id,
          assessmentId: assessment._id,
          titleEn: assessment.titleEn,
          titleAr: assessment.titleAr,
          studentName: studentProfile?.name ?? "—",
          submittedAt: attempt.submittedAt,
          pendingManualCount: attempt.pendingManualCount,
          status: attempt.status,
          releasedAt: attempt.releasedAt,
          autoScore: attempt.score,
          maxScore: attempt.maxScore,
        });
      }
    }
    return rows.sort(
      (a, b) =>
        Number(b.pendingManualCount > 0) - Number(a.pendingManualCount > 0) ||
        (b.submittedAt ?? 0) - (a.submittedAt ?? 0),
    );
  },
});

export const attemptForGrading = query({
  args: { attemptId: v.id("attempts") },
  handler: async (ctx, args) => {
    const { profile } = await requireRole(ctx, STAFF);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) deny(ERROR_CODES.NOT_FOUND, "Attempt not found.", "لم يتم العثور على المحاولة.");
    const assessment = await assertAssessmentOwner(ctx, profile, attempt.assessmentId);
    const studentProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", attempt.studentId))
      .first();
    const answers = await ctx.db
      .query("attempt_answers")
      .withIndex("by_attempt", (q) => q.eq("attemptId", args.attemptId))
      .collect();
    const questions = await rowsForVersion(
      ctx,
      attempt.assessmentId,
      attempt.snapshotVersion,
    );
    const byId = new Map(questions.map((q) => [q._id as string, q]));
    const items = answers
      .map((answer) => {
        const question = byId.get(answer.assessmentQuestionId as string);
        return {
          answerId: answer._id,
          assessmentQuestionId: answer.assessmentQuestionId,
          order: question?.order ?? 999,
          marks: answer.maxMarks,
          snapshot: question?.snapshot,
          response: answer.response,
          awardedMarks: answer.awardedMarks,
          isCorrect: answer.isCorrect,
          needsManualGrading: answer.needsManualGrading,
          autoGraded: answer.autoGraded,
          feedback: answer.feedback,
        };
      })
      .sort((a, b) => a.order - b.order);
    const records = await ctx.db
      .query("grading_records")
      .withIndex("by_attempt", (q) => q.eq("attemptId", args.attemptId))
      .collect();
    return {
      attempt: {
        _id: attempt._id,
        status: attempt.status,
        score: attempt.score,
        maxScore: attempt.maxScore,
        percentage: attempt.percentage,
        submittedAt: attempt.submittedAt,
        releasedAt: attempt.releasedAt,
        pendingManualCount: attempt.pendingManualCount,
        attemptNumber: attempt.attemptNumber,
        snapshotVersion: attempt.snapshotVersion,
      },
      assessment: {
        _id: assessment._id,
        titleEn: assessment.titleEn,
        titleAr: assessment.titleAr,
        releasePolicy: assessment.releasePolicy,
        passThreshold: assessment.passThreshold,
        showAnswersToStudents: assessment.showAnswersToStudents,
        version: assessment.version,
      },
      student: {
        name: studentProfile?.name ?? "—",
        email: studentProfile?.email ?? "",
      },
      items,
      records: records
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((r) => ({
          _id: r._id,
          kind: r.kind,
          newMarks: r.newMarks,
          previousMarks: r.previousMarks,
          reason: r.reason,
          createdAt: r.createdAt,
        })),
    };
  },
});

async function recomputeAttemptTotals(ctx: MutationCtx, attemptId: Id<"attempts">) {
  const attempt = await ctx.db.get(attemptId);
  if (!attempt) return null;
  const answers = await ctx.db
    .query("attempt_answers")
    .withIndex("by_attempt", (q) => q.eq("attemptId", attemptId))
    .collect();
  const score =
    Math.round(
      answers.reduce((sum, a) => sum + (a.awardedMarks ?? 0), 0) * 100,
    ) / 100;
  const pending = answers.filter((a) => a.needsManualGrading).length;
  const maxScore = attempt.maxScore || totalMarks(answers.map((a) => ({ marks: a.maxMarks })));
  const percentage =
    maxScore === 0 ? 0 : Math.round((score / maxScore) * 10000) / 100;
  const allGraded = pending === 0;
  const status = allGraded ? "graded" : "submitted";
  const assessment = await ctx.db.get(attempt.assessmentId);
  const passed =
    allGraded && assessment ? percentage >= assessment.passThreshold : undefined;
  await ctx.db.patch(attemptId, {
    score,
    percentage,
    pendingManualCount: pending,
    status,
    passed,
    gradedAt: allGraded ? Date.now() : attempt.gradedAt,
    maxScore,
  });
  return { score, percentage, pending, passed, assessment, attempt };
}

async function maybeRelease(
  ctx: MutationCtx,
  attemptId: Id<"attempts">,
  actor: { userId: Id<"users">; name: string; role: Doc<"profiles">["role"] } | null,
) {
  const attempt = await ctx.db.get(attemptId);
  if (!attempt) return;
  const assessment = await ctx.db.get(attempt.assessmentId);
  if (!assessment) return;
  if (assessment.releasePolicy !== "immediate") return;
  if (attempt.pendingManualCount > 0) return;
  if (attempt.releasedAt) return;
  const now = Date.now();
  await ctx.db.patch(attemptId, { releasedAt: now });
  await notifyUser(ctx, attempt.studentId, {
    type: "result",
    titleEn: `Result released: ${assessment.titleEn}`,
    titleAr: `تم إصدار النتيجة: ${assessment.titleAr}`,
    bodyEn: "Your teacher released the marks for this assessment.",
    bodyAr: "أصدر معلمك درجات هذا التقييم.",
    link: `/results/${attemptId}`,
  });
  await ctx.db.insert("grading_records", {
    attemptId,
    actorId: actor?.userId,
    kind: "release",
    createdAt: now,
  });
}

export const gradeAnswer = mutation({
  args: {
    answerId: v.id("attempt_answers"),
    awardedMarks: v.number(),
    feedback: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const answer = await ctx.db.get(args.answerId);
    if (!answer) deny(ERROR_CODES.NOT_FOUND, "Answer not found.", "لم يتم العثور على الإجابة.");
    const attempt = await ctx.db.get(answer.attemptId);
    if (!attempt) deny(ERROR_CODES.NOT_FOUND, "Attempt not found.", "لم يتم العثور على المحاولة.");
    const assessment = await assertAssessmentOwner(ctx, profile, attempt.assessmentId);
    if (attempt.status === "in_progress") {
      deny(
        ERROR_CODES.CLOSED,
        "The student has not submitted this attempt yet.",
        "لم يقدم الطالب هذه المحاولة بعد.",
      );
    }
    if (args.awardedMarks < 0 || args.awardedMarks > answer.maxMarks) {
      deny(
        ERROR_CODES.INVALID,
        `Award between 0 and ${answer.maxMarks} marks.`,
        `امنح درجة بين ٠ و${answer.maxMarks}.`,
      );
    }
    // Corrections (changing an already awarded mark) are a separate audited act.
    const isCorrection = answer.awardedMarks !== undefined;
    if (isCorrection && !args.reason?.trim()) {
      deny(
        ERROR_CODES.INVALID,
        "A reason is required when changing a grade that was already awarded.",
        "يجب ذكر سبب عند تعديل درجة مُمنوحة مسبقاً.",
      );
    }
    await ctx.db.patch(args.answerId, {
      awardedMarks: args.awardedMarks,
      feedback: args.feedback ?? answer.feedback,
      needsManualGrading: false,
      autoGraded: false,
      gradedAt: Date.now(),
      gradedBy: userId,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("grading_records", {
      attemptId: attempt._id,
      answerId: args.answerId,
      actorId: userId,
      kind: isCorrection ? "correction" : "manual_grade",
      previousMarks: answer.awardedMarks,
      newMarks: args.awardedMarks,
      reason: args.reason,
      createdAt: Date.now(),
    });
    await recomputeAttemptTotals(ctx, attempt._id);
    await maybeRelease(ctx, attempt._id, {
      userId,
      name: profile.name,
      role: profile.role,
    });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: isCorrection ? "grade.correction" : "grade.manual",
      entity: "grading_records",
      entityId: args.answerId as string,
      summaryEn: `${isCorrection ? "Corrected" : "Graded"} an answer in "${assessment.titleEn}" to ${args.awardedMarks}/${answer.maxMarks}.`,
      summaryAr: `${isCorrection ? "تم تصحيح" : "تم تقييم"} إجابة في "${assessment.titleAr}" بـ ${args.awardedMarks}/${answer.maxMarks}.`,
      details: { reason: args.reason, studentId: attempt.studentId },
    });
    if (args.feedback?.trim()) {
      const assessmentRow = await ctx.db.get(attempt.assessmentId);
      await notifyUser(ctx, attempt.studentId, {
        type: "feedback",
        titleEn: `New feedback on ${assessmentRow?.titleEn ?? "an assessment"}`,
        titleAr: `ملاحظات جديدة على ${assessmentRow?.titleAr ?? "تقييم"}`,
        bodyEn: "Your teacher left written feedback on one of your answers.",
        bodyAr: "ترك معلمك ملاحظات مكتوبة على إحدى إجاباتك.",
        link: `/results/${attempt._id}`,
      });
    }
    return { ok: true };
  },
});

export const releaseResults = mutation({
  args: {
    assessmentId: v.id("assessments"),
    onlyAttemptIds: v.optional(v.array(v.id("attempts"))),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const assessment = await assertAssessmentOwner(ctx, profile, args.assessmentId);
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();
    const now = Date.now();
    let released = 0;
    let skipped = 0;
    for (const attempt of attempts) {
      if (args.onlyAttemptIds && !args.onlyAttemptIds.includes(attempt._id)) continue;
      if (attempt.pendingManualCount > 0 || attempt.status === "in_progress") {
        skipped += 1;
        continue;
      }
      if (attempt.releasedAt) continue;
      await ctx.db.patch(attempt._id, { releasedAt: now });
      await ctx.db.insert("grading_records", {
        attemptId: attempt._id,
        actorId: userId,
        kind: "release",
        createdAt: now,
      });
      await notifyUser(ctx, attempt.studentId, {
        type: "result",
        titleEn: `Result released: ${assessment.titleEn}`,
        titleAr: `تم إصدار النتيجة: ${assessment.titleAr}`,
        bodyEn: "Open your results to see the score and feedback.",
        bodyAr: "افتح نتائجك لرؤية الدرجة والملاحظات.",
        link: `/results/${attempt._id}`,
      });
      released += 1;
    }
    if (released > 0) {
      await ctx.db.patch(args.assessmentId, { resultsReleasedAt: now });
    }
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "assessment.release_results",
      entity: "assessments",
      entityId: args.assessmentId as string,
      summaryEn: `Released results of "${assessment.titleEn}" to ${released} student(s); ${skipped} skipped (still awaiting grading).`,
      summaryAr: `تم إصدار نتائج "${assessment.titleAr}" لـ ${released} طالباً، وتم تخطي ${skipped} بانتظار التصحيح.`,
    });
    return { released, skipped };
  },
});

export const reopenAttempt = mutation({
  args: { attemptId: v.id("attempts"), extraMinutes: v.number(), reason: v.string() },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) deny(ERROR_CODES.NOT_FOUND, "Attempt not found.", "لم يتم العثور على المحاولة.");
    const assessment = await assertAssessmentOwner(
      ctx,
      profile,
      attempt.assessmentId,
    );
    if (!args.reason.trim()) {
      deny(ERROR_CODES.INVALID, "A reason is required to reopen an attempt.", "يجب ذكر سبب لإعادة فتح المحاولة.");
    }
    if (args.extraMinutes < 1 || args.extraMinutes > 240) {
      deny(ERROR_CODES.INVALID, "Extra time must be 1–240 minutes.", "الوقت الإضافي يجب أن يكون بين ١ و٢٤٠ دقيقة.");
    }
    // Historic grades stay on the record; only the attempt is reopened.
    await ctx.db.patch(args.attemptId, {
      status: "in_progress",
      expiresAt: Date.now() + args.extraMinutes * 60 * 1000,
      releasedAt: undefined,
    });
    await ctx.db.insert("grading_records", {
      attemptId: args.attemptId,
      actorId: userId,
      kind: "reopen",
      reason: args.reason,
      createdAt: Date.now(),
    });
    await notifyUser(ctx, attempt.studentId, {
      type: "schedule",
      titleEn: `Your attempt was reopened: ${assessment.titleEn}`,
      titleAr: `تم إعادة فتح محاولتك: ${assessment.titleAr}`,
      bodyEn: `You have ${args.extraMinutes} extra minutes to finish.`,
      bodyAr: `لديك ${args.extraMinutes} دقيقة إضافية للإكمال.`,
      link: `/assessments/${assessment._id}/take`,
    });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "attempt.reopen",
      entity: "attempts",
      entityId: args.attemptId as string,
      summaryEn: `Reopened an attempt in "${assessment.titleEn}" (+${args.extraMinutes} min).`,
      summaryAr: `تم إعادة فتح محاولة في "${assessment.titleAr}" (+${args.extraMinutes} دقيقة).`,
      details: { reason: args.reason, studentId: attempt.studentId },
    });
    return { ok: true };
  },
});

/* -------------------------------------------------------------------------- */
/* Analytics                                                                  */
/* -------------------------------------------------------------------------- */

export const analytics = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const assessment = await assertAssessmentOwner(ctx, profile, args.assessmentId);
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();
    const assigned = await assignedStudentIds(ctx, args.assessmentId);
    const graded = attempts.filter((a) => a.status === "graded");

    const bands = [
      { label: "0–49", min: 0, max: 49.999, count: 0 },
      { label: "50–59", min: 50, max: 59.999, count: 0 },
      { label: "60–69", min: 60, max: 69.999, count: 0 },
      { label: "70–79", min: 70, max: 79.999, count: 0 },
      { label: "80–89", min: 80, max: 89.999, count: 0 },
      { label: "90–100", min: 90, max: 100.001, count: 0 },
    ];
    for (const attempt of graded) {
      const band = bands.find(
        (b) => attempt.percentage >= b.min && attempt.percentage < b.max,
      );
      if (band) band.count += 1;
    }

    const questions = await rowsForVersion(
      ctx,
      args.assessmentId,
      assessment.version,
    );
    const answersByAssessmentQuestion = new Map<
      string,
      { attempts: number; correct: number; awarded: number; max: number }
    >();
    for (const attempt of attempts) {
      if (attempt.status === "in_progress") continue;
      const answers = await ctx.db
        .query("attempt_answers")
        .withIndex("by_attempt", (q) => q.eq("attemptId", attempt._id))
        .collect();
      for (const answer of answers) {
        const key = answer.assessmentQuestionId as string;
        const entry =
          answersByAssessmentQuestion.get(key) ??
          { attempts: 0, correct: 0, awarded: 0, max: 0 };
        entry.attempts += 1;
        entry.awarded += answer.awardedMarks ?? 0;
        entry.max += answer.maxMarks;
        if (answer.isCorrect === true) entry.correct += 1;
        answersByAssessmentQuestion.set(key, entry);
      }
    }

    const topicTotals = new Map<
      string,
      { nameEn: string; nameAr: string; awarded: number; max: number }
    >();

    const questionStats = questions.map((question) => {
      const entry = answersByAssessmentQuestion.get(question._id as string);
      const topicKey = (question.snapshot.topicId as string) ?? "untagged";
      const topicEntry =
        topicTotals.get(topicKey) ??
        {
          nameEn: question.snapshot.topicLabelEn ?? "Untagged",
          nameAr: question.snapshot.topicLabelAr ?? "بدون وحدة",
          awarded: 0,
          max: 0,
        };
      topicEntry.awarded += entry?.awarded ?? 0;
      topicEntry.max += entry?.max ?? 0;
      topicTotals.set(topicKey, topicEntry);
      return {
        assessmentQuestionId: question._id,
        order: question.order,
        marks: question.marks,
        type: question.snapshot.type,
        promptEn: question.snapshot.promptEn,
        promptAr: question.snapshot.promptAr,
        topicNameEn: question.snapshot.topicLabelEn,
        topicNameAr: question.snapshot.topicLabelAr,
        answered: entry?.attempts ?? 0,
        correctRate:
          entry && entry.attempts > 0
            ? Math.round((entry.correct / entry.attempts) * 100)
            : null,
        averagePercent:
          entry && entry.max > 0
            ? Math.round((entry.awarded / entry.max) * 10000) / 100
            : null,
      };
    });

    return {
      assessment: {
        _id: assessment._id,
        titleEn: assessment.titleEn,
        titleAr: assessment.titleAr,
        status: assessment.status,
        maxScore: assessment.maxScore,
        passThreshold: assessment.passThreshold,
        releasePolicy: assessment.releasePolicy,
        resultsReleasedAt: assessment.resultsReleasedAt,
        closeAt: assessment.closeAt,
        version: assessment.version,
      },
      counts: {
        assigned: assigned.length,
        started: attempts.length,
        submitted: attempts.filter((a) => a.submittedAt).length,
        graded: graded.length,
        awaitingGrading: attempts.filter((a) => a.pendingManualCount > 0).length,
        released: attempts.filter((a) => a.releasedAt).length,
        averagePercent:
          graded.length === 0
            ? null
            : Math.round(
                (graded.reduce((sum, a) => sum + a.percentage, 0) /
                  graded.length) *
                  100,
              ) / 100,
        passRate:
          graded.length === 0
            ? null
            : Math.round(
                (graded.filter((a) => a.passed).length / graded.length) * 100,
              ),
        completionRate:
          assigned.length === 0
            ? null
            : Math.round(
                (attempts.filter((a) => a.submittedAt).length / assigned.length) *
                  100,
              ),
      },
      distribution: bands.map((b) => ({ label: b.label, count: b.count })),
      questions: questionStats,
      topics: [...topicTotals.entries()].map(([topicId, value]) => ({
        topicId,
        nameEn: value.nameEn,
        nameAr: value.nameAr,
        averagePercent:
          value.max === 0
            ? null
            : Math.round((value.awarded / value.max) * 10000) / 100,
      })),
    };
  },
});

export const attemptRowsForAssessment = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const assessment = await assertAssessmentOwner(ctx, profile, args.assessmentId);
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();
    const rows = await Promise.all(
      attempts.map(async (attempt) => {
        const studentProfile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", attempt.studentId))
          .first();
        return {
          attemptId: attempt._id,
          studentId: attempt.studentId,
          studentName: studentProfile?.name ?? "—",
          attemptNumber: attempt.attemptNumber,
          status: attempt.status,
          startedAt: attempt.startedAt,
          submittedAt: attempt.submittedAt,
          autoSubmitted: attempt.autoSubmitted,
          score: attempt.score,
          maxScore: attempt.maxScore,
          percentage: attempt.percentage,
          passed: attempt.passed,
          pendingManualCount: attempt.pendingManualCount,
          releasedAt: attempt.releasedAt,
        };
      }),
    );
    return {
      assessment: {
        _id: assessment._id,
        titleEn: assessment.titleEn,
        titleAr: assessment.titleAr,
        releasePolicy: assessment.releasePolicy,
        showAnswersToStudents: assessment.showAnswersToStudents,
        passThreshold: assessment.passThreshold,
      },
      rows: rows.sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0)),
    };
  },
});
