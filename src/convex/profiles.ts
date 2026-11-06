import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  ERROR_CODES,
  deny,
  getProfile,
  getSettingsRow,
  logAudit,
  requireProfile,
} from "./lib/guards";
import { DEMO_ACCOUNTS } from "./lib/demoAccounts";
import { notifyUser } from "./lib/notify";
import { languageValidator, ROLES } from "./schema";

/**
 * Public status endpoint used by the landing page and the auth screen.
 * It only exposes aggregate numbers and whether the platform still needs its
 * first administrator — no personal data.
 */
export const platformStatus = query({
  args: {},
  handler: async (ctx) => {
    const settings = await getSettingsRow(ctx);
    const uploadedLogo = settings?.logoStorageId
      ? await ctx.storage.getUrl(settings.logoStorageId)
      : null;
    const profiles = await ctx.db.query("profiles").collect();
    const hasAdmin = profiles.some((p) => p.role === ROLES.SUPER_ADMIN);
    const admins = profiles.filter((p) => p.role === ROLES.SUPER_ADMIN).length;
    const teachers = profiles.filter((p) => p.role === ROLES.TEACHER).length;
    const students = profiles.filter((p) => p.role === ROLES.STUDENT).length;
    const assessments = await ctx.db.query("assessments").collect();
    return {
      initialized: profiles.length > 0,
      needsBootstrap: !hasAdmin,
      demoAccountsEnabled: settings?.demoAccountsEnabled ?? false,
      demoDataLoaded: settings?.demoDataLoaded ?? false,
      // Only exposed while the admin has the labelled demo sandbox switched on.
      demoAccounts:
        settings?.demoAccountsEnabled === true
          ? DEMO_ACCOUNTS.map((account) => ({
              role: account.role,
              email: account.email,
              password: account.password,
            }))
          : [],
      settings: {
        schoolNameEn: settings?.schoolNameEn ?? "Noqta Academy",
        schoolNameAr: settings?.schoolNameAr ?? "أكاديمية نُقطة",
        logoUrl: uploadedLogo ?? settings?.logoUrl,
        taglineEn: settings?.taglineEn ?? null,
        taglineAr: settings?.taglineAr ?? null,
        brandPrimary: settings?.brandPrimary ?? null,
        brandAccent: settings?.brandAccent ?? null,
        // Deterrent only: browsers cannot block OS-level screenshots.
        contentProtectionEnabled: settings?.contentProtectionEnabled ?? true,
        defaultLanguage: settings?.defaultLanguage ?? "en",
        gamificationEnabled: settings?.gamificationEnabled ?? true,
        leaderboardsEnabled: settings?.leaderboardsEnabled ?? false,
        // AdSense identifiers are public by design (they ship in the page
        // source), so exposing them here is safe. Ads only render when the
        // admin switched them on AND a publisher ID is configured.
        adsEnabled: settings?.adsEnabled ?? false,
        adsensePublisherId: settings?.adsensePublisherId ?? null,
        adsenseSlotId: settings?.adsenseSlotId ?? null,
      },
      // Real counts read from the database — never invented.
      counts: {
        admins,
        teachers,
        students,
        assessments: assessments.length,
        published: assessments.filter((a) => a.status === "published").length,
      },
    };
  },
});

/** Auth state + role, usable before a profile exists (onboarding screens). */
export const myAccount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { signedIn: false, hasProfile: false } as const;
    const profile = await getProfile(ctx, userId);
    if (!profile) {
      const user = await ctx.db.get(userId);
      return {
        signedIn: true,
        hasProfile: false,
        email: user?.email ?? "",
        name: user?.name ?? "",
      } as const;
    }
    return { signedIn: true, hasProfile: true, profile } as const;
  },
});

