import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ROLES, type Role } from "../schema";

/**
 * Server-side authorization layer.
 *
 * Every Convex function that touches sensitive data goes through these
 * helpers. This is the equivalent of Postgres RLS for this deployment: the
 * rules live in the backend, so hiding a button in the UI is never the thing
 * that protects a record. Errors carry a stable `code` (and optional
 * bilingual message) so the client can render a localized 403 screen.
 */

export type Ctx = QueryCtx | MutationCtx;
export type Profile = Doc<"profiles">;

export const ERROR_CODES = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  NO_PROFILE: "NO_PROFILE",
  SUSPENDED: "SUSPENDED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INVALID: "INVALID",
  CLOSED: "CLOSED",
  ATTEMPTS_EXHAUSTED: "ATTEMPTS_EXHAUSTED",
  NOT_ASSIGNED: "NOT_ASSIGNED",
  RESULTS_NOT_RELEASED: "RESULTS_NOT_RELEASED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export function deny(
  code: ErrorCode,
  messageEn: string,
  messageAr?: string,
): never {
  throw new ConvexError({
    code,
    messageEn,
    messageAr: messageAr ?? messageEn,
  });
}

/* -------------------------------------------------------------------------- */
/* Identity                                                                   */
/* -------------------------------------------------------------------------- */

export async function getProfile(
  ctx: Ctx,
  userId: Id<"users">,
): Promise<Profile | null> {
  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

/** The signed-in user plus their profile. Throws for anonymous/unknown users. */
export async function requireProfile(
  ctx: Ctx,
): Promise<{ userId: Id<"users">; profile: Profile }> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    deny(
      ERROR_CODES.UNAUTHENTICATED,
      "You need to sign in to do that.",
      "يجب تسجيل الدخول للقيام بذلك.",
    );
  }
  const profile = await getProfile(ctx, userId);
  if (profile === null) {
    deny(
      ERROR_CODES.NO_PROFILE,
      "This account has no role assigned yet.",
      "لا يوجد دور مرتبط بهذا الحساب بعد.",
    );
  }
  if (profile.status !== "active") {
    deny(
      ERROR_CODES.SUSPENDED,
      "This account is suspended. Contact your administrator.",
      "هذا الحساب موقوف. تواصل مع المسؤول.",
    );
  }
  return { userId, profile };
}

export async function requireRole<const T extends readonly Role[]>(
  ctx: Ctx,
  roles: T,
): Promise<{ userId: Id<"users">; profile: Profile }> {
  const session = await requireProfile(ctx);
  if (!roles.includes(session.profile.role)) {
    deny(
      ERROR_CODES.FORBIDDEN,
      "Your role does not allow this action.",
      "دورك الحالي لا يسمح بهذا الإجراء.",
    );
  }
  return session;
}

export const requireTeacher = (ctx: Ctx) =>
  requireRole(ctx, [ROLES.TEACHER, ROLES.SUPER_ADMIN] as const);

export const requireAdmin = (ctx: Ctx) => requireRole(ctx, [ROLES.SUPER_ADMIN] as const);

export const requireStudent = (ctx: Ctx) => requireRole(ctx, [ROLES.STUDENT] as const);

/* -------------------------------------------------------------------------- */
/* Class / enrolment scoping                                                  */
/* -------------------------------------------------------------------------- */

export async function classIdsForTeacher(
  ctx: Ctx,
  teacherId: Id<"users">,
): Promise<Set<string>> {
  const assignments = await ctx.db
    .query("teacher_assignments")
    .withIndex("by_teacher", (q) => q.eq("teacherId", teacherId))
    .collect();
  const homerooms = await ctx.db
    .query("classes")
    .withIndex("by_teacher", (q) => q.eq("homeroomTeacherId", teacherId))
    .collect();
  const ids = new Set<string>();
  for (const a of assignments) ids.add(a.classId as string);
  for (const c of homerooms) ids.add(c._id as string);
  return ids;
}

export async function isTeacherOfClass(
  ctx: Ctx,
  teacherId: Id<"users">,
  classId: Id<"classes">,
): Promise<boolean> {
  const cls = await ctx.db.get(classId);
  if (!cls) return false;
  if (cls.homeroomTeacherId === teacherId) return true;
  const link = await ctx.db
    .query("teacher_assignments")
    .withIndex("by_teacher_class_subject", (q) =>
      q.eq("teacherId", teacherId).eq("classId", classId),
    )
    .first();
  return link !== null;
}

/** Throws unless the caller is an admin, or a teacher who owns the class. */
export async function assertClassAccess(
  ctx: Ctx,
  profile: Profile,
  classId: Id<"classes">,
): Promise<void> {
  if (profile.role === ROLES.SUPER_ADMIN) return;
  if (profile.role === ROLES.TEACHER) {
    if (await isTeacherOfClass(ctx, profile.userId, classId)) return;
  }
  deny(
    ERROR_CODES.FORBIDDEN,
    "You do not have access to this class.",
    "لا تملك صلاحية الوصول إلى هذا الصف.",
  );
}

