import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";
import {
  ERROR_CODES,
  deny,
  gradeLetterFor,
  requireRole,
} from "./lib/guards";
import { ROLES } from "./schema";

async function myAssignedAssessments(
  ctx: QueryCtx,
  studentId: Id<"users">,
): Promise<Doc<"assessments">[]> {
  const ids = new Set<string>();
  const direct = await ctx.db
    .query("assessment_students")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const row of direct) ids.add(row.assessmentId as string);

  const enrollments = await ctx.db
    .query("class_enrollments")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const enrollment of enrollments) {
    if (enrollment.status !== "active") continue;
    const assignments = await ctx.db
      .query("assessment_assignments")
      .withIndex("by_class", (q) => q.eq("classId", enrollment.classId))
      .collect();
    for (const assignment of assignments) ids.add(assignment.assessmentId as string);
  }

  const assessments: Doc<"assessments">[] = [];
  for (const id of ids) {
    const assessment = await ctx.db.get(id as Id<"assessments">);
    if (!assessment) continue;
    if (assessment.status === "draft" || assessment.status === "archived") continue;
    assessments.push(assessment);
  }
  return assessments;
}

type StudentStatus =
  | "available"
  | "in_progress"
  | "completed"
  | "missed"
  | "upcoming"
  | "grading";

function computeStatus(
  assessment: Doc<"assessments">,
  attempts: Doc<"attempts">[],
  now: number,
): { status: StudentStatus; reasonEn: string; reasonAr: string; canStart: boolean } {
  const open = attempts.find((a) => a.status === "in_progress");
  const completed = attempts.filter((a) => a.status !== "in_progress");
  const attemptsLeft = assessment.attemptsAllowed - completed.length;

  if (open) {
    if (open.expiresAt <= now) {
      return {
        status: "grading",
        reasonEn: "Time ran out and your attempt was submitted automatically.",
        reasonAr: "انتهى الوقت وتم تقديم محاولتك تلقائياً.",
        canStart: false,
      };
    }
    return {
      status: "in_progress",
      reasonEn: "You have an attempt in progress.",
      reasonAr: "لديك محاولة قيد التنفيذ.",
      canStart: false,
    };
  }
  if (assessment.closeAt && now > assessment.closeAt && !assessment.allowLate) {
    return completed.length > 0
      ? {
          status: "completed",
          reasonEn: "The deadline has passed. Your submission is on record.",
          reasonAr: "انتهى الموعد النهائي. تم تسجيل إجابتك.",
          canStart: false,
        }
      : {
          status: "missed",
          reasonEn: "You missed the deadline for this assessment.",
          reasonAr: "لم تسلّم هذا التقييم قبل الموعد النهائي.",
          canStart: false,
        };
  }
  if (assessment.status === "scheduled" && assessment.openAt && assessment.openAt > now) {
    return {
      status: "upcoming",
      reasonEn: "Opens at the scheduled time.",
      reasonAr: "يفتح في الوقت المجدول.",
      canStart: false,
    };
  }
  if (attemptsLeft <= 0) {
    return {
      status: "completed",
      reasonEn: "You have used all available attempts.",
      reasonAr: "لقد استخدمت جميع المحاولات المتاحة.",
      canStart: false,
    };
  }
  return {
    status: "available",
    reasonEn:
      completed.length > 0
        ? `${attemptsLeft} attempt(s) left.`
        : "Ready when you are.",
    reasonAr:
      completed.length > 0
        ? `تبقى ${attemptsLeft} محاولة.`
        : "جاهز عندما تريد.",
    canStart: true,
  };
}

