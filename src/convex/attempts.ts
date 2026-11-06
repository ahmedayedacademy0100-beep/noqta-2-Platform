import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { assignedStudentIds } from "./assessments";
import {
  ERROR_CODES,
  dayKey,
  deny,
  getSettingsRow,
  logAudit,
  requireProfile,
  requireRole,
} from "./lib/guards";
import { autoGrade, hasResponse, type StoredResponse } from "./lib/grading";
import { notifyUser } from "./lib/notify";
import { seededShuffle } from "./lib/snapshot";
import { ROLES } from "./schema";

const STAFF = [ROLES.TEACHER, ROLES.SUPER_ADMIN] as const;

const responseValidator = v.object({
  selectedKeys: v.array(v.string()),
  text: v.optional(v.string()),
  blanks: v.optional(v.array(v.string())),
  booleanAnswer: v.optional(v.boolean()),
});

function seedFromId(id: string): number {
  let hash = 7;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 2147483647;
  }
  return hash;
}

async function questionsForVersion(
  ctx: QueryCtx | MutationCtx,
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

/** Strips correct-answer keys so a student can never read them from the client. */
function stripKeys(snapshot: Doc<"assessment_questions">["snapshot"]) {
  return {
    type: snapshot.type,
    promptEn: snapshot.promptEn,
    promptAr: snapshot.promptAr,
    instructionsEn: snapshot.instructionsEn,
    instructionsAr: snapshot.instructionsAr,
    imageUrl: snapshot.imageUrl,
    options: snapshot.options.map((o) => ({
      key: o.key,
      textEn: o.textEn,
      textAr: o.textAr,
    })),
    gradingMode: snapshot.gradingMode,
    difficulty: snapshot.difficulty,
  };
}

async function studentAttempts(
  ctx: QueryCtx | MutationCtx,
  assessmentId: Id<"assessments">,
  studentId: Id<"users">,
): Promise<Doc<"attempts">[]> {
  const rows = await ctx.db
    .query("attempts")
    .withIndex("by_assessment_student", (q) =>
      q.eq("assessmentId", assessmentId).eq("studentId", studentId),
    )
    .collect();
  return rows.sort((a, b) => a.attemptNumber - b.attemptNumber);
}

/* -------------------------------------------------------------------------- */
/* Start / resume                                                             */
/* -------------------------------------------------------------------------- */

export const start = mutation({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, [ROLES.STUDENT]);
    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) {
      deny(ERROR_CODES.NOT_FOUND, "Assessment not found.", "لم يتم العثور على التقييم.");
    }
    const assigned = await assignedStudentIds(ctx, args.assessmentId);
    if (!assigned.includes(userId)) {
      deny(
        ERROR_CODES.NOT_ASSIGNED,
        "This assessment was not assigned to you. Ask your teacher to assign it.",
        "لم يتم إسناد هذا التقييم إليك. اطلب من معلمك إسناده.",
      );
    }
    if (assessment.status === "draft" || assessment.status === "archived") {
      deny(ERROR_CODES.CLOSED, "This assessment is not available yet.", "هذا التقييم غير متاح بعد.");
    }
    const now = Date.now();
    if (assessment.status === "scheduled") {
      if (!assessment.openAt || assessment.openAt > now) {
        deny(
          ERROR_CODES.CLOSED,
          "This assessment has not opened yet.",
          "لم يُفتح هذا التقييم بعد.",
        );
      }
      await ctx.db.patch(args.assessmentId, { status: "published" });
    }
    if (assessment.closeAt && now > assessment.closeAt && !assessment.allowLate) {
      deny(
        ERROR_CODES.CLOSED,
        "The deadline for this assessment has passed.",
        "انتهى الموعد النهائي لهذا التقييم.",
      );
    }

    const existing = await studentAttempts(ctx, args.assessmentId, userId);
    const open = existing.find((a) => a.status === "in_progress");
    if (open) {
      if (open.expiresAt <= now) {
        await finalizeAttempt(ctx, open._id, {
          auto: true,
          actor: null,
        });
        deny(
          ERROR_CODES.CLOSED,
          "Time ran out on your previous attempt, so it was submitted automatically.",
          "انتهى وقت محاولتك السابقة وتم تقديمها تلقائياً.",
        );
      }
      return {
        attemptId: open._id,
        resumed: true,
        expiresAt: open.expiresAt,
        attemptNumber: open.attemptNumber,
      };
    }

    const completed = existing.filter(
      (a) => a.status !== "in_progress",
    ).length;
    if (completed >= assessment.attemptsAllowed) {
      deny(
        ERROR_CODES.ATTEMPTS_EXHAUSTED,
        "You have used all available attempts.",
        "لقد استخدمت جميع المحاولات المتاحة.",
      );
    }

    const version = assessment.version;
    const questions = await questionsForVersion(ctx, args.assessmentId, version);
    if (questions.length === 0) {
      deny(
        ERROR_CODES.CLOSED,
        "This assessment has no questions yet.",
        "لا يحتوي هذا التقييم على أسئلة بعد.",
      );
    }
    const maxScore =
      Math.round(
        questions.reduce((sum, q) => sum + q.marks, 0) * 100,
      ) / 100;
    const durationEnd = now + assessment.durationMinutes * 60 * 1000;
    const expiresAt =
      assessment.closeAt && !assessment.allowLate
        ? Math.min(durationEnd, assessment.closeAt)
        : durationEnd;

    const attemptId = await ctx.db.insert("attempts", {
      assessmentId: args.assessmentId,
      studentId: userId,
      attemptNumber: completed + 1,
      status: "in_progress",
      startedAt: now,
      expiresAt,
      autoSubmitted: false,
      score: 0,
      maxScore,
      percentage: 0,
      pendingManualCount: 0,
      snapshotVersion: version,
      lastSavedAt: now,
    });
    for (const question of questions) {
      await ctx.db.insert("attempt_answers", {
        attemptId,
        assessmentQuestionId: question._id,
        questionId: question.questionId,
        response: { selectedKeys: [] },
        flagged: false,
        maxMarks: question.marks,
        autoGraded: false,
        needsManualGrading: false,
        updatedAt: now,
      });
    }
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "attempt.start",
      entity: "attempts",
      entityId: attemptId as string,
      summaryEn: `Started attempt ${completed + 1} of "${assessment.titleEn}".`,
      summaryAr: `بدأ المحاولة ${completed + 1} في "${assessment.titleAr}".`,
      details: { version },
    });
    return {
      attemptId,
      resumed: false,
      expiresAt,
      attemptNumber: completed + 1,
    };
  },
});

