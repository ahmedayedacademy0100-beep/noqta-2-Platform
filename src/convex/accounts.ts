import {
  createAccount,
  getAuthUserId,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation } from "./_generated/server";
import { ERROR_CODES, getProfile, logAudit } from "./lib/guards";
import { languageValidator, ROLES, roleValidator } from "./schema";

/**
 * Account provisioning.
 *
 * Creating a user needs an *action* context (Convex Auth writes through its own
 * internal mutation), so these live in an action and the profile is written by
 * the internal mutation below. Only a super admin can reach either of them.
 */

export const provisionProfile = internalMutation({
  args: {
    userId: v.id("users"),
    role: roleValidator,
    name: v.string(),
    email: v.string(),
    language: languageValidator,
    classId: v.optional(v.id("classes")),
    actorId: v.id("users"),
    isDemo: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        name: args.name,
        status: "active",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("profiles", {
        userId: args.userId,
        name: args.name,
        email: args.email,
        role: args.role,
        status: "active",
        language: args.language,
        theme: "system",
        isDemo: args.isDemo,
        points: 0,
        streak: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.patch(args.userId, { role: args.role, name: args.name });

    if (args.role === ROLES.STUDENT && args.classId) {
      const enrolled = await ctx.db
        .query("class_enrollments")
        .withIndex("by_class_student", (q) =>
          q.eq("classId", args.classId!).eq("studentId", args.userId),
        )
        .first();
      if (enrolled) {
        await ctx.db.patch(enrolled._id, { status: "active", enrolledAt: now });
      } else {
        await ctx.db.insert("class_enrollments", {
          classId: args.classId,
          studentId: args.userId,
          status: "active",
          enrolledAt: now,
          createdBy: args.actorId,
        });
      }
    }

    const actor = await ctx.db.get(args.actorId);
    await logAudit(ctx, {
      actor: actor
        ? {
            userId: actor._id,
            name: actor.name ?? actor.email ?? "admin",
            role: ROLES.SUPER_ADMIN,
          }
        : null,
      action: "user.create",
      entity: "users",
      entityId: args.userId as string,
      summaryEn: `Created ${args.role} account for ${args.name} (${args.email}).`,
      summaryAr: `تم إنشاء حساب ${args.role} للاسم ${args.name} (${args.email}).`,
    });
    return { userId: args.userId };
  },
});

export const createManagedUser = action({
  args: {
    role: roleValidator,
    name: v.string(),
    email: v.string(),
    password: v.string(),
    language: languageValidator,
    classId: v.optional(v.id("classes")),
    isDemo: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({
        code: ERROR_CODES.UNAUTHENTICATED,
        messageEn: "Sign in first.",
        messageAr: "سجّل الدخول أولاً.",
      });
    }
    const actorProfile = await ctx.runQuery(internal.admin.profileFor, {
      userId,
    });
    if (actorProfile?.role !== ROLES.SUPER_ADMIN) {
      throw new ConvexError({
        code: ERROR_CODES.FORBIDDEN,
        messageEn: "Only a super admin can create accounts.",
        messageAr: "يمكن لمسؤول المنصة فقط إنشاء الحسابات.",
      });
    }
    const email = args.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new ConvexError({
        code: ERROR_CODES.INVALID,
        messageEn: "Enter a valid email address.",
        messageAr: "أدخل بريداً إلكترونياً صالحاً.",
      });
    }
    if (args.password.length < 8) {
      throw new ConvexError({
        code: ERROR_CODES.INVALID,
        messageEn: "The temporary password must be at least 8 characters.",
        messageAr: "كلمة المرور المؤقتة يجب أن تكون ٨ أحرف على الأقل.",
      });
    }
    if (!/[A-Za-z0-9]/.test(args.password)) {
      throw new ConvexError({
        code: ERROR_CODES.INVALID,
        messageEn:
          "The temporary password must contain at least one letter or number.",
        messageAr: "كلمة المرور المؤقتة يجب أن تحتوي على حرف أو رقم على الأقل.",
      });
    }
    const name = args.name.trim();
    if (name.length < 2) {
      throw new ConvexError({
        code: ERROR_CODES.INVALID,
        messageEn: "Enter the user's full name.",
        messageAr: "أدخل الاسم الكامل للمستخدم.",
      });
    }

    let createdUserId: Id<"users">;
    try {
      const created = await createAccount(ctx, {
        provider: "password",
        account: { id: email, secret: args.password },
        profile: { email, name },
      });
      createdUserId = created.user._id as Id<"users">;
    } catch {
      const existing = await ctx.runQuery(internal.setup.findUserByEmail, {
        email,
      });
      if (!existing) {
        throw new ConvexError({
          code: ERROR_CODES.CONFLICT,
          messageEn: "That email address is already registered.",
          messageAr: "هذا البريد الإلكتروني مسجل بالفعل.",
        });
      }
      const existingProfile = await ctx.runQuery(
        internal.admin.profileFor,
        { userId: existing },
      );
      if (existingProfile) {
        throw new ConvexError({
          code: ERROR_CODES.CONFLICT,
          messageEn: "That email address already has an account.",
          messageAr: "هذا البريد الإلكتروني له حساب بالفعل.",
        });
      }
      createdUserId = existing;
    }

    await ctx.runMutation(internal.accounts.provisionProfile, {
      userId: createdUserId,
      role: args.role,
      name,
      email,
      language: args.language,
      classId: args.classId,
      actorId: userId,
      isDemo: args.isDemo ?? false,
    });

    return { userId: createdUserId };
  },
});