export const home = query({
  args: {},
  handler: async (ctx) => {
    const { userId, profile } = await requireRole(ctx, [ROLES.STUDENT]);
    const now = Date.now();
    const assessments = await myAssignedAssessments(ctx, userId);
    const subjects = await ctx.db.query("subjects").collect();

    const rows = await Promise.all(
      assessments.map(async (assessment) => {
        const attempts = await ctx.db
          .query("attempts")
          .withIndex("by_assessment_student", (q) =>
            q.eq("assessmentId", assessment._id).eq("studentId", userId),
          )
          .collect();
        const state = computeStatus(assessment, attempts, now);
        const owner = await ctx.db.get(assessment.ownerId);
        const graded = attempts.filter((a) => a.status === "graded");
        const released = attempts.filter((a) => a.releasedAt);
        return {
          assessmentId: assessment._id,
          titleEn: assessment.titleEn,
          titleAr: assessment.titleAr,
          kind: assessment.kind,
          subjectId: assessment.subjectId,
          subjectNameEn: subjects.find((s) => s._id === assessment.subjectId)?.nameEn ?? "—",
          subjectNameAr: subjects.find((s) => s._id === assessment.subjectId)?.nameAr ?? "—",
          teacherName: owner?.name ?? "—",
          durationMinutes: assessment.durationMinutes,
          maxScore: assessment.maxScore,
          attemptsAllowed: assessment.attemptsAllowed,
          attemptsUsed: attempts.filter((a) => a.status !== "in_progress").length,
          openAt: assessment.openAt,
          closeAt: assessment.closeAt,
          status: state.status,
          statusReasonEn: state.reasonEn,
          statusReasonAr: state.reasonAr,
          canStart: state.canStart,
          activeAttemptId:
            attempts.find((a) => a.status === "in_progress")?._id ?? null,
          bestPercentage:
            graded.length === 0
              ? null
              : Math.max(...graded.map((a) => a.percentage)),
          releasedAttemptId: released.length > 0 ? released[0]._id : null,
        };
      }),
    );

    const byStatus = (status: StudentStatus) =>
      rows
        .filter((row) => row.status === status)
        .sort((a, b) => (a.closeAt ?? 0) - (b.closeAt ?? 0));

    const gradedAttempts = await ctx.db
      .query("attempts")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    const released = gradedAttempts.filter((a) => a.releasedAt);
    const recentResults = await Promise.all(
      released
        .sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))
        .slice(0, 5)
        .map(async (attempt) => {
          const assessment = await ctx.db.get(attempt.assessmentId);
          const subject = assessment
            ? await ctx.db.get(assessment.subjectId)
            : null;
          return {
            attemptId: attempt._id,
            assessmentId: attempt.assessmentId,
            titleEn: assessment?.titleEn ?? "—",
            titleAr: assessment?.titleAr ?? "—",
            subjectNameEn: subject?.nameEn ?? "—",
            subjectNameAr: subject?.nameAr ?? "—",
            score: attempt.score,
            maxScore: attempt.maxScore,
            percentage: attempt.percentage,
            passed: attempt.passed,
            submittedAt: attempt.submittedAt,
            letter: gradeLetterFor(attempt.percentage, [
              { letter: "A", minPercent: 90 },
              { letter: "B", minPercent: 80 },
              { letter: "C", minPercent: 70 },
              { letter: "D", minPercent: 60 },
              { letter: "F", minPercent: 0 },
            ]),
          };
        }),
    );

    const subjectProgress = subjects
      .map((subject) => {
        const subjectAttempts = released.filter((attempt) => {
          const row = rows.find((r) => r.assessmentId === attempt.assessmentId);
          return row?.subjectId === subject._id;
        });
        return {
          subjectId: subject._id,
          nameEn: subject.nameEn,
          nameAr: subject.nameAr,
          color: subject.color,
          attempts: subjectAttempts.length,
          averagePercent:
            subjectAttempts.length === 0
              ? null
              : Math.round(
                  (subjectAttempts.reduce((sum, a) => sum + a.percentage, 0) /
                    subjectAttempts.length) *
                    100,
                ) / 100,
        };
      })
      .filter((row) => row.attempts > 0);

    const achievements = await ctx.db
      .query("student_achievements")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    const definitionRows = await ctx.db.query("achievements").collect();
    const badges = achievements.map((earned) => {
      const definition = definitionRows.find(
        (d) => d.code === earned.achievementCode,
      );
      return {
        code: earned.achievementCode,
        earnedAt: earned.earnedAt,
        titleEn: definition?.titleEn ?? earned.achievementCode,
        titleAr: definition?.titleAr ?? earned.achievementCode,
        descriptionEn: definition?.descriptionEn ?? "",
        descriptionAr: definition?.descriptionAr ?? "",
        icon: definition?.icon ?? "award",
      };
    });

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const calendar = rows
      .filter(
        (row) =>
          row.closeAt !== null &&
          row.closeAt !== undefined &&
          row.closeAt > now &&
          row.status !== "completed",
      )
      .sort((a, b) => (a.closeAt ?? 0) - (b.closeAt ?? 0))
      .slice(0, 8)
      .map((row) => ({
        assessmentId: row.assessmentId,
        titleEn: row.titleEn,
        titleAr: row.titleAr,
        kind: row.kind,
        dueAt: row.closeAt as number,
      }));

    const averagePercent =
      released.length === 0
        ? null
        : Math.round(
            (released.reduce((sum, a) => sum + a.percentage, 0) / released.length) *
              100,
          ) / 100;

    return {
      student: {
        name: profile.name,
        points: profile.points,
        streak: profile.streak,
        isDemo: profile.isDemo,
      },
      counts: {
        available: byStatus("available").length,
        inProgress: byStatus("in_progress").length + byStatus("grading").length,
        completed: byStatus("completed").length,
        missed: byStatus("missed").length,
        upcoming: byStatus("upcoming").length,
        unreadNotifications: unread.filter((n) => !n.readAt).length,
      },
      averagePercent,
      quizzes: rows
        .filter((row) => row.kind !== "homework")
        .sort((a, b) => (a.closeAt ?? 0) - (b.closeAt ?? 0)),
      homework: rows
        .filter((row) => row.kind === "homework")
        .sort((a, b) => (a.closeAt ?? 0) - (b.closeAt ?? 0)),
      inProgress: byStatus("in_progress"),
      upcoming: byStatus("upcoming"),
      missed: byStatus("missed"),
      recentResults,
      subjectProgress,
      badges,
      calendar,
    };
  },
});