/* -------------------------------------------------------------------------- */
/* Read state                                                                 */
/* -------------------------------------------------------------------------- */

export const state = query({
  args: { attemptId: v.id("attempts") },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireProfile(ctx);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) {
      deny(ERROR_CODES.NOT_FOUND, "Attempt not found.", "لم يتم العثور على المحاولة.");
    }
    const isOwner = attempt.studentId === userId;
    if (!isOwner && profile.role === ROLES.STUDENT) {
      deny(
        ERROR_CODES.FORBIDDEN,
        "This attempt belongs to another student.",
        "هذه المحاولة تخص طالباً آخر.",
      );
    }
    const assessment = await ctx.db.get(attempt.assessmentId);
    if (!assessment) {
      deny(ERROR_CODES.NOT_FOUND, "Assessment not found.", "لم يتم العثور على التقييم.");
    }
    if (!isOwner && assessment.ownerId !== userId && profile.role !== ROLES.SUPER_ADMIN) {
      deny(
        ERROR_CODES.FORBIDDEN,
        "This attempt belongs to another teacher's assessment.",
        "هذه المحاولة تخص تقييماً لمعلّم آخر.",
      );
    }
    const questions = await questionsForVersion(
      ctx,
      attempt.assessmentId,
      attempt.snapshotVersion,
    );
    const answers = await ctx.db
      .query("attempt_answers")
      .withIndex("by_attempt", (q) => q.eq("attemptId", args.attemptId))
      .collect();
    const seed = seedFromId(args.attemptId as string);

    let ordered = questions;
    if (assessment.shuffleQuestions) {
      ordered = seededShuffle(questions, seed);
    }

    const now = Date.now();
    const expired = attempt.status === "in_progress" && attempt.expiresAt <= now;
    const items = ordered.map((question) => {
      const answer = answers.find(
        (a) => a.assessmentQuestionId === question._id,
      );
      const snapshot = question.snapshot;
      const options =
        assessment.shuffleOptions && snapshot.options.length > 1
          ? seededShuffle(snapshot.options, seed + question.order + 1)
          : snapshot.options;
      return {
        assessmentQuestionId: question._id,
        order: question.order,
        marks: question.marks,
        snapshot: { ...stripKeys(snapshot), options: stripKeys({ ...snapshot, options }).options },
        options: options.map((o) => ({
          key: o.key,
          textEn: o.textEn,
          textAr: o.textAr,
        })),
        response: answer?.response ?? { selectedKeys: [] },
        flagged: answer?.flagged ?? false,
        savedAt: answer?.updatedAt ?? null,
      };
    });

    return {
      attempt: {
        _id: attempt._id,
        status: attempt.status,
        attemptNumber: attempt.attemptNumber,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        submittedAt: attempt.submittedAt,
        autoSubmitted: attempt.autoSubmitted,
        lastSavedAt: attempt.lastSavedAt,
        snapshotVersion: attempt.snapshotVersion,
        score: attempt.score,
        maxScore: attempt.maxScore,
        percentage: attempt.percentage,
        releasedAt: attempt.releasedAt,
        pendingManualCount: attempt.pendingManualCount,
      },
      assessment: {
        _id: assessment._id,
        titleEn: assessment.titleEn,
        titleAr: assessment.titleAr,
        instructionsEn: assessment.instructionsEn,
        instructionsAr: assessment.instructionsAr,
        durationMinutes: assessment.durationMinutes,
        passThreshold: assessment.passThreshold,
        attemptsAllowed: assessment.attemptsAllowed,
        showAnswersToStudents: assessment.showAnswersToStudents,
        releasePolicy: assessment.releasePolicy,
        closeAt: assessment.closeAt,
        kind: assessment.kind,
      },
      isOwner,
      expired,
      serverNow: now,
      remainingMs: Math.max(0, attempt.expiresAt - now),
      items,
    };
  },
});