export const setPassword = action({
  args: {
    targetUserId: v.id("users"),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({
        code: ERROR_CODES.UNAUTHENTICATED,
        messageEn: "Sign in first.",
        messageAr: "سجّل الدخول أولاً.",
      });
    }
    const actorProfile = await ctx.runQuery(internal.admin.profileFor, {
      userId,
    });
    if (actorProfile?.role !== ROLES.SUPER_ADMIN) {
      throw new ConvexError({
        code: ERROR_CODES.FORBIDDEN,
        messageEn: "Only a super admin can reset passwords.",
        messageAr: "يمكن لمسؤول المنصة فقط إعادة تعيين كلمات المرور.",
      });
    }
    if (args.password.length < 8) {
      throw new ConvexError({
        code: ERROR_CODES.INVALID,
        messageEn: "The temporary password must be at least 8 characters.",
        messageAr: "كلمة المرور المؤقتة يجب أن تكون ٨ أحرف على الأقل.",
      });
    }
    if (!/[A-Za-z0-9]/.test(args.password)) {
      throw new ConvexError({
        code: ERROR_CODES.INVALID,
        messageEn:
          "The temporary password must contain at least one letter or number.",
        messageAr: "كلمة المرور المؤقتة يجب أن تحتوي على حرف أو رقم على الأقل.",
      });
    }
    const target = await ctx.runQuery(internal.admin.profileFor, {
      userId: args.targetUserId,
    });
    if (!target) {
      throw new ConvexError({
        code: ERROR_CODES.NOT_FOUND,
        messageEn: "User not found.",
        messageAr: "لم يتم العثور على المستخدم.",
      });
    }
    const targetEmail = target.email.trim().toLowerCase();
    // Update the existing password credential in place when there is one.
    // `createAccount` would refuse ("account already exists") or — for a user
    // whose email was never verified — create a brand-new user instead of
    // resetting the password, which orphans the original account.
    let passwordAccountExists = false;
    try {
      await modifyAccountCredentials(ctx, {
        provider: "password",
        account: { id: targetEmail, secret: args.password },
      });
      passwordAccountExists = true;
    } catch {
      passwordAccountExists = false;
    }
    if (passwordAccountExists) {
      await ctx.runMutation(internal.admin.recordPasswordReset, {
        actorId: userId,
        targetUserId: args.targetUserId,
      });
      return { ok: true };
    }
    try {
      await createAccount(ctx, {
        provider: "password",
        account: { id: targetEmail, secret: args.password },
        profile: { email: targetEmail, name: target.name },
        shouldLinkViaEmail: true,
      });
    } catch {
      throw new ConvexError({
        code: ERROR_CODES.CONFLICT,
        messageEn:
          "Could not set a password for this account. Let the user sign in with an email code instead.",
        messageAr:
          "تعذّر تعيين كلمة مرور لهذا الحساب. اطلب من المستخدم تسجيل الدخول برمز البريد الإلكتروني.",
      });
    }
    await ctx.runMutation(internal.admin.recordPasswordReset, {
      actorId: userId,
      targetUserId: args.targetUserId,
    });
    return { ok: true };
  },
});