/** Update display name / language / theme preference of the signed-in user. */
export const updateMyProfile = mutation({
  args: {
    name: v.optional(v.string()),
    language: v.optional(languageValidator),
    theme: v.optional(
      v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
    ),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length < 2 || name.length > 80) {
        deny(ERROR_CODES.INVALID, "Name must be 2 to 80 characters.", "الاسم يجب أن يكون بين حرفين و80 حرفاً.");
      }
      patch.name = name;
    }
    if (args.language !== undefined) patch.language = args.language;
    if (args.theme !== undefined) patch.theme = args.theme;
    await ctx.db.patch(profile._id, patch);
    if (args.name !== undefined) {
      await ctx.db.patch(profile.userId, { name: args.name.trim() });
    }
    return { ok: true };
  },
});

function generateJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export const generateJoinCodeValue = generateJoinCode;

/**
 * Student self-registration. Accounts are *controlled*: a student can only
 * finish onboarding with a class join code (or an invite code) issued by a
 * teacher or administrator.
 */
export const completeStudentRegistration = mutation({
  args: {
    name: v.string(),
    classCode: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      deny(ERROR_CODES.UNAUTHENTICATED, "Sign in first.", "سجّل الدخول أولاً.");
    }
    const existing = await getProfile(ctx, userId);
    if (existing) {
      deny(
        ERROR_CODES.CONFLICT,
        "This account already has a role.",
        "هذا الحساب مرتبط بدور بالفعل.",
      );
    }
    const name = args.name.trim();
    if (name.length < 2) {
      deny(ERROR_CODES.INVALID, "Enter your full name.", "أدخل اسمك الكامل.");
    }
    const code = args.classCode.trim().toUpperCase();
    const cls = await ctx.db
      .query("classes")
      .withIndex("by_join_code", (q) => q.eq("joinCode", code))
      .first();
    if (!cls || cls.archivedAt !== undefined) {
      deny(
        ERROR_CODES.NOT_FOUND,
        "That class code is not valid. Ask your teacher for the current code.",
        "رمز الصف غير صالح. اطلب من معلمك الرمز الحالي.",
      );
    }
    const user = await ctx.db.get(userId);
    const email = user?.email ?? "";
    const now = Date.now();
    await ctx.db.insert("profiles", {
      userId,
      name,
      email,
      role: ROLES.STUDENT,
      status: "active",
      language: args.language,
      theme: "system",
      isDemo: false,
      points: 0,
      streak: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(userId, { role: ROLES.STUDENT, name });
    await ctx.db.insert("class_enrollments", {
      classId: cls._id,
      studentId: userId,
      status: "active",
      enrolledAt: now,
    });
    await logAudit(ctx, {
      actor: { userId, name, role: ROLES.STUDENT },
      action: "student.register",
      entity: "class",
      entityId: cls._id as string,
      summaryEn: `Student ${name} joined class ${cls.nameEn} with a join code.`,
      summaryAr: `انضم الطالب ${name} إلى صف ${cls.nameAr} باستخدام رمز الصف.`,
    });
    if (cls.homeroomTeacherId) {
      await notifyUser(ctx, cls.homeroomTeacherId, {
        type: "announcement",
        titleEn: "New student enrolled",
        titleAr: "طالب جديد في الصف",
        bodyEn: `${name} joined ${cls.nameEn}.`,
        bodyAr: `${name} انضم إلى ${cls.nameAr}.`,
        link: "/teacher/students",
      });
    }
    return { ok: true, role: ROLES.STUDENT as string, classId: cls._id };
  },
});

/** Redeem an invite code (students or additional teachers). */
export const redeemInviteCode = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      deny(ERROR_CODES.UNAUTHENTICATED, "Sign in first.", "سجّل الدخول أولاً.");
    }
    const existing = await getProfile(ctx, userId);
    if (existing) {
      deny(ERROR_CODES.CONFLICT, "This account already has a role.", "هذا الحساب مرتبط بدور بالفعل.");
    }
    const invite = await ctx.db
      .query("invite_codes")
      .withIndex("by_code", (q) => q.eq("code", args.code.trim().toUpperCase()))
      .first();
    if (!invite || invite.revoked || invite.uses >= invite.maxUses) {
      deny(ERROR_CODES.NOT_FOUND, "That invite code cannot be used.", "رمز الدعوة غير صالح للاستخدام.");
    }
    const name = args.name.trim();
    if (name.length < 2) {
      deny(ERROR_CODES.INVALID, "Enter your full name.", "أدخل اسمك الكامل.");
    }
    const user = await ctx.db.get(userId);
    const now = Date.now();
    await ctx.db.insert("profiles", {
      userId,
      name,
      email: user?.email ?? "",
      role: invite.role,
      status: "active",
      language: args.language,
      theme: "system",
      isDemo: false,
      points: 0,
      streak: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(userId, { role: invite.role, name });
    await ctx.db.patch(invite._id, { uses: invite.uses + 1 });
    if (invite.role === ROLES.STUDENT && invite.classId) {
      await ctx.db.insert("class_enrollments", {
        classId: invite.classId,
        studentId: userId,
        status: "active",
        enrolledAt: now,
      });
    }
    await logAudit(ctx, {
      actor: { userId, name, role: invite.role },
      action: "account.redeem_invite",
      entity: "invite_codes",
      entityId: invite._id as string,
      summaryEn: `${name} registered as ${invite.role} with an invite code.`,
      summaryAr: `${name} سجّل حساباً بدور ${invite.role} عبر رمز دعوة.`,
    });
    return { ok: true, role: invite.role as string };
  },
});