/* -------------------------------------------------------------------------- */
/* Autosave                                                                   */
/* -------------------------------------------------------------------------- */

export const saveAnswer = mutation({
  args: {
    attemptId: v.id("attempts"),
    assessmentQuestionId: v.id("assessment_questions"),
    response: responseValidator,
    flagged: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, [ROLES.STUDENT]);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.studentId !== userId) {
      deny(ERROR_CODES.FORBIDDEN, "This attempt is not yours.", "هذه المحاولة ليست لك.");
    }
    if (attempt.status !== "in_progress") {
      deny(
        ERROR_CODES.CLOSED,
        "This attempt has already been submitted and can no longer be edited.",
        "تم تقديم هذه المحاولة ولا يمكن تعديلها.",
      );
    }
    const now = Date.now();
    if (attempt.expiresAt <= now) {
      await finalizeAttempt(ctx, args.attemptId, { auto: true, actor: null });
      deny(
        ERROR_CODES.CLOSED,
        "Time is up. Your attempt was submitted automatically.",
        "انتهى الوقت. تم تقديم محاولتك تلقائياً.",
      );
    }
    const question = await ctx.db.get(args.assessmentQuestionId);
    if (!question || question.assessmentId !== attempt.assessmentId) {
      deny(ERROR_CODES.NOT_FOUND, "Question not found.", "لم يتم العثور على السؤال.");
    }
    const existing = await ctx.db
      .query("attempt_answers")
      .withIndex("by_attempt_question", (q) =>
        q
          .eq("attemptId", args.attemptId)
          .eq("assessmentQuestionId", args.assessmentQuestionId),
      )
      .first();
    const payload = {
      response: {
        selectedKeys: args.response.selectedKeys.slice(0, 26),
        text: args.response.text?.slice(0, 20000),
        blanks: args.response.blanks?.slice(0, 20).map((b) => b.slice(0, 500)),
        booleanAnswer: args.response.booleanAnswer,
      },
      flagged: args.flagged ?? existing?.flagged ?? false,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("attempt_answers", {
        attemptId: args.attemptId,
        assessmentQuestionId: args.assessmentQuestionId,
        questionId: question.questionId,
        ...payload,
        maxMarks: question.marks,
        autoGraded: false,
        needsManualGrading: false,
      });
    }
    await ctx.db.patch(args.attemptId, { lastSavedAt: now });
    void profile;
    return { savedAt: now };
  },
});