/** Ids of students enrolled in any class the teacher manages (admins: all). */
export async function studentIdsForTeacher(
  ctx: Ctx,
  profile: Profile,
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (profile.role === ROLES.SUPER_ADMIN) {
    const profiles = await ctx.db.query("profiles").collect();
    for (const p of profiles) {
      if (p.role === ROLES.STUDENT) ids.add(p.userId as string);
    }
    return ids;
  }
  const classIds = await classIdsForTeacher(ctx, profile.userId);
  for (const classId of classIds) {
    const enrollments = await ctx.db
      .query("class_enrollments")
      .withIndex("by_class", (q) => q.eq("classId", classId as Id<"classes">))
      .collect();
    for (const e of enrollments) {
      if (e.status === "active") ids.add(e.studentId as string);
    }
  }
  return ids;
}

/* -------------------------------------------------------------------------- */
/* Assessment scoping                                                         */
/* -------------------------------------------------------------------------- */

export async function assertAssessmentOwner(
  ctx: Ctx,
  profile: Profile,
  assessmentId: Id<"assessments">,
): Promise<Doc<"assessments">> {
  const assessment = await ctx.db.get(assessmentId);
  if (!assessment) {
    deny(ERROR_CODES.NOT_FOUND, "Assessment not found.", "لم يتم العثور على التقييم.");
  }
  if (profile.role === ROLES.SUPER_ADMIN) return assessment;
  if (
    profile.role === ROLES.TEACHER &&
    assessment.ownerId === profile.userId
  ) {
    return assessment;
  }
  deny(
    ERROR_CODES.FORBIDDEN,
    "This assessment belongs to another teacher.",
    "هذا التقييم يخص معلماً آخر.",
  );
}

/**
 * A student may only see an assessment they were assigned individually or
 * through an enrolled class. Knowing the URL is never enough.
 */
export async function isStudentAssigned(
  ctx: Ctx,
  assessmentId: Id<"assessments">,
  studentId: Id<"users">,
): Promise<boolean> {
  const direct = await ctx.db
    .query("assessment_students")
    .withIndex("by_assessment_student", (q) =>
      q.eq("assessmentId", assessmentId).eq("studentId", studentId),
    )
    .first();
  if (direct) return true;

  const enrollments = await ctx.db
    .query("class_enrollments")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  const activeClassIds = enrollments
    .filter((e) => e.status === "active")
    .map((e) => e.classId);
  if (activeClassIds.length === 0) return false;

  const assignments = await ctx.db
    .query("assessment_assignments")
    .withIndex("by_assessment", (q) => q.eq("assessmentId", assessmentId))
    .collect();
  return assignments.some((a) => activeClassIds.includes(a.classId));
}

/* -------------------------------------------------------------------------- */
/* Audit log                                                                  */
/* -------------------------------------------------------------------------- */

export async function logAudit(
  ctx: MutationCtx,
  entry: {
    actor?: { userId: Id<"users">; name: string; role: Role } | null;
    action: string;
    entity: string;
    entityId?: string;
    summaryEn: string;
    summaryAr: string;
    details?: unknown;
  },
): Promise<void> {
  await ctx.db.insert("audit_logs", {
    actorId: entry.actor?.userId,
    actorName: entry.actor?.name,
    actorRole: entry.actor?.role,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    summaryEn: entry.summaryEn,
    summaryAr: entry.summaryAr,
    details:
      entry.details === undefined ? undefined : JSON.stringify(entry.details),
    createdAt: Date.now(),
  });
}

/* -------------------------------------------------------------------------- */
/* Platform settings                                                          */
/* -------------------------------------------------------------------------- */

export const DEFAULT_GRADING_SCALE = [
  { letter: "A", minPercent: 90, labelEn: "Excellent", labelAr: "ممتاز" },
  { letter: "B", minPercent: 80, labelEn: "Very good", labelAr: "جيد جداً" },
  { letter: "C", minPercent: 70, labelEn: "Good", labelAr: "جيد" },
  { letter: "D", minPercent: 60, labelEn: "Pass", labelAr: "مقبول" },
  { letter: "F", minPercent: 0, labelEn: "Needs work", labelAr: "يحتاج تحسيناً" },
];

export type PlatformSettings = Doc<"platform_settings">;

export async function getSettingsRow(
  ctx: Ctx,
): Promise<PlatformSettings | null> {
  return await ctx.db.query("platform_settings").first();
}

export function defaultsForSettings() {
  return {
    schoolNameEn: "Noqta Academy",
    schoolNameAr: "أكاديمية نُقطة",
    defaultLanguage: "en" as const,
    gradingScale: DEFAULT_GRADING_SCALE,
    defaultPassThreshold: 60,
    defaultDurationMinutes: 30,
    gamificationEnabled: true,
    leaderboardsEnabled: false,
    notificationsEnabled: true,
    demoDataLoaded: false,
    landingEnabled: true,
    landingSections: {
      features: true,
      demo: true,
      games: true,
      steps: true,
      stats: true,
    },
  };
}

export function gradeLetterFor(
  percentage: number,
  scale: { letter: string; minPercent: number }[],
): string {
  const sorted = [...scale].sort((a, b) => b.minPercent - a.minPercent);
  for (const band of sorted) {
    if (percentage >= band.minPercent) return band.letter;
  }
  return sorted.length > 0 ? sorted[sorted.length - 1].letter : "-";
}

export function dayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}