export const assessmentDetail = query({
  args: { assessmentId: v.id("assessments") },
  handler: async (ctx, args) => {
    const { userId } = await requireRole(ctx, [ROLES.STUDENT]);
    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) {
      deny(ERROR_CODES.NOT_FOUND, "Assessment not found.", "لم يتم العثور على التقييم.");
    }
    const mine = await myAssignedAssessments(ctx, userId);
    if (!mine.some((a) => a._id === args.assessmentId)) {
      deny(
        ERROR_CODES.NOT_ASSIGNED,
        "This assessment was not assigned to you.",
        "لم يتم إسناد هذا التقييم إليك.",
      );
    }
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_assessment_student", (q) =>
        q.eq("assessmentId", args.assessmentId).eq("studentId", userId),
      )
      .collect();
    const state = computeStatus(assessment, attempts, Date.now());
    const subject = await ctx.db.get(assessment.subjectId);
    const owner = await ctx.db.get(assessment.ownerId);
    const questions = await ctx.db
      .query("assessment_questions")
      .withIndex("by_assessment_version", (q) =>
        q.eq("assessmentId", args.assessmentId).eq("version", assessment.version),
      )
      .collect();
    return {
      assessment: {
        _id: assessment._id,
        titleEn: assessment.titleEn,
        titleAr: assessment.titleAr,
        instructionsEn: assessment.instructionsEn,
        instructionsAr: assessment.instructionsAr,
        kind: assessment.kind,
        subjectNameEn: subject?.nameEn ?? "—",
        subjectNameAr: subject?.nameAr ?? "—",
        teacherName: owner?.name ?? "—",
        durationMinutes: assessment.durationMinutes,
        attemptsAllowed: assessment.attemptsAllowed,
        maxScore: assessment.maxScore,
        passThreshold: assessment.passThreshold,
        showAnswersToStudents: assessment.showAnswersToStudents,
        releasePolicy: assessment.releasePolicy,
        openAt: assessment.openAt,
        closeAt: assessment.closeAt,
        questionCount: questions.length,
        questionTypes: [...new Set(questions.map((q) => q.snapshot.type))],
      },
      state,
      attempts: attempts
        .sort((a, b) => b.attemptNumber - a.attemptNumber)
        .map((attempt) => ({
          attemptId: attempt._id,
          attemptNumber: attempt.attemptNumber,
          status: attempt.status,
          startedAt: attempt.startedAt,
          expiresAt: attempt.expiresAt,
          submittedAt: attempt.submittedAt,
          score: attempt.score,
          maxScore: attempt.maxScore,
          percentage: attempt.percentage,
          passed: attempt.passed,
          releasedAt: attempt.releasedAt,
          pendingManualCount: attempt.pendingManualCount,
        })),
    };
  },
});

export const results = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireRole(ctx, [ROLES.STUDENT]);
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    const subjects = await ctx.db.query("subjects").collect();
    const rows = await Promise.all(
      attempts
        .filter((a) => a.status !== "in_progress")
        .sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))
        .map(async (attempt) => {
          const assessment = await ctx.db.get(attempt.assessmentId);
          return {
            attemptId: attempt._id,
            assessmentId: attempt.assessmentId,
            titleEn: assessment?.titleEn ?? "—",
            titleAr: assessment?.titleAr ?? "—",
            kind: assessment?.kind ?? "quiz",
            subjectNameEn:
              subjects.find((s) => s._id === assessment?.subjectId)?.nameEn ?? "—",
            subjectNameAr:
              subjects.find((s) => s._id === assessment?.subjectId)?.nameAr ?? "—",
            status: attempt.status,
            score: attempt.score,
            maxScore: attempt.maxScore,
            percentage: attempt.percentage,
            passed: attempt.passed,
            submittedAt: attempt.submittedAt,
            releasedAt: attempt.releasedAt,
            pendingManualCount: attempt.pendingManualCount,
          };
        }),
    );
    return {
      released: rows.filter((r) => r.releasedAt),
      pending: rows.filter((r) => !r.releasedAt),
    };
  },
});