/* -------------------------------------------------------------------------- */
/* Submission (idempotent) + grading                                          */
/* -------------------------------------------------------------------------- */

const ACHIEVEMENT_DEFAULTS = [
  { code: "first_steps", points: 10 },
  { code: "sharp_shooter", points: 30 },
  { code: "essay_writer", points: 15 },
  { code: "streak_3", points: 25 },
];

async function evaluateGamification(
  ctx: MutationCtx,
  studentId: Id<"users">,
  percentage: number,
  passed: boolean | undefined,
  hasManual: boolean,
) {
  const settings = await getSettingsRow(ctx);
  if (settings && settings.gamificationEnabled === false) return;
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", studentId))
    .first();
  if (!profile) return;

  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - 24 * 60 * 60 * 1000);
  let streak = profile.streak;
  if (profile.lastActiveDay !== today) {
    streak = profile.lastActiveDay === yesterday ? profile.streak + 1 : 1;
  }
  const points = profile.points + 10 + (passed ? 15 : 0);

  const unlocked: string[] = [];
  if (percentage >= 90) unlocked.push("sharp_shooter");
  if (hasManual) unlocked.push("essay_writer");
  if (streak >= 3) unlocked.push("streak_3");
  const totalAttempts = await ctx.db
    .query("attempts")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  if (totalAttempts.filter((a) => a.submittedAt).length >= 1) {
    unlocked.push("first_steps");
  }

  let bonus = 0;
  for (const code of unlocked) {
    const definition = await ctx.db
      .query("achievements")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!definition || !definition.active) continue;
    const existing = await ctx.db
      .query("student_achievements")
      .withIndex("by_student_code", (q) =>
        q.eq("studentId", studentId).eq("achievementCode", code),
      )
      .first();
    if (existing) continue;
    await ctx.db.insert("student_achievements", {
      studentId,
      achievementCode: code,
      earnedAt: Date.now(),
      meta: `points:${definition.points}`,
    });
    bonus += definition.points;
  }

  await ctx.db.patch(profile._id, {
    points: points + bonus,
    streak,
    lastActiveDay: today,
    updatedAt: Date.now(),
  });
  void ACHIEVEMENT_DEFAULTS;
}

