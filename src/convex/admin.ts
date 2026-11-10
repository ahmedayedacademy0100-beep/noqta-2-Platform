import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  DEFAULT_GRADING_SCALE,
  ERROR_CODES,
  defaultsForSettings,
  deny,
  getProfile,
  getSettingsRow,
  logAudit,
  requireRole,
} from "./lib/guards";
import { notifyMany } from "./lib/notify";
import { languageValidator, ROLES, roleValidator } from "./schema";

/* -------------------------------------------------------------------------- */
/* Internals used by the action layer (account provisioning / passwords)       */
/* -------------------------------------------------------------------------- */

export const profileFor = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await getProfile(ctx, args.userId);
    if (!profile) return null;
    return {
      userId: profile.userId,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      status: profile.status,
    };
  },
});

/**
 * CLI-only maintenance hook (never callable from the app): turns the landing
 * page sections on or off without opening a browser session.
 */
export const setLandingSectionsInternal = internalMutation({
  args: {
    features: v.boolean(),
    demo: v.boolean(),
    games: v.boolean(),
    steps: v.boolean(),
    stats: v.boolean(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("platform_settings").first();
    if (!settings) return { ok: false, reason: "no-settings" };
    await ctx.db.patch(settings._id, { landingSections: args });
    return { ok: true };
  },
});

export const recordPasswordReset = internalMutation({
  args: { actorId: v.id("users"), targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const actor = await getProfile(ctx, args.actorId);
    const target = await getProfile(ctx, args.targetUserId);
    if (!actor || actor.role !== ROLES.SUPER_ADMIN) {
      deny(ERROR_CODES.FORBIDDEN, "Not allowed.", "غير مسموح.");
    }
    await logAudit(ctx, {
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: "user.reset_password",
      entity: "users",
      entityId: args.targetUserId as string,
      summaryEn: `Reset the password of ${target?.name ?? "a user"}.`,
      summaryAr: `تمت إعادة تعيين كلمة مرور ${target?.name ?? "مستخدم"}.`,
    });
  },
});

/* -------------------------------------------------------------------------- */
/* Overview + reports                                                         */
/* -------------------------------------------------------------------------- */

export const overview = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    const windowDays = Math.min(Math.max(args.days ?? 30, 7), 180);
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;

    const [profiles, classes, subjects, grades, assessments, attempts, audit] =
      await Promise.all([
        ctx.db.query("profiles").collect(),
        ctx.db.query("classes").collect(),
        ctx.db.query("subjects").collect(),
        ctx.db.query("grades").collect(),
        ctx.db.query("assessments").collect(),
        ctx.db.query("attempts").collect(),
        ctx.db.query("audit_logs").collect(),
      ]);

    const buckets = new Map<string, { day: string; submissions: number; signups: number; activity: number }>();
    for (let i = windowDays - 1; i >= 0; i -= 1) {
      const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      buckets.set(day, { day, submissions: 0, signups: 0, activity: 0 });
    }
    const bump = (
      timestamp: number | undefined,
      field: "submissions" | "signups" | "activity",
    ) => {
      if (!timestamp || timestamp < cutoff) return;
      const day = new Date(timestamp).toISOString().slice(0, 10);
      const bucket = buckets.get(day);
      if (bucket) bucket[field] += 1;
    };
    for (const attempt of attempts) {
      bump(attempt.submittedAt ?? attempt.startedAt, "submissions");
      bump(attempt.startedAt, "activity");
    }
    for (const profile of profiles) bump(profile.createdAt, "signups");
    for (const entry of audit) bump(entry.createdAt, "activity");

    const subjectById = new Map(subjects.map((s) => [s._id as string, s]));
    const subjectBreakdown = subjects
      .map((subject) => {
        const subjectAssessments = assessments.filter(
          (a) => a.subjectId === subject._id,
        );
        const ids = new Set(subjectAssessments.map((a) => a._id as string));
        const subjectAttempts = attempts.filter((a) =>
          ids.has(a.assessmentId as string),
        );
        const graded = subjectAttempts.filter((a) => a.status === "graded");
        return {
          subjectId: subject._id,
          nameEn: subject.nameEn,
          nameAr: subject.nameAr,
          color: subject.color,
          assessments: subjectAssessments.length,
          submissions: subjectAttempts.filter((a) => a.submittedAt).length,
          averagePercent:
            graded.length === 0
              ? null
              : Math.round(
                  (graded.reduce((sum, a) => sum + a.percentage, 0) /
                    graded.length) *
                    100,
                ) / 100,
        };
      })
      .sort((a, b) => b.submissions - a.submissions);

    const byOwner = new Map<
      string,
      { ownerId: string; name: string; assessments: number; submissions: number }
    >();
    for (const assessment of assessments) {
      const key = assessment.ownerId as string;
      const owner = profiles.find((p) => p.userId === assessment.ownerId);
      const entry =
        byOwner.get(key) ??
        {
          ownerId: key,
          name: owner?.name ?? "—",
          assessments: 0,
          submissions: 0,
        };
      entry.assessments += 1;
      entry.submissions += attempts.filter(
        (a) => a.assessmentId === assessment._id && a.submittedAt,
      ).length;
      byOwner.set(key, entry);
    }

    const graded = attempts.filter((a) => a.status === "graded");
    return {
      windowDays,
      counts: {
        users: profiles.length,
        students: profiles.filter((p) => p.role === ROLES.STUDENT).length,
        teachers: profiles.filter((p) => p.role === ROLES.TEACHER).length,
        admins: profiles.filter((p) => p.role === ROLES.SUPER_ADMIN).length,
        suspended: profiles.filter((p) => p.status === "suspended").length,
        demoAccounts: profiles.filter((p) => p.isDemo).length,
        classes: classes.filter((c) => c.archivedAt === undefined).length,
        subjects: subjects.length,
        grades: grades.length,
        assessments: assessments.length,
        published: assessments.filter((a) => a.status === "published").length,
        drafts: assessments.filter((a) => a.status === "draft").length,
        submissions: attempts.filter((a) => a.submittedAt).length,
        inProgress: attempts.filter((a) => a.status === "in_progress").length,
        awaitingGrading: attempts.filter((a) => a.pendingManualCount > 0).length,
        averagePercent:
          graded.length === 0
            ? null
            : Math.round(
                (graded.reduce((sum, a) => sum + a.percentage, 0) /
                  graded.length) *
                  100,
              ) / 100,
        auditEntries: audit.length,
      },
      series: [...buckets.values()],
      subjectBreakdown,
      teacherBreakdown: [...byOwner.values()].sort(
        (a, b) => b.submissions - a.submissions,
      ),
      recentAudit: audit
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 8)
        .map((entry) => ({
          _id: entry._id,
          action: entry.action,
          entity: entry.entity,
          actorName: entry.actorName ?? "system",
          summaryEn: entry.summaryEn,
          summaryAr: entry.summaryAr,
          createdAt: entry.createdAt,
        })),
      subjectNames: subjectBreakdown.map((s) => subjectById.get(s.subjectId as string)?.nameEn ?? ""),
    };
  },
});

