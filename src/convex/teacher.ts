import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import {
  classIdsForTeacher,
  requireRole,
  studentIdsForTeacher,
} from "./lib/guards";
import { ROLES } from "./schema";

const STAFF = [ROLES.TEACHER, ROLES.SUPER_ADMIN] as const;

export const dashboard = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const windowDays = Math.min(Math.max(args.days ?? 14, 7), 90);
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;

    const allClasses = await ctx.db.query("classes").collect();
    const myClassIds =
      profile.role === ROLES.SUPER_ADMIN
        ? new Set(allClasses.map((c) => c._id as string))
        : await classIdsForTeacher(ctx, userId);
    const myClasses = allClasses.filter((c) => myClassIds.has(c._id as string));

    const allAssessments = await ctx.db.query("assessments").collect();
    const myAssessments =
      profile.role === ROLES.SUPER_ADMIN
        ? allAssessments
        : allAssessments.filter((a) => a.ownerId === userId);

    const studentIds = await studentIdsForTeacher(ctx, profile);
    const subjects = await ctx.db.query("subjects").collect();

    const attemptsByAssessment = new Map<string, number>();
    const submissionsByAssessment = new Map<string, number>();
    const pendingByAssessment = new Map<string, number>();
    const recentSubmissions: {
      attemptId: Id<"attempts">;
      studentName: string;
      titleEn: string;
      titleAr: string;
      submittedAt: number;
      percentage: number;
      pendingManualCount: number;
      autoSubmitted: boolean;
    }[] = [];
    const daily = new Map<string, number>();
    for (let i = windowDays - 1; i >= 0; i -= 1) {
      daily.set(
        new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        0,
      );
    }

    let gradedTotal = 0;
    let percentageSum = 0;
    let awaitingGrading = 0;
    let attemptTotal = 0;

    for (const assessment of myAssessments) {
      const attempts = await ctx.db
        .query("attempts")
        .withIndex("by_assessment", (q) => q.eq("assessmentId", assessment._id))
        .collect();
      attemptsByAssessment.set(assessment._id as string, attempts.length);
      submissionsByAssessment.set(
        assessment._id as string,
        attempts.filter((a) => a.submittedAt).length,
      );
      pendingByAssessment.set(
        assessment._id as string,
        attempts.filter((a) => a.pendingManualCount > 0).length,
      );
      attemptTotal += attempts.length;
      for (const attempt of attempts) {
        if (attempt.status === "graded") {
          gradedTotal += 1;
          percentageSum += attempt.percentage;
        }
        if (attempt.pendingManualCount > 0) awaitingGrading += 1;
        const submittedAt = attempt.submittedAt;
        if (!submittedAt || submittedAt < cutoff) continue;
        const day = new Date(submittedAt).toISOString().slice(0, 10);
        if (daily.has(day)) daily.set(day, (daily.get(day) ?? 0) + 1);
        if (recentSubmissions.length < 40) {
          const studentProfile = await ctx.db
            .query("profiles")
            .withIndex("by_user", (q) => q.eq("userId", attempt.studentId))
            .first();
          recentSubmissions.push({
            attemptId: attempt._id,
            studentName: studentProfile?.name ?? "—",
            titleEn: assessment.titleEn,
            titleAr: assessment.titleAr,
            submittedAt,
            percentage: attempt.percentage,
            pendingManualCount: attempt.pendingManualCount,
            autoSubmitted: attempt.autoSubmitted,
          });
        }
      }
    }

    const upcoming = myAssessments
      .filter(
        (a) =>
          a.closeAt !== undefined &&
          a.closeAt > Date.now() &&
          (a.status === "published" || a.status === "scheduled"),
      )
      .sort((a, b) => (a.closeAt ?? 0) - (b.closeAt ?? 0))
      .slice(0, 6)
      .map((a) => ({
        _id: a._id,
        titleEn: a.titleEn,
        titleAr: a.titleAr,
        status: a.status,
        kind: a.kind,
        closeAt: a.closeAt,
        openAt: a.openAt,
        submissions: submissionsByAssessment.get(a._id as string) ?? 0,
        attempts: attemptsByAssessment.get(a._id as string) ?? 0,
        pending: pendingByAssessment.get(a._id as string) ?? 0,
      }));

    const needsGrading = await Promise.all(
      myAssessments
        .filter((a) => (pendingByAssessment.get(a._id as string) ?? 0) > 0)
        .map(async (a) => {
          const attempts = await ctx.db
            .query("attempts")
            .withIndex("by_assessment", (q) => q.eq("assessmentId", a._id))
            .collect();
          return {
            assessmentId: a._id,
            titleEn: a.titleEn,
            titleAr: a.titleAr,
            pendingAttempts: attempts.filter((t) => t.pendingManualCount > 0)
              .length,
            pendingAnswers: attempts.reduce(
              (sum, t) => sum + t.pendingManualCount,
              0,
            ),
          };
        }),
    );

    const audit = await ctx.db.query("audit_logs").collect();
    const recentActivity = audit
      .filter((entry) => entry.actorId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8)
      .map((entry) => ({
        _id: entry._id,
        action: entry.action,
        summaryEn: entry.summaryEn,
        summaryAr: entry.summaryAr,
        createdAt: entry.createdAt,
      }));

    return {
      role: profile.role,
      counts: {
        classes: myClasses.length,
        students: studentIds.size,
        subjects: new Set(
          myAssessments.map((a) => a.subjectId as string),
        ).size,
        published: myAssessments.filter((a) => a.status === "published").length,
        scheduled: myAssessments.filter((a) => a.status === "scheduled").length,
        drafts: myAssessments.filter((a) => a.status === "draft").length,
        closed: myAssessments.filter((a) => a.status === "closed").length,
        assessments: myAssessments.length,
        attempts: attemptTotal,
        submissions: [...submissionsByAssessment.values()].reduce(
          (sum, value) => sum + value,
          0,
        ),
        awaitingGrading,
        averagePercent:
          gradedTotal === 0
            ? null
            : Math.round((percentageSum / gradedTotal) * 100) / 100,
      },
      classes: myClasses.map((cls) => {
        const subject = subjects.find((s) => s._id === cls.subjectId);
        return {
          _id: cls._id,
          nameEn: cls.nameEn,
          nameAr: cls.nameAr,
          joinCode: cls.joinCode,
          subjectNameEn: subject?.nameEn,
          subjectNameAr: subject?.nameAr,
        };
      }),
      upcoming,
      needsGrading: needsGrading.sort((a, b) => b.pendingAnswers - a.pendingAnswers),
      recentSubmissions: recentSubmissions
        .sort((a, b) => b.submittedAt - a.submittedAt)
        .slice(0, 8),
      recentActivity,
      series: [...daily.entries()].map(([day, submissions]) => ({
        day,
        submissions,
      })),
    };
  },
});