export async function finalizeAttempt(
  ctx: MutationCtx,
  attemptId: Id<"attempts">,
  options: {
    auto: boolean;
    actor: { userId: Id<"users">; name: string; role: Doc<"profiles">["role"] } | null;
  },
) {
  const attempt = await ctx.db.get(attemptId);
  if (!attempt) {
    deny(ERROR_CODES.NOT_FOUND, "Attempt not found.", "لم يتم العثور على المحاولة.");
  }
  if (attempt.status !== "in_progress") {
    // Idempotent: a duplicate submit returns the stored result.
    return {
      alreadySubmitted: true as const,
      score: attempt.score,
      maxScore: attempt.maxScore,
      percentage: attempt.percentage,
      pendingManualCount: attempt.pendingManualCount,
      releasedAt: attempt.releasedAt,
      assessmentId: attempt.assessmentId,
    };
  }
  const assessment = await ctx.db.get(attempt.assessmentId);
  if (!assessment) {
    deny(ERROR_CODES.NOT_FOUND, "Assessment not found.", "لم يتم العثور على التقييم.");
  }
  const questions = await questionsForVersion(
    ctx,
    attempt.assessmentId,
    attempt.snapshotVersion,
  );
  const answers = await ctx.db
    .query("attempt_answers")
    .withIndex("by_attempt", (q) => q.eq("attemptId", attemptId))
    .collect();

  const now = Date.now();
  let score = 0;
  let pending = 0;
  let hasManualAnswer = false;

  for (const question of questions) {
    const answer = answers.find((a) => a.assessmentQuestionId === question._id);
    const response: StoredResponse = answer?.response ?? { selectedKeys: [] };
    const answered = hasResponse(question.snapshot, response);
    const result = autoGrade(question.snapshot, question.marks, response);
    const needsManual = answered && result.needsManualGrading;
    const awarded = needsManual ? undefined : answered ? result.awardedMarks : 0;
    if (needsManual) {
      pending += 1;
      hasManualAnswer = true;
    }
    score += awarded ?? 0;
    const patch = {
      awardedMarks: awarded,
      isCorrect: needsManual ? undefined : result.isCorrect,
      autoGraded: !needsManual && answered,
      needsManualGrading: needsManual,
      maxMarks: question.marks,
      updatedAt: now,
    };
    if (answer) {
      await ctx.db.patch(answer._id, patch);
      if (answered && !needsManual) {
        await ctx.db.insert("grading_records", {
          attemptId,
          answerId: answer._id,
          actorId: options.actor?.userId,
          kind: "auto_grade",
          newMarks: awarded,
          createdAt: now,
        });
      }
    } else {
      await ctx.db.insert("attempt_answers", {
        attemptId,
        assessmentQuestionId: question._id,
        questionId: question.questionId,
        response: { selectedKeys: [] },
        flagged: false,
        ...patch,
      });
    }
  }

  score = Math.round(score * 100) / 100;
  const maxScore =
    attempt.maxScore ||
    Math.round(questions.reduce((sum, q) => sum + q.marks, 0) * 100) / 100;
  const percentage = maxScore === 0 ? 0 : Math.round((score / maxScore) * 10000) / 100;
  const passed = pending === 0 ? percentage >= assessment.passThreshold : undefined;
  const autoSubmitted = options.auto || attempt.expiresAt <= now;

  await ctx.db.patch(attemptId, {
    status: pending === 0 ? "graded" : "submitted",
    submittedAt: now,
    autoSubmitted,
    score,
    maxScore,
    percentage,
    passed,
    pendingManualCount: pending,
    gradedAt: pending === 0 ? now : undefined,
  });

  let releasedAt = attempt.releasedAt;
  /**
   * A fully auto-graded quiz is released the moment the student submits so the
   * evaluation and the corrections are waiting for them. Exams and homework
   * keep the teacher's chosen release policy.
   */
  const releasesNow =
    pending === 0 &&
    !attempt.releasedAt &&
    (assessment.releasePolicy === "immediate" || assessment.kind === "quiz");
  if (releasesNow) {
    releasedAt = now;
    await ctx.db.patch(attemptId, { releasedAt: now });
    await ctx.db.insert("grading_records", {
      attemptId,
      actorId: options.actor?.userId,
      kind: "release",
      createdAt: now,
    });
    await notifyUser(ctx, attempt.studentId, {
      type: "result",
      titleEn: `Result released: ${assessment.titleEn}`,
      titleAr: `تم إصدار النتيجة: ${assessment.titleAr}`,
      bodyEn: "Your score is ready to view.",
      bodyAr: "درجتك جاهزة للعرض.",
      link: `/results/${attemptId}`,
    });
  }

  await notifyUser(ctx, assessment.ownerId, {
    type: pending > 0 ? "deadline" : "result",
    titleEn:
      pending > 0
        ? `Essays waiting for grading: ${assessment.titleEn}`
        : `New submission: ${assessment.titleEn}`,
    titleAr:
      pending > 0
        ? `إجابات بانتظار التصحيح: ${assessment.titleAr}`
        : `تسليم جديد: ${assessment.titleAr}`,
    bodyEn:
      pending > 0
        ? `${pending} answer(s) need manual grading.`
        : "All answers were graded automatically.",
    bodyAr:
      pending > 0
        ? `${pending} إجابة تحتاج تصحيحاً يدوياً.`
        : "تم تصحيح جميع الإجابات تلقائياً.",
    link: `/teacher/grading`,
  });

  await evaluateGamification(
    ctx,
    attempt.studentId,
    percentage,
    passed,
    hasManualAnswer,
  );

  await logAudit(ctx, {
    actor: options.actor,
    action: autoSubmitted ? "attempt.auto_submit" : "attempt.submit",
    entity: "attempts",
    entityId: attemptId as string,
    summaryEn: `Attempt ${attempt.attemptNumber} of "${assessment.titleEn}" ${autoSubmitted ? "auto-submitted on expiry" : "submitted"} with ${score}/${maxScore}${pending > 0 ? ` and ${pending} pending manual grade(s)` : ""}.`,
    summaryAr: `المحاولة ${attempt.attemptNumber} في "${assessment.titleAr}" ${autoSubmitted ? "قُدمت تلقائياً عند انتهاء الوقت" : "تم تقديمها"} بنتيجة ${score}/${maxScore}${pending > 0 ? ` مع ${pending} إجابة بانتظار التصحيح` : ""}.`,
    details: { studentId: attempt.studentId, version: attempt.snapshotVersion },
  });

  return {
    alreadySubmitted: false as const,
    score,
    maxScore,
    percentage,
    pendingManualCount: pending,
    releasedAt,
    assessmentId: attempt.assessmentId,
  };
}