/* -------------------------------------------------------------------------- */
/* User management                                                            */
/* -------------------------------------------------------------------------- */

export const users = query({
  args: {
    search: v.optional(v.string()),
    role: v.optional(roleValidator),
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"))),
    includeDemo: v.optional(v.boolean()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    const pageSize = Math.min(Math.max(args.pageSize ?? 20, 5), 100);
    const page = Math.max(args.page ?? 0, 0);

    const all = await ctx.db.query("profiles").collect();
    const search = args.search?.trim().toLowerCase();
    const filtered = all
      .filter((p) => (args.role ? p.role === args.role : true))
      .filter((p) => (args.status ? p.status === args.status : true))
      .filter((p) => (args.includeDemo === false ? !p.isDemo : true))
      .filter((p) =>
        search
          ? p.name.toLowerCase().includes(search) ||
            p.email.toLowerCase().includes(search)
          : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    const slice = filtered.slice(page * pageSize, page * pageSize + pageSize);
    const rows = await Promise.all(
      slice.map(async (profile) => {
        const enrollments = await ctx.db
          .query("class_enrollments")
          .withIndex("by_student", (q) => q.eq("studentId", profile.userId))
          .collect();
        const classIds = enrollments
          .filter((e) => e.status === "active")
          .map((e) => e.classId);
        const classRows = await Promise.all(
          classIds.map(async (id) => await ctx.db.get(id)),
        );
        const teaching = await ctx.db
          .query("teacher_assignments")
          .withIndex("by_teacher", (q) => q.eq("teacherId", profile.userId))
          .collect();
        return {
          _id: profile._id,
          userId: profile.userId,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          status: profile.status,
          language: profile.language,
          isDemo: profile.isDemo,
          points: profile.points,
          createdAt: profile.createdAt,
          lastActiveDay: profile.lastActiveDay,
          classNames: classRows
            .filter((c): c is NonNullable<typeof c> => c !== null)
            .map((c) => c.nameEn),
          teachingCount: teaching.length,
        };
      }),
    );

    return {
      rows,
      total: filtered.length,
      page,
      pageSize,
      hasMore: (page + 1) * pageSize < filtered.length,
    };
  },
});

export const setUserRole = mutation({
  args: { userId: v.id("users"), role: roleValidator },
  handler: async (ctx, args) => {
    const { userId: actorId, profile: actor } = await requireRole(ctx, [
      ROLES.SUPER_ADMIN,
    ]);
    const target = await getProfile(ctx, args.userId);
    if (!target) {
      deny(ERROR_CODES.NOT_FOUND, "User not found.", "لم يتم العثور على المستخدم.");
    }
    if (target.role === ROLES.SUPER_ADMIN && args.role !== ROLES.SUPER_ADMIN) {
      const admins = await ctx.db
        .query("profiles")
        .withIndex("by_role", (q) => q.eq("role", ROLES.SUPER_ADMIN))
        .collect();
      if (admins.length <= 1) {
        deny(
          ERROR_CODES.CONFLICT,
          "You cannot remove the last super admin.",
          "لا يمكن إزالة آخر مسؤول للمنصة.",
        );
      }
    }
    if (args.userId === actorId && args.role !== ROLES.SUPER_ADMIN) {
      deny(
        ERROR_CODES.CONFLICT,
        "You cannot change your own role.",
        "لا يمكنك تغيير دورك بنفسك.",
      );
    }
    await ctx.db.patch(target._id, { role: args.role, updatedAt: Date.now() });
    await ctx.db.patch(args.userId, { role: args.role });
    await logAudit(ctx, {
      actor: { userId: actorId, name: actor.name, role: actor.role },
      action: "user.role_change",
      entity: "profiles",
      entityId: args.userId as string,
      summaryEn: `${target.name}: role changed from ${target.role} to ${args.role}.`,
      summaryAr: `${target.name}: تم تغيير الدور من ${target.role} إلى ${args.role}.`,
      details: { from: target.role, to: args.role },
    });
    return { ok: true };
  },
});

export const setUserStatus = mutation({
  args: {
    userId: v.id("users"),
    status: v.union(v.literal("active"), v.literal("suspended")),
  },
  handler: async (ctx, args) => {
    const { userId: actorId, profile: actor } = await requireRole(ctx, [
      ROLES.SUPER_ADMIN,
    ]);
    const target = await getProfile(ctx, args.userId);
    if (!target) {
      deny(ERROR_CODES.NOT_FOUND, "User not found.", "لم يتم العثور على المستخدم.");
    }
    if (args.userId === actorId) {
      deny(ERROR_CODES.CONFLICT, "You cannot suspend your own account.", "لا يمكنك إيقاف حسابك الخاص.");
    }
    if (target.role === ROLES.SUPER_ADMIN && args.status === "suspended") {
      const admins = await ctx.db
        .query("profiles")
        .withIndex("by_role", (q) => q.eq("role", ROLES.SUPER_ADMIN))
        .collect();
      if (admins.filter((a) => a.status === "active").length <= 1) {
        deny(ERROR_CODES.CONFLICT, "Keep one active super admin.", "يجب الإبقاء على مسؤول نشط واحد على الأقل.");
      }
    }
    await ctx.db.patch(target._id, { status: args.status, updatedAt: Date.now() });
    await logAudit(ctx, {
      actor: { userId: actorId, name: actor.name, role: actor.role },
      action:
        args.status === "active" ? "user.activate" : "user.suspend",
      entity: "profiles",
      entityId: args.userId as string,
      summaryEn: `${target.name} set to ${args.status}.`,
      summaryAr: `تم تعيين حالة ${target.name} إلى ${args.status}.`,
    });
    return { ok: true };
  },
});

export const setUserLanguage = mutation({
  args: { userId: v.id("users"), language: languageValidator },
  handler: async (ctx, args) => {
    const { userId: actorId, profile: actor } = await requireRole(ctx, [
      ROLES.SUPER_ADMIN,
    ]);
    const target = await getProfile(ctx, args.userId);
    if (!target) deny(ERROR_CODES.NOT_FOUND, "User not found.", "لم يتم العثور على المستخدم.");
    await ctx.db.patch(target._id, { language: args.language, updatedAt: Date.now() });
    await logAudit(ctx, {
      actor: { userId: actorId, name: actor.name, role: actor.role },
      action: "user.language",
      entity: "profiles",
      entityId: args.userId as string,
      summaryEn: `Set ${target.name}'s interface language to ${args.language}.`,
      summaryAr: `تم تعيين لغة واجهة ${target.name} إلى ${args.language}.`,
    });
    return { ok: true };
  },
});

export const broadcastAnnouncement = mutation({
  args: {
    titleEn: v.string(),
    titleAr: v.string(),
    bodyEn: v.optional(v.string()),
    bodyAr: v.optional(v.string()),
    audience: v.union(
      v.literal("all"),
      v.literal("students"),
      v.literal("teachers"),
    ),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    if (!args.titleEn.trim() || !args.titleAr.trim()) {
      deny(ERROR_CODES.INVALID, "Both language titles are required.", "عنوان بالعربية والإنجليزية مطلوب.");
    }
    const all = await ctx.db.query("profiles").collect();
    const targets = all.filter((p) => {
      if (args.audience === "all") return true;
      if (args.audience === "students") return p.role === ROLES.STUDENT;
      return p.role === ROLES.TEACHER;
    });
    const sent = await notifyMany(
      ctx,
      targets.map((t) => t.userId),
      {
        type: "announcement",
        titleEn: args.titleEn.trim(),
        titleAr: args.titleAr.trim(),
        bodyEn: args.bodyEn,
        bodyAr: args.bodyAr,
        link: "/notifications",
      },
    );
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "announcement.broadcast",
      entity: "notifications",
      summaryEn: `Broadcast an announcement to ${sent} accounts.`,
      summaryAr: `تم إرسال إعلان إلى ${sent} حساباً.`,
      details: args,
    });
    return { sent };
  },
});

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Settings for a platform that has no row yet (never bootstrapped, or reset by
 * `resetAllUsers`). The admin screen must stay usable in that state instead of
 * failing with "not found", so defaults are served and the first save creates
 * the row.
 */