/**
 * Self-service password set / reset.
 *
 * Reachable by any signed-in user, which includes someone who just proved
 * mailbox ownership through the one-time email code on the sign-in page —
 * that is the "forgot password" flow. Accounts that only ever signed in with
 * an email code have no password credential yet, so we create and link one;
 * otherwise the existing credential is updated in place.
 */
export const setMyPassword = action({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({
        code: ERROR_CODES.UNAUTHENTICATED,
        messageEn: "Sign in first.",
        messageAr: "سجّل الدخول أولاً.",
      });
    }
    if (args.password.length < 8) {
      throw new ConvexError({
        code: ERROR_CODES.INVALID,
        messageEn: "The password must be at least 8 characters.",
        messageAr: "كلمة المرور يجب أن تكون ٨ أحرف على الأقل.",
      });
    }
    if (!/[A-Za-z0-9]/.test(args.password)) {
      throw new ConvexError({
        code: ERROR_CODES.INVALID,
        messageEn: "The password must contain at least one letter or number.",
        messageAr: "كلمة المرور يجب أن تحتوي على حرف أو رقم على الأقل.",
      });
    }
    const profile = await ctx.runQuery(internal.admin.profileFor, { userId });
    if (!profile) {
      throw new ConvexError({
        code: ERROR_CODES.NOT_FOUND,
        messageEn: "Account not found.",
        messageAr: "لم يتم العثور على الحساب.",
      });
    }
    const email = profile.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new ConvexError({
        code: ERROR_CODES.INVALID,
        messageEn:
          "This account has no email address, so it cannot set a password. Ask an administrator for help.",
        messageAr:
          "لا يملك هذا الحساب بريداً إلكترونياً لذا لا يمكنه تعيين كلمة مرور. راجع مسؤول المنصة.",
      });
    }

    let updated = false;
    try {
      await modifyAccountCredentials(ctx, {
        provider: "password",
        account: { id: email, secret: args.password },
      });
      updated = true;
    } catch {
      // No password credential for this email yet — create one below.
      updated = false;
    }
    if (!updated) {
      try {
        await createAccount(ctx, {
          provider: "password",
          account: { id: email, secret: args.password },
          profile: { email, name: profile.name },
          shouldLinkViaEmail: true,
        });
      } catch {
        throw new ConvexError({
          code: ERROR_CODES.CONFLICT,
          messageEn:
            "Could not set a password for this account. Sign in with an email code and try again.",
          messageAr:
            "تعذّر تعيين كلمة مرور لهذا الحساب. سجّل الدخول برمز البريد ثم أعد المحاولة.",
        });
      }
    }

    await ctx.runMutation(internal.accounts.recordSelfPasswordChange, {
      userId,
    });
    return { ok: true };
  },
});

export const recordSelfPasswordChange = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await getProfile(ctx, args.userId);
    if (!profile) return;
    await logAudit(ctx, {
      actor: {
        userId: profile.userId,
        name: profile.name,
        role: profile.role,
      },
      action: "user.reset_password",
      entity: "users",
      entityId: args.userId as string,
      summaryEn: `${profile.name} set a new password for their own account.`,
      summaryAr: `قام ${profile.name} بتعيين كلمة مرور جديدة لحسابه بنفسه.`,
    });
  },
});