export const resultDetail = query({
  args: { attemptId: v.id("attempts") },
  handler: async (ctx, args) => {
    const { userId } = await requireRole(ctx, [ROLES.STUDENT]);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.studentId !== userId) {
      // Deliberately identical to "not found": a student cannot probe other ids.
      deny(ERROR_CODES.NOT_FOUND, "Result not found.", "لم يتم العثور على النتيجة.");
    }
    const assessment = await ctx.db.get(attempt.assessmentId);
    if (!assessment) {
      deny(ERROR_CODES.NOT_FOUND, "Result not found.", "لم يتم العثور على النتيجة.");
    }
    const released = Boolean(attempt.releasedAt);
    const answers = await ctx.db
      .query("attempt_answers")
      .withIndex("by_attempt", (q) => q.eq("attemptId", args.attemptId))
      .collect();
    const questions = await ctx.db
      .query("assessment_questions")
      .withIndex("by_assessment_version", (q) =>
        q.eq("assessmentId", attempt.assessmentId).eq(
          "version",
          attempt.snapshotVersion,
        ),
      )
      .collect();
    const byId = new Map(questions.map((q) => [q._id as string, q]));
    const showReview =
      released &&
      assessment.showAnswersToStudents &&
      attempt.pendingManualCount === 0;

    const topics = new Map<
      string,
      { nameEn: string; nameAr: string; awarded: number; max: number }
    >();
    for (const answer of answers) {
      const question = byId.get(answer.assessmentQuestionId as string);
      if (!question) continue;
      const key = (question.snapshot.topicId as string) ?? "untagged";
      const entry =
        topics.get(key) ??
        {
          nameEn: question.snapshot.topicLabelEn ?? "General",
          nameAr: question.snapshot.topicLabelAr ?? "عام",
          awarded: 0,
          max: 0,
        };
      entry.awarded += answer.awardedMarks ?? 0;
      entry.max += answer.maxMarks;
      topics.set(key, entry);
    }
    const topicRows = [...topics.entries()]
      .map(([topicId, value]) => ({
        topicId,
        nameEn: value.nameEn,
        nameAr: value.nameAr,
        percentage:
          value.max === 0 ? 0 : Math.round((value.awarded / value.max) * 100),
      }))
      .sort((a, b) => b.percentage - a.percentage);

    return {
      released,
      canReviewAnswers: showReview,
      attempt: {
        attemptId: attempt._id,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        autoSubmitted: attempt.autoSubmitted,
        score: attempt.score,
        maxScore: attempt.maxScore,
        percentage: attempt.percentage,
        passed: attempt.passed,
        submittedAt: attempt.submittedAt,
        releasedAt: attempt.releasedAt,
        pendingManualCount: attempt.pendingManualCount,
      },
      assessment: {
        _id: assessment._id,
        titleEn: assessment.titleEn,
        titleAr: assessment.titleAr,
        kind: assessment.kind,
        subjectId: assessment.subjectId,
        passThreshold: assessment.passThreshold,
        releasePolicy: assessment.releasePolicy,
        showAnswersToStudents: assessment.showAnswersToStudents,
      },
      answerCounts: {
        total: answers.length,
        answered: answers.filter((a) => a.awardedMarks !== undefined || a.response.text || a.response.selectedKeys.length > 0).length,
        correct: answers.filter((a) => a.isCorrect === true).length,
        incorrect: answers.filter((a) => a.isCorrect === false).length,
        manual: answers.filter(
          (a) => !a.autoGraded && a.awardedMarks !== undefined,
        ).length,
        graded: answers.filter((a) => a.awardedMarks !== undefined).length,
        pending: attempt.pendingManualCount,
      },
      topics: topicRows,
      strengths: topicRows.filter((t) => t.percentage >= 70).slice(0, 3),
      weaknesses: [...topicRows].reverse().filter((t) => t.percentage < 70).slice(0, 3),
      items: showReview
        ? answers
            .map((answer) => {
              const question = byId.get(answer.assessmentQuestionId as string);
              if (!question) return null;
              return {
                assessmentQuestionId: answer.assessmentQuestionId,
                order: question.order,
                marks: answer.maxMarks,
                awardedMarks: answer.awardedMarks ?? null,
                isCorrect: answer.isCorrect ?? null,
                feedback: answer.feedback ?? null,
                promptEn: question.snapshot.promptEn,
                promptAr: question.snapshot.promptAr,
                imageUrl: question.snapshot.imageUrl,
                type: question.snapshot.type,
                options: question.snapshot.options,
                acceptedAnswers: question.snapshot.acceptedAnswers,
                modelFeedbackEn:
                  assessment.releasePolicy === "immediate"
                    ? question.snapshot.feedbackEn
                    : undefined,
                modelFeedbackAr:
                  assessment.releasePolicy === "immediate"
                    ? question.snapshot.feedbackAr
                    : undefined,
                response: answer.response,
              };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .sort((a, b) => a.order - b.order)
        : [],
    };
  },
});

export const progress = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireRole(ctx, [ROLES.STUDENT]);
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    const subjects = await ctx.db.query("subjects").collect();
    const released = attempts.filter((a) => a.releasedAt);
    const series = await Promise.all(
      released
        .sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0))
        .map(async (attempt) => {
          const assessment = await ctx.db.get(attempt.assessmentId);
          return {
            attemptId: attempt._id,
            at: attempt.submittedAt ?? attempt.startedAt,
            percentage: attempt.percentage,
            subjectId: assessment?.subjectId ?? null,
            titleEn: assessment?.titleEn ?? "",
            titleAr: assessment?.titleAr ?? "",
          };
        }),
    );
    const subjectRows = subjects
      .map((subject) => {
        const items = series.filter((s) => s.subjectId === subject._id);
        return {
          subjectId: subject._id,
          nameEn: subject.nameEn,
          nameAr: subject.nameAr,
          color: subject.color,
          count: items.length,
          averagePercent:
            items.length === 0
              ? null
              : Math.round(
                  (items.reduce((sum, i) => sum + i.percentage, 0) / items.length) *
                    100,
                ) / 100,
          points: items.map((i) => ({
            at: i.at,
            percentage: i.percentage,
            titleEn: i.titleEn,
            titleAr: i.titleAr,
          })),
        };
      })
      .filter((row) => row.count > 0);
    return {
      series: series.map((s) => ({
        at: s.at,
        percentage: s.percentage,
        titleEn: s.titleEn,
        titleAr: s.titleAr,
      })),
      subjects: subjectRows,
      overall:
        series.length === 0
          ? null
          : Math.round(
              (series.reduce((sum, s) => sum + s.percentage, 0) / series.length) *
                100,
            ) / 100,
    };
  },
});