export const submit = mutation({
  args: { attemptId: v.id("attempts") },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, [ROLES.STUDENT]);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.studentId !== userId) {
      deny(ERROR_CODES.FORBIDDEN, "This attempt is not yours.", "هذه المحاولة ليست لك.");
    }
    return await finalizeAttempt(ctx, args.attemptId, {
      auto: false,
      actor: { userId, name: profile.name, role: profile.role },
    });
  },
});

/** Called by the timer in the UI when it reaches zero. */
export const submitOnExpiry = mutation({
  args: { attemptId: v.id("attempts") },
  handler: async (ctx, args) => {
    const { userId } = await requireRole(ctx, [ROLES.STUDENT]);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.studentId !== userId) {
      deny(ERROR_CODES.FORBIDDEN, "This attempt is not yours.", "هذه المحاولة ليست لك.");
    }
    return await finalizeAttempt(ctx, args.attemptId, { auto: true, actor: null });
  },
});

/** Server-side safety net: expired attempts are submitted even if the tab is closed. */
export const autoSubmitExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const inProgress = await ctx.db
      .query("attempts")
      .withIndex("by_status", (q) => q.eq("status", "in_progress"))
      .collect();
    const now = Date.now();
    let submitted = 0;
    for (const attempt of inProgress) {
      if (attempt.expiresAt > now) continue;
      await finalizeAttempt(ctx, attempt._id, { auto: true, actor: null });
      submitted += 1;
    }
    return { submitted };
  },
});