function settingsFallback(): Omit<Doc<"platform_settings">, "_id" | "_creationTime"> {
  return {
    ...defaultsForSettings(),
    gradingScale: [...DEFAULT_GRADING_SCALE],
    demoAccountsEnabled: false,
    contentProtectionEnabled: true,
    updatedAt: 0,
  };
}

export const updateSettings = mutation({
  args: {
    schoolNameEn: v.optional(v.string()),
    schoolNameAr: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    /** `null` clears the uploaded logo; a storage id replaces it. */
    logoStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    taglineEn: v.optional(v.string()),
    taglineAr: v.optional(v.string()),
    brandPrimary: v.optional(v.string()),
    brandAccent: v.optional(v.string()),
    contentProtectionEnabled: v.optional(v.boolean()),
    defaultLanguage: v.optional(languageValidator),
    defaultPassThreshold: v.optional(v.number()),
    defaultDurationMinutes: v.optional(v.number()),
    gamificationEnabled: v.optional(v.boolean()),
    leaderboardsEnabled: v.optional(v.boolean()),
    notificationsEnabled: v.optional(v.boolean()),
    adsEnabled: v.optional(v.boolean()),
    adsensePublisherId: v.optional(v.string()),
    adsenseSlotId: v.optional(v.string()),
    /* Public landing page */
    landingEnabled: v.optional(v.boolean()),
    landingHeadlineEn: v.optional(v.string()),
    landingHeadlineAr: v.optional(v.string()),
    landingSubtitleEn: v.optional(v.string()),
    landingSubtitleAr: v.optional(v.string()),
    landingCtaEn: v.optional(v.string()),
    landingCtaAr: v.optional(v.string()),
    /** Owner-edited questions for the four landing-page games. */
    landingGames: v.optional(
      v.object({
        memory: v.optional(v.array(v.object({ left: v.string(), right: v.string() }))),
        sprint: v.optional(
          v.array(
            v.object({
              promptEn: v.string(),
              promptAr: v.string(),
              options: v.array(v.object({ en: v.string(), ar: v.string() })),
              correct: v.number(),
            }),
          ),
        ),
        situations: v.optional(
          v.array(
            v.object({
              titleEn: v.string(),
              titleAr: v.string(),
              phrases: v.array(v.object({ en: v.string(), ar: v.string() })),
            }),
          ),
        ),
        daily: v.optional(v.array(v.object({ en: v.string(), ar: v.string() }))),
        sentence: v.optional(
          v.array(v.object({ sentenceEn: v.string(), sentenceAr: v.string() })),
        ),
        odd: v.optional(
          v.array(
            v.object({
              promptEn: v.string(),
              promptAr: v.string(),
              options: v.array(v.object({ en: v.string(), ar: v.string() })),
              correct: v.number(),
            }),
          ),
        ),
        gap: v.optional(
          v.array(
            v.object({
              sentenceEn: v.string(),
              sentenceAr: v.string(),
              options: v.array(v.object({ en: v.string(), ar: v.string() })),
              correct: v.number(),
            }),
          ),
        ),
      }),
    ),
    /** Owner-supplied artwork (image URL) for each landing game card. */
    landingGameImages: v.optional(
      v.object({
        memory: v.optional(v.string()),
        sprint: v.optional(v.string()),
        situations: v.optional(v.string()),
        daily: v.optional(v.string()),
        sentence: v.optional(v.string()),
        odd: v.optional(v.string()),
        gap: v.optional(v.string()),
      }),
    ),
    landingSections: v.optional(
      v.object({
        features: v.boolean(),
        demo: v.boolean(),
        games: v.boolean(),
        steps: v.boolean(),
        stats: v.boolean(),
      }),
    ),
    /** Owner-edited landing page copy (key = i18n key). */
    landingCopy: v.optional(
      v.array(v.object({ key: v.string(), en: v.string(), ar: v.string() })),
    ),
    gradingScale: v.optional(
      v.array(
        v.object({
          letter: v.string(),
          minPercent: v.number(),
          labelEn: v.string(),
          labelAr: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    let settings = await getSettingsRow(ctx);
    if (!settings) {
      // First save on a platform without a settings row: create it from the
      // defaults so the owner is never locked out of configuring the school.
      const insertedId = await ctx.db.insert("platform_settings", {
        ...settingsFallback(),
        updatedBy: userId,
      });
      settings = await ctx.db.get(insertedId);
      if (!settings) {
        deny(
          ERROR_CODES.INVALID,
          "Settings could not be created.",
          "تعذّر إنشاء إعدادات المنصة.",
        );
      }
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now(), updatedBy: userId };
    if (args.schoolNameEn !== undefined) {
      if (!args.schoolNameEn.trim()) {
        deny(ERROR_CODES.INVALID, "School name cannot be empty.", "اسم المدرسة لا يمكن أن يكون فارغاً.");
      }
      patch.schoolNameEn = args.schoolNameEn.trim();
    }
    if (args.schoolNameAr !== undefined) {
      if (!args.schoolNameAr.trim()) {
        deny(ERROR_CODES.INVALID, "School name cannot be empty.", "اسم المدرسة لا يمكن أن يكون فارغاً.");
      }
      patch.schoolNameAr = args.schoolNameAr.trim();
    }
    if (args.logoUrl !== undefined) patch.logoUrl = args.logoUrl.trim() || undefined;
    if (args.landingCopy !== undefined) {
      patch.landingCopy = args.landingCopy
        .map((entry) => ({
          key: entry.key.trim(),
          en: entry.en,
          ar: entry.ar,
        }))
        .filter((entry) => entry.key.length > 0);
    }
    if (args.logoStorageId !== undefined) {
      if (args.logoStorageId === null) {
        if (settings.logoStorageId) {
          await ctx.storage.delete(settings.logoStorageId).catch(() => undefined);
        }
        patch.logoStorageId = undefined;
        patch.logoUrl = undefined;
      } else {
        const url = await ctx.storage.getUrl(args.logoStorageId);
        if (!url) {
          deny(
            ERROR_CODES.INVALID,
            "That upload could not be found. Try uploading the logo again.",
            "لم يتم العثور على الملف المرفوع. أعد رفع الشعار.",
          );
        }
        if (settings.logoStorageId && settings.logoStorageId !== args.logoStorageId) {
          await ctx.storage.delete(settings.logoStorageId).catch(() => undefined);
        }
        patch.logoStorageId = args.logoStorageId;
      }
    }
    if (args.taglineEn !== undefined) patch.taglineEn = args.taglineEn.trim() || undefined;
    if (args.taglineAr !== undefined) patch.taglineAr = args.taglineAr.trim() || undefined;
    for (const [field, value] of [
      ["brandPrimary", args.brandPrimary],
      ["brandAccent", args.brandAccent],
    ] as const) {
      if (value === undefined) continue;
      const color = value.trim();
      if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
        deny(
          ERROR_CODES.INVALID,
          "Brand colors must be hex values such as #4169ff.",
          "ألوان الهوية يجب أن تكون بصيغة hex مثل #4169ff.",
        );
      }
      patch[field] = color || undefined;
    }
    if (args.contentProtectionEnabled !== undefined) {
      patch.contentProtectionEnabled = args.contentProtectionEnabled;
    }
    if (args.defaultLanguage !== undefined) patch.defaultLanguage = args.defaultLanguage;
    if (args.defaultPassThreshold !== undefined) {
      if (args.defaultPassThreshold < 0 || args.defaultPassThreshold > 100) {
        deny(ERROR_CODES.INVALID, "Pass threshold must be 0–100.", "نسبة النجاح يجب أن تكون بين ٠ و١٠٠.");
      }
      patch.defaultPassThreshold = args.defaultPassThreshold;
    }
    if (args.defaultDurationMinutes !== undefined) {
      if (args.defaultDurationMinutes < 1 || args.defaultDurationMinutes > 600) {
        deny(ERROR_CODES.INVALID, "Duration must be 1–600 minutes.", "المدة يجب أن تكون بين ١ و٦٠٠ دقيقة.");
      }
      patch.defaultDurationMinutes = args.defaultDurationMinutes;
    }
    if (args.gamificationEnabled !== undefined) patch.gamificationEnabled = args.gamificationEnabled;
    if (args.leaderboardsEnabled !== undefined) patch.leaderboardsEnabled = args.leaderboardsEnabled;
    if (args.notificationsEnabled !== undefined) patch.notificationsEnabled = args.notificationsEnabled;
    if (args.adsEnabled !== undefined) {
      if (args.adsEnabled && !(args.adsensePublisherId ?? settings.adsensePublisherId)) {
        deny(
          ERROR_CODES.INVALID,
          "Add your AdSense publisher ID before turning ads on.",
          "أضف معرّف الناشر في AdSense قبل تفعيل الإعلانات.",
        );
      }
      patch.adsEnabled = args.adsEnabled;
    }
    if (args.adsensePublisherId !== undefined) {
      const publisherId = args.adsensePublisherId.trim();
      if (publisherId && !/^ca-pub-\d{10,20}$/.test(publisherId)) {
        deny(
          ERROR_CODES.INVALID,
          "The publisher ID must look like ca-pub-0123456789012345.",
          "يجب أن يبدأ معرّف الناشر بـ ca-pub- متبوعاً بالأرقام.",
        );
      }
      patch.adsensePublisherId = publisherId || undefined;
    }
    if (args.adsenseSlotId !== undefined) {
      const slotId = args.adsenseSlotId.trim();
      if (slotId && !/^\d{1,10}$/.test(slotId)) {
        deny(
          ERROR_CODES.INVALID,
          "An ad unit slot ID is a number like 1234567890.",
          "معرّف الوحدة الإعلانية رقم مثل 1234567890.",
        );
      }
      patch.adsenseSlotId = slotId || undefined;
    }
    if (args.landingEnabled !== undefined) {
      patch.landingEnabled = args.landingEnabled;
    }
    for (const [field, value, max] of [
      ["landingHeadlineEn", args.landingHeadlineEn, 140],
      ["landingHeadlineAr", args.landingHeadlineAr, 140],
      ["landingSubtitleEn", args.landingSubtitleEn, 260],
      ["landingSubtitleAr", args.landingSubtitleAr, 260],
      ["landingCtaEn", args.landingCtaEn, 40],
      ["landingCtaAr", args.landingCtaAr, 40],
    ] as const) {
      if (value === undefined) continue;
      const text = value.trim();
      if (text.length > max) {
        deny(
          ERROR_CODES.INVALID,
          "That landing page text is too long.",
          "نص صفحة الهبوط أطول من المسموح.",
        );
      }
      patch[field] = text || undefined;
    }
    if (args.landingGames !== undefined) {
      const games = args.landingGames;
      patch.landingGames = {
        memory: (games.memory ?? [])
          .map((pair) => ({ left: pair.left.trim(), right: pair.right.trim() }))
          .filter((pair) => pair.left.length > 0 && pair.right.length > 0)
          .slice(0, 12),
        sprint: (games.sprint ?? [])
          .map((question) => {
            const options = question.options
              .map((option) => ({ en: option.en.trim(), ar: option.ar.trim() }))
              .filter((option) => option.en.length > 0 || option.ar.length > 0)
              .slice(0, 4);
            return {
              promptEn: question.promptEn.trim(),
              promptAr: question.promptAr.trim(),
              options,
              correct:
                question.correct >= 0 && question.correct < options.length ? question.correct : 0,
            };
          })
          .filter((question) => question.promptEn.length > 0 || question.promptAr.length > 0)
          .filter((question) => question.options.length >= 2)
          .slice(0, 20),
        situations: (games.situations ?? [])
          .map((situation) => ({
            titleEn: situation.titleEn.trim(),
            titleAr: situation.titleAr.trim(),
            phrases: situation.phrases
              .map((phrase) => ({ en: phrase.en.trim(), ar: phrase.ar.trim() }))
              .filter((phrase) => phrase.en.length > 0 && phrase.ar.length > 0)
              .slice(0, 8),
          }))
          .filter((situation) => situation.titleEn.length > 0 || situation.titleAr.length > 0)
          .filter((situation) => situation.phrases.length >= 2)
          .slice(0, 8),
        daily: (games.daily ?? [])
          .map((phrase) => ({ en: phrase.en.trim(), ar: phrase.ar.trim() }))
          .filter((phrase) => phrase.en.length > 0 && phrase.ar.length > 0)
          .slice(0, 40),
        sentence: (games.sentence ?? [])
          .map((item) => ({ sentenceEn: item.sentenceEn.trim(), sentenceAr: item.sentenceAr.trim() }))
          .filter((item) => item.sentenceEn.split(/\s+/).filter(Boolean).length >= 2)
          .slice(0, 20),
        odd: (games.odd ?? [])
          .map((item) => {
            const options = item.options
              .map((option) => ({ en: option.en.trim(), ar: option.ar.trim() }))
              .filter((option) => option.en.length > 0)
              .slice(0, 4);
            return {
              promptEn: item.promptEn.trim(),
              promptAr: item.promptAr.trim(),
              options,
              correct: item.correct >= 0 && item.correct < options.length ? item.correct : 0,
            };
          })
          .filter((item) => item.options.length >= 3)
          .slice(0, 20),
        gap: (games.gap ?? [])
          .map((item) => {
            const options = item.options
              .map((option) => ({ en: option.en.trim(), ar: option.ar.trim() }))
              .filter((option) => option.en.length > 0)
              .slice(0, 4);
            return {
              sentenceEn: item.sentenceEn.trim(),
              sentenceAr: item.sentenceAr.trim(),
              options,
              correct: item.correct >= 0 && item.correct < options.length ? item.correct : 0,
            };
          })
          .filter((item) => item.sentenceEn.length > 0 && item.options.length >= 2)
          .slice(0, 20),
      };
    }
    if (args.landingGameImages !== undefined) {
      const images = args.landingGameImages;
      const cleaned: Record<string, string | undefined> = {};
      for (const key of ["memory", "sprint", "situations", "daily", "sentence", "odd", "gap"] as const) {
        const value = (images[key] ?? "").trim();
        if (value.length > 800) {
          deny(
            ERROR_CODES.INVALID,
            "That image link is too long.",
            "رابط الصورة أطول من المسموح.",
          );
        }
        if (value && !/^https?:\/\//i.test(value)) {
          deny(
            ERROR_CODES.INVALID,
            "Image links must start with http:// or https://.",
            "رابط الصورة يجب أن يبدأ بـ http:// أو https://.",
          );
        }
        cleaned[key] = value || undefined;
      }
      patch.landingGameImages = cleaned;
    }
    if (args.landingSections !== undefined) {
      patch.landingSections = { ...args.landingSections };
    }
    if (args.gradingScale !== undefined) {
      if (args.gradingScale.length === 0) {
        deny(ERROR_CODES.INVALID, "The grading scale cannot be empty.", "سلم التقديرات لا يمكن أن يكون فارغاً.");
      }
      for (const band of args.gradingScale) {
        if (band.minPercent < 0 || band.minPercent > 100) {
          deny(ERROR_CODES.INVALID, "Grade bands must be 0–100.", "حدود التقدير يجب أن تكون بين ٠ و١٠٠.");
        }
      }
      patch.gradingScale = args.gradingScale;
    }
    await ctx.db.patch(settings._id, patch);
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "settings.update",
      entity: "platform_settings",
      entityId: settings._id as string,
      summaryEn: "Updated platform settings.",
      summaryAr: "تم تحديث إعدادات المنصة.",
      details: args,
    });
    return { ok: true };
  },
});

/* -------------------------------------------------------------------------- */
/* Audit log                                                                  */
/* -------------------------------------------------------------------------- */

export const auditLogs = query({
  args: {
    action: v.optional(v.string()),
    entity: v.optional(v.string()),
    actorId: v.optional(v.id("users")),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    const pageSize = Math.min(Math.max(args.pageSize ?? 25, 5), 100);
    const page = Math.max(args.page ?? 0, 0);
    const all = await ctx.db.query("audit_logs").collect();
    const filtered = all
      .filter((e) => (args.action ? e.action.includes(args.action) : true))
      .filter((e) => (args.entity ? e.entity === args.entity : true))
      .filter((e) => (args.actorId ? e.actorId === args.actorId : true))
      .sort((a, b) => b.createdAt - a.createdAt);
    return {
      rows: filtered.slice(page * pageSize, page * pageSize + pageSize),
      total: filtered.length,
      page,
      pageSize,
      hasMore: (page + 1) * pageSize < filtered.length,
      actions: [...new Set(all.map((e) => e.action))].sort(),
      entities: [...new Set(all.map((e) => e.entity))].sort(),
    };
  },
});

/* -------------------------------------------------------------------------- */
/* Global assessment oversight                                                */
/* -------------------------------------------------------------------------- */

export const assessmentsOversight = query({
  args: {
    search: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
    subjectId: v.optional(v.id("subjects")),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    const [assessments, subjects, attempts, profiles] = await Promise.all([
      ctx.db.query("assessments").collect(),
      ctx.db.query("subjects").collect(),
      ctx.db.query("attempts").collect(),
      ctx.db.query("profiles").collect(),
    ]);
    const search = args.search?.trim().toLowerCase();
    const rows = assessments
      .filter((a) => (args.ownerId ? a.ownerId === args.ownerId : true))
      .filter((a) => (args.subjectId ? a.subjectId === args.subjectId : true))
      .filter((a) =>
        args.status && args.status !== "all" ? a.status === args.status : true,
      )
      .filter((a) =>
        search
          ? a.titleEn.toLowerCase().includes(search) ||
            a.titleAr.includes(search)
          : true,
      )
      .map((assessment) => {
        const subject = subjects.find((s) => s._id === assessment.subjectId);
        const owner = profiles.find((p) => p.userId === assessment.ownerId);
        const related = attempts.filter(
          (t) => t.assessmentId === assessment._id,
        );
        const graded = related.filter((t) => t.status === "graded");
        return {
          _id: assessment._id,
          titleEn: assessment.titleEn,
          titleAr: assessment.titleAr,
          kind: assessment.kind,
          status: assessment.status,
          subjectNameEn: subject?.nameEn ?? "—",
          subjectNameAr: subject?.nameAr ?? "—",
          ownerId: assessment.ownerId,
          ownerName: owner?.name ?? "—",
          ownerIsDemo: owner?.isDemo ?? false,
          maxScore: assessment.maxScore,
          closeAt: assessment.closeAt,
          createdAt: assessment.createdAt,
          publishedAt: assessment.publishedAt,
          version: assessment.version,
          attempts: related.length,
          submissions: related.filter((t) => t.submittedAt).length,
          awaitingGrading: related.filter((t) => t.pendingManualCount > 0).length,
          averagePercent:
            graded.length === 0
              ? null
              : Math.round(
                  (graded.reduce((sum, t) => sum + t.percentage, 0) /
                    graded.length) *
                    100,
                ) / 100,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
    return {
      rows,
      teachers: profiles
        .filter((p) => p.role === ROLES.TEACHER)
        .map((p) => ({ userId: p.userId, name: p.name })),
      subjects: subjects.map((s) => ({
        _id: s._id,
        nameEn: s.nameEn,
        nameAr: s.nameAr,
      })),
    };
  },
});

/**
 * Admins can suspend or archive an assessment (for example after a reported
 * integrity issue) — this never rewrites submitted answers or historical
 * grades, it only stops further attempts.
 */
export const setAssessmentStatus = mutation({
  args: {
    assessmentId: v.id("assessments"),
    status: v.union(
      v.literal("published"),
      v.literal("closed"),
      v.literal("archived"),
    ),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) {
      deny(ERROR_CODES.NOT_FOUND, "Assessment not found.", "لم يتم العثور على التقييم.");
    }
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.status === "closed") patch.closedAt = Date.now();
    if (args.status === "archived") patch.archivedAt = Date.now();
    await ctx.db.patch(args.assessmentId, patch);
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "assessment.admin_status",
      entity: "assessments",
      entityId: args.assessmentId as string,
      summaryEn: `Admin set "${assessment.titleEn}" to ${args.status}.`,
      summaryAr: `قام المسؤول بتعيين "${assessment.titleAr}" إلى ${args.status}.`,
      details: { reason: args.reason, previous: assessment.status },
    });
    return { ok: true };
  },
});