/**
 * The WhatsApp contact the floating button on a student's screens opens.
 *
 * Contact numbers belong to *classes*, not to individual teachers: the school
 * administrator sets one number per class (e.g. the "Grade 7 – A" number), and
 * every student enrolled in that class sees the same contact. A number is
 * resolved for the first active class that has one, so a student in several
 * classes still gets a deterministic target.
 */
export const myClassContact = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireRole(ctx, [ROLES.STUDENT]);
    const enrollments = await ctx.db
      .query("class_enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();

    let fallback: {
      classNameEn: string;
      classNameAr: string;
      whatsapp: string | null;
    } | null = null;

    for (const enrollment of enrollments) {
      if (enrollment.status !== "active") continue;
      const cls = await ctx.db.get(enrollment.classId);
      if (!cls || cls.archivedAt !== undefined) continue;
      if (cls.whatsapp) {
        return {
          classNameEn: cls.nameEn,
          classNameAr: cls.nameAr,
          whatsapp: cls.whatsapp,
        };
      }
      if (!fallback) {
        fallback = {
          classNameEn: cls.nameEn,
          classNameAr: cls.nameAr,
          whatsapp: null,
        };
      }
    }
    return fallback;
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    // Never throw from the shell badge: a missing profile or a table hiccup must
    // degrade to "0 unread" instead of breaking every authenticated page.
    let userId: Id<"users"> | null = null;
    try {
      userId = await getAuthUserId(ctx);
    } catch {
      return 0;
    }
    if (!userId) return 0;
    try {
      const rows = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", userId as Id<"users">))
        .collect();
      return rows.filter((n) => !n.readAt).length;
    } catch {
      return 0;
    }
  },
});