export const createInviteCode = mutation({
  args: {
    role: v.union(v.literal("student"), v.literal("teacher")),
    classId: v.optional(v.id("classes")),
    maxUses: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireProfile(ctx);
    if (profile.role === ROLES.STUDENT) {
      deny(ERROR_CODES.FORBIDDEN, "Students cannot create invite codes.", "لا يمكن للطلاب إنشاء رموز دعوة.");
    }
    if (args.maxUses < 1 || args.maxUses > 200) {
      deny(ERROR_CODES.INVALID, "Max uses must be between 1 and 200.", "عدد الاستخدامات يجب أن يكون بين 1 و200.");
    }
    let classId: Id<"classes"> | undefined;
    if (args.classId) {
      const cls = await ctx.db.get(args.classId);
      if (!cls) deny(ERROR_CODES.NOT_FOUND, "Class not found.", "لم يتم العثور على الصف.");
      if (
        profile.role === ROLES.TEACHER &&
        cls.homeroomTeacherId !== userId
      ) {
        const link = await ctx.db
          .query("teacher_assignments")
          .withIndex("by_teacher_class_subject", (q) =>
            q.eq("teacherId", userId).eq("classId", args.classId!),
          )
          .first();
        if (!link) {
          deny(ERROR_CODES.FORBIDDEN, "You do not teach this class.", "أنت لا تدرّس هذا الصف.");
        }
      }
      classId = args.classId;
    }
    const code = generateJoinCode();
    await ctx.db.insert("invite_codes", {
      code,
      role: args.role,
      classId,
      createdBy: userId,
      maxUses: args.maxUses,
      uses: 0,
      revoked: false,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "invite.create",
      entity: "invite_codes",
      entityId: code,
      summaryEn: `Created a ${args.role} invite code (${args.maxUses} uses).`,
      summaryAr: `تم إنشاء رمز دعوة لدور ${args.role} (${args.maxUses} استخدامات).`,
    });
    return { code };
  },
});

export const myInviteCodes = query({
  args: {},
  handler: async (ctx) => {
    const { userId, profile } = await requireProfile(ctx);
    if (profile.role === ROLES.STUDENT) return [];
    const all = await ctx.db.query("invite_codes").collect();
    const mine =
      profile.role === ROLES.SUPER_ADMIN
        ? all
        : all.filter((c) => c.createdBy === userId);
    return mine.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
  },
});