/** Branding mutations the platform owner drives from Settings. */
export const generateBrandUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    return { uploadUrl: await ctx.storage.generateUploadUrl() };
  },
});

export const platformSettings = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    const settings = {
      ...settingsFallback(),
      ...((await getSettingsRow(ctx)) ?? {}),
    };
    const uploadedLogo = settings.logoStorageId
      ? await ctx.storage.getUrl(settings.logoStorageId)
      : null;
    return {
      role: profile.role,
      settings: { ...settings, logoUrl: uploadedLogo ?? settings.logoUrl },
    };
  },
});

/** Flat results export for the reports page (admin only, no secrets). */
export const resultsExport = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    const limit = Math.min(Math.max(args.limit ?? 2000, 100), 5000);
    const [attempts, assessments, subjects, profiles] = await Promise.all([
      ctx.db.query("attempts").collect(),
      ctx.db.query("assessments").collect(),
      ctx.db.query("subjects").collect(),
      ctx.db.query("profiles").collect(),
    ]);
    return attempts
      .sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))
      .slice(0, limit)
      .map((attempt) => {
        const assessment = assessments.find(
          (a) => a._id === attempt.assessmentId,
        );
        const student = profiles.find((p) => p.userId === attempt.studentId);
        const teacher = assessment
          ? profiles.find((p) => p.userId === assessment.ownerId)
          : undefined;
        const subject = assessment
          ? subjects.find((s) => s._id === assessment.subjectId)
          : undefined;
        return {
          attemptId: attempt._id,
          studentName: student?.name ?? "—",
          studentEmail: student?.email ?? "",
          assessmentEn: assessment?.titleEn ?? "—",
          assessmentAr: assessment?.titleAr ?? "—",
          subjectEn: subject?.nameEn ?? "—",
          teacherName: teacher?.name ?? "—",
          status: attempt.status,
          attemptNumber: attempt.attemptNumber,
          score: attempt.score,
          maxScore: attempt.maxScore,
          percentage: attempt.percentage,
          passed: attempt.passed ?? null,
          pendingManualCount: attempt.pendingManualCount,
          submittedAt: attempt.submittedAt ?? null,
          releasedAt: attempt.releasedAt ?? null,
        };
      });
  },
});

export type AdminUserRow = {
  userId: Id<"users">;
  name: string;
  email: string;
};