/**
 * Release attempts of assessments whose policy is "after the deadline" once
 * the deadline has passed. Without this, "on_close" never released anything.
 */
export const releaseClosedAssessments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const assessments = await ctx.db.query("assessments").collect();
    const now = Date.now();
    let released = 0;
    for (const assessment of assessments) {
      if (assessment.releasePolicy !== "on_close") continue;
      if (!assessment.closeAt || assessment.closeAt > now) continue;
      if (assessment.status === "draft" || assessment.status === "archived") continue;
      const attempts = await ctx.db
        .query("attempts")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", assessment._id))
        .collect();
      let releasedHere = 0;
      for (const attempt of attempts) {
        if (attempt.releasedAt) continue;
        if (attempt.status === "in_progress" || attempt.pendingManualCount > 0) continue;
        await ctx.db.patch(attempt._id, { releasedAt: now });
        await ctx.db.insert("grading_records", {
          attemptId: attempt._id,
          kind: "release",
          createdAt: now,
        });
        await notifyUser(ctx, attempt.studentId, {
          type: "result",
          titleEn: `Result released: ${assessment.titleEn}`,
          titleAr: `تم إصدار النتيجة: ${assessment.titleAr}`,
          bodyEn: "The deadline has passed, so your marks are now available.",
          bodyAr: "انتهى الموعد النهائي، ودرجاتك متاحة الآن.",
          link: `/results/${attempt._id}`,
        });
        releasedHere += 1;
      }
      if (releasedHere > 0) {
        await ctx.db.patch(assessment._id, { resultsReleasedAt: now });
        released += releasedHere;
      }
    }
    return { released };
  },
});

/* -------------------------------------------------------------------------- */
/* Rescheduling / accommodations                                              */
/* -------------------------------------------------------------------------- */

export const extendAttempt = mutation({
  args: { attemptId: v.id("attempts"), extraMinutes: v.number() },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) deny(ERROR_CODES.NOT_FOUND, "Attempt not found.", "لم يتم العثور على المحاولة.");
    const assessment = await ctx.db.get(attempt.assessmentId);
    if (!assessment) deny(ERROR_CODES.NOT_FOUND, "Assessment not found.", "لم يتم العثور على التقييم.");
    if (assessment.ownerId !== userId && profile.role !== ROLES.SUPER_ADMIN) {
      deny(
        ERROR_CODES.FORBIDDEN,
        "This attempt belongs to another teacher's assessment.",
        "هذه المحاولة تخص تقييماً لمعلّم آخر.",
      );
    }
    if (args.extraMinutes < 1 || args.extraMinutes > 240) {
      deny(ERROR_CODES.INVALID, "Extra time must be 1–240 minutes.", "الوقت الإضافي يجب أن يكون بين ١ و٢٤٠ دقيقة.");
    }
    await ctx.db.patch(args.attemptId, {
      expiresAt: Math.max(attempt.expiresAt, Date.now()) + args.extraMinutes * 60 * 1000,
    });
    await notifyUser(ctx, attempt.studentId, {
      type: "schedule",
      titleEn: `Extra time added: ${assessment.titleEn}`,
      titleAr: `تمت إضافة وقت إضافي: ${assessment.titleAr}`,
      bodyEn: `You now have ${args.extraMinutes} extra minutes.`,
      bodyAr: `لديك الآن ${args.extraMinutes} دقيقة إضافية.`,
      link: `/assessments/${assessment._id}/take`,
    });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "attempt.extend_time",
      entity: "attempts",
      entityId: args.attemptId as string,
      summaryEn: `Added ${args.extraMinutes} minutes to an attempt (accommodation).`,
      summaryAr: `تمت إضافة ${args.extraMinutes} دقيقة إلى محاولة (تسهيل).`,
      details: { studentId: attempt.studentId },
    });
    return { ok: true };
  },
});
