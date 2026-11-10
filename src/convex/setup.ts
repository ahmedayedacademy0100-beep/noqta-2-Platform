import { createAccount, getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "./lib/demoAccounts";
import { autoGrade } from "./lib/grading";
import {
  DEFAULT_GRADING_SCALE,
  ERROR_CODES,
  deny,
  getProfile,
  logAudit,
} from "./lib/guards";
import { snapshotFromQuestion, totalMarks } from "./lib/snapshot";
import { ROLES } from "./schema";

const DAY = 24 * 60 * 60 * 1000;

/** Default badge definitions so a fresh (non-demo) platform has gamification. */
export const DEFAULT_ACHIEVEMENTS = [
  {
    code: "first_steps",
    titleEn: "First steps",
    titleAr: "الخطوة الأولى",
    descriptionEn: "Complete your first assessment.",
    descriptionAr: "أكمل أول تقييم لك.",
    icon: "footprints",
    points: 10,
  },
  {
    code: "sharp_shooter",
    titleEn: "Sharp shooter",
    titleAr: "دقة عالية",
    descriptionEn: "Score 90% or more on an assessment.",
    descriptionAr: "احصل على 90% أو أكثر في تقييم.",
    icon: "target",
    points: 30,
  },
  {
    code: "essay_writer",
    titleEn: "Thoughtful writer",
    titleAr: "كاتب متأمل",
    descriptionEn: "Submit a written answer that a teacher grades.",
    descriptionAr: "قدّم إجابة كتابية قام المعلم بتصحيحها.",
    icon: "pen",
    points: 15,
  },
  {
    code: "streak_3",
    titleEn: "Three in a row",
    titleAr: "ثلاثة أيام متتالية",
    descriptionEn: "Stay active three days in a row.",
    descriptionAr: "ابقَ نشطاً ثلاثة أيام متتالية.",
    icon: "flame",
    points: 25,
  },
];

/* -------------------------------------------------------------------------- */
/* Bootstrap the first administrator                                          */
/* -------------------------------------------------------------------------- */

/**
 * Creates the platform's first super admin. This is deliberately only possible
 * while the platform has no profiles at all, so it can never be used later to
 * promote an arbitrary account.
 */
export const bootstrapAdmin = mutation({
  args: {
    name: v.string(),
    schoolNameEn: v.string(),
    schoolNameAr: v.string(),
    language: v.union(v.literal("en"), v.literal("ar")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      deny(ERROR_CODES.UNAUTHENTICATED, "Sign in first.", "سجّل الدخول أولاً.");
    }
    const existingProfiles = await ctx.db.query("profiles").collect();
    if (existingProfiles.length > 0) {
      deny(
        ERROR_CODES.FORBIDDEN,
        "This platform is already set up.",
        "تم إعداد هذه المنصة بالفعل.",
      );
    }
    const name = args.name.trim();
    if (name.length < 2) {
      deny(ERROR_CODES.INVALID, "Enter your full name.", "أدخل اسمك الكامل.");
    }
    const now = Date.now();
    const user = await ctx.db.get(userId);
    await ctx.db.insert("profiles", {
      userId,
      name,
      email: user?.email ?? "",
      role: ROLES.SUPER_ADMIN,
      status: "active",
      language: args.language,
      theme: "system",
      isDemo: false,
      points: 0,
      streak: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(userId, { role: ROLES.SUPER_ADMIN, name });
    await ctx.db.insert("platform_settings", {
      schoolNameEn: args.schoolNameEn.trim() || "Noqta Academy",
      schoolNameAr: args.schoolNameAr.trim() || "أكاديمية نُقطة",
      defaultLanguage: args.language,
      gradingScale: DEFAULT_GRADING_SCALE,
      defaultPassThreshold: 60,
      defaultDurationMinutes: 30,
      gamificationEnabled: true,
      leaderboardsEnabled: false,
      notificationsEnabled: true,
      demoDataLoaded: false,
      demoAccountsEnabled: false,
      updatedAt: now,
      updatedBy: userId,
    });
    await ctx.db.insert("academic_years", {
      name: "2026–2027",
      startDate: "2026-09-01",
      endDate: "2027-06-30",
      isActive: true,
      createdAt: now,
    });
    for (const spec of DEFAULT_ACHIEVEMENTS) {
      await ctx.db.insert("achievements", {
        ...spec,
        active: true,
        createdAt: now,
      });
    }
    await logAudit(ctx, {
      actor: { userId, name, role: ROLES.SUPER_ADMIN },
      action: "platform.bootstrap",
      entity: "platform_settings",
      summaryEn: `Platform initialized by ${name}.`,
      summaryAr: `تم تهيئة المنصة بواسطة ${name}.`,
    });
    return { ok: true };
  },
});

/* -------------------------------------------------------------------------- */
/* Demo sandbox                                                               */
/* -------------------------------------------------------------------------- */

export const demoSeedState = internalQuery({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("profiles").collect();
    const settings = await ctx.db.query("platform_settings").first();
    return {
      profileCount: profiles.length,
      demoDataLoaded: settings?.demoDataLoaded ?? false,
    };
  },
});

export const isSuperAdmin = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await getProfile(ctx, args.userId);
    return profile?.role === ROLES.SUPER_ADMIN;
  },
});

async function ensureDemoAccounts(
  ctx: ActionCtx,
): Promise<Record<string, Id<"users">>> {
  const map: Record<string, Id<"users">> = {};
  for (const spec of DEMO_ACCOUNTS) {
    let userId: Id<"users"> | null = null;
    try {
      const created = await createAccount(ctx, {
        provider: "password",
        account: { id: spec.email, secret: spec.password },
        profile: { email: spec.email, name: spec.name },
      });
      userId = created.user._id as Id<"users">;
    } catch {
      const existing = await ctx.runQuery(internal.setup.findUserByEmail, {
        email: spec.email,
      });
      userId = existing;
    }
    if (!userId) {
      throw new ConvexError({
        code: ERROR_CODES.CONFLICT,
        messageEn: `Could not create the demo account ${spec.email}.`,
        messageAr: `تعذّر إنشاء الحساب التجريبي ${spec.email}.`,
      });
    }
    map[spec.email] = userId;
  }
  return map;
}

export const findUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
    return user?._id ?? null;
  },
});

/** Flags every demo account so the UI can label it and admins can filter it. */
export const markDemoAccounts = internalMutation({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    let settings = await ctx.db.query("platform_settings").first();
    const now = Date.now();
    if (!settings) {
      const admin = await ctx.db.get(args.adminId);
      await ctx.db.insert("platform_settings", {
        schoolNameEn: "Noqta Academy",
        schoolNameAr: "أكاديمية نُقطة",
        defaultLanguage: "en",
        gradingScale: DEFAULT_GRADING_SCALE,
        defaultPassThreshold: 60,
        defaultDurationMinutes: 30,
        gamificationEnabled: true,
        leaderboardsEnabled: false,
        notificationsEnabled: true,
        demoDataLoaded: true,
        demoAccountsEnabled: true,
        updatedAt: now,
        updatedBy: args.adminId,
      });
      settings = await ctx.db.query("platform_settings").first();
      if (admin) {
        // nothing else to do: settings row now exists
      }
    } else {
      await ctx.db.patch(settings._id, {
        demoDataLoaded: true,
        demoAccountsEnabled: true,
        updatedAt: now,
      });
    }
    for (const spec of DEMO_ACCOUNTS) {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", spec.email))
        .first();
      if (!user) continue;
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();
      if (profile) {
        await ctx.db.patch(profile._id, {
          isDemo: true,
          name: profile.name || spec.name,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("profiles", {
          userId: user._id,
          name: spec.name,
          email: spec.email,
          role: spec.role,
          status: "active",
          language: "en",
          theme: "system",
          isDemo: true,
          points: 0,
          streak: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
      await ctx.db.patch(user._id, { role: spec.role, name: spec.name });
    }
  },
});

/**
 * Public, but only usable on a completely empty platform: it creates the
 * clearly-labelled demo accounts plus a realistic dataset so the whole flow can
 * be tried immediately.
 */
export const seedDemoWorkspace = action({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.runQuery(internal.setup.demoSeedState, {});
    if (state.profileCount > 0) {
      throw new ConvexError({
        code: ERROR_CODES.FORBIDDEN,
        messageEn:
          "The demo sandbox is only available before the platform has any users.",
        messageAr: "البيئة التجريبية متاحة فقط قبل وجود أي مستخدمين.",
      });
    }
    const users = await ensureDemoAccounts(ctx);
    const adminId = users[DEMO_ACCOUNTS[0].email];
    await ctx.runMutation(internal.setup.markDemoAccounts, { adminId });
    await ctx.runMutation(internal.setup.seedDemoContent, {
      adminId,
      usersByEmail: users,
    });
    return { ok: true };
  },
});

/** Administrator-triggered demo content load on an existing platform. */
export const loadDemoContent = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({
        code: ERROR_CODES.UNAUTHENTICATED,
        messageEn: "Sign in first.",
        messageAr: "سجّل الدخول أولاً.",
      });
    }
    const ok = await ctx.runQuery(internal.setup.isSuperAdmin, { userId });
    if (!ok) {
      throw new ConvexError({
        code: ERROR_CODES.FORBIDDEN,
        messageEn: "Only a super admin can load demo content.",
        messageAr: "يمكن لمسؤول المنصة فقط تحميل المحتوى التجريبي.",
      });
    }
    const state = await ctx.runQuery(internal.setup.demoSeedState, {});
    if (state.demoDataLoaded) {
      throw new ConvexError({
        code: ERROR_CODES.CONFLICT,
        messageEn: "Demo content is already loaded.",
        messageAr: "المحتوى التجريبي مُحمّل بالفعل.",
      });
    }
    const users = await ensureDemoAccounts(ctx);
    await ctx.runMutation(internal.setup.markDemoAccounts, { adminId: userId });
    await ctx.runMutation(internal.setup.seedDemoContent, {
      adminId: userId,
      usersByEmail: users,
    });
    return { ok: true };
  },
});

/* -------------------------------------------------------------------------- */
/* Demo dataset                                                               */
/* -------------------------------------------------------------------------- */

const IMAGE_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='320' height='120'>" +
      "<rect width='320' height='120' rx='12' fill='rgb(238,242,255)'/>" +
      "<g fill='rgb(255,255,255)' stroke='rgb(59,110,246)' stroke-width='2'>" +
      "<rect x='30' y='30' width='60' height='60'/><rect x='90' y='30' width='60' height='60'/>" +
      "<rect x='150' y='30' width='60' height='60'/><rect x='210' y='30' width='60' height='60'/>" +
      "</g><g fill='rgb(59,110,246)'>" +
      "<rect x='30' y='30' width='30' height='60'/>" +
      "<rect x='150' y='30' width='15' height='60'/>" +
      "<rect x='210' y='30' width='45' height='60'/>" +
      "</g></svg>",
  );

type QuestionSeed = {
  key: string;
  bank: "math" | "science";
  type: "mcq_single" | "mcq_multi" | "true_false" | "short_answer" | "essay" | "fill_blank" | "image";
  promptEn: string;
  promptAr: string;
  instructionsEn?: string;
  instructionsAr?: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  marks: number;
  options?: { key: string; textEn: string; textAr: string; correct: boolean }[];
  acceptedAnswers?: string[];
  gradingMode: "auto" | "manual";
  feedbackEn?: string;
  feedbackAr?: string;
  image?: boolean;
};

const QUESTION_SEEDS: QuestionSeed[] = [
  {
    key: "q_frac_compare",
    bank: "math",
    type: "image",
    promptEn: "The diagram shows four bars. Which fraction is shaded in the third bar?",
    promptAr: "يوضح الشكل أربعة أشرطة. ما الكسر المظلل في الشريط الثالث؟",
    topic: "math.fractions",
    difficulty: "easy",
    marks: 2,
    options: [
      { key: "a", textEn: "1/4", textAr: "١/٤", correct: false },
      { key: "b", textEn: "1/8", textAr: "١/٨", correct: true },
      { key: "c", textEn: "3/8", textAr: "٣/٨", correct: false },
      { key: "d", textEn: "1/2", textAr: "١/٢", correct: false },
    ],
    gradingMode: "auto",
    feedbackEn: "The third bar is split into 8 equal parts with one shaded.",
    feedbackAr: "الشريط الثالث مقسّم إلى ٨ أجزاء متساوية وواحد مظلل.",
    image: true,
  },
  {
    key: "q_frac_equivalent",
    bank: "math",
    type: "mcq_multi",
    promptEn: "Select every fraction that is equivalent to 1/2.",
    promptAr: "اختر كل كسر يكافئ ١/٢.",
    instructionsEn: "More than one answer may be correct.",
    instructionsAr: "قد يكون هناك أكثر من إجابة صحيحة.",
    topic: "math.fractions",
    difficulty: "medium",
    marks: 2,
    options: [
      { key: "a", textEn: "2/4", textAr: "٢/٤", correct: true },
      { key: "b", textEn: "3/6", textAr: "٣/٦", correct: true },
      { key: "c", textEn: "2/3", textAr: "٢/٣", correct: false },
      { key: "d", textEn: "5/10", textAr: "٥/١٠", correct: true },
    ],
    gradingMode: "auto",
    feedbackEn: "2/4, 3/6 and 5/10 all simplify to 1/2.",
    feedbackAr: "الكسر ٢/٤ و٣/٦ و٥/١٠ كلها تساوي ١/٢ بالتبسيط.",
  },
  {
    key: "q_frac_tf",
    bank: "math",
    type: "true_false",
    promptEn: "3/4 is larger than 2/3.",
    promptAr: "الكسر ٣/٤ أكبر من ٢/٣.",
    topic: "math.fractions",
    difficulty: "easy",
    marks: 1,
    options: [
      { key: "true", textEn: "True", textAr: "صحيح", correct: true },
      { key: "false", textEn: "False", textAr: "خطأ", correct: false },
    ],
    gradingMode: "auto",
  },
  {
    key: "q_frac_blank",
    bank: "math",
    type: "fill_blank",
    promptEn: "Write the decimal value of 3/4.",
    promptAr: "اكتب القيمة العشرية للكسر ٣/٤.",
    topic: "math.fractions",
    difficulty: "medium",
    marks: 2,
    acceptedAnswers: ["0.75", "0,75"],
    gradingMode: "auto",
    feedbackEn: "3 ÷ 4 = 0.75",
    feedbackAr: "٣ ÷ ٤ = ٠٫٧٥",
  },
  {
    key: "q_frac_short",
    bank: "math",
    type: "short_answer",
    promptEn: "Simplify 4/12 to its lowest terms.",
    promptAr: "بسّط الكسر ٤/١٢ إلى أبسط صورة.",
    topic: "math.fractions",
    difficulty: "easy",
    marks: 1,
    acceptedAnswers: ["1/3", "١/٣"],
    gradingMode: "auto",
  },
  {
    key: "q_frac_essay",
    bank: "math",
    type: "essay",
    promptEn:
      "A recipe needs 3/4 cup of milk. You want to make half of the recipe. Explain step by step how much milk you need and why.",
    promptAr:
      "تحتاج وصفة إلى ٣/٤ كوب من الحليب. تريد تحضير نصف الوصفة. اشرح خطوة بخطوة كمية الحليب المطلوبة ولماذا.",
    instructionsEn: "Show your reasoning in 3–5 sentences.",
    instructionsAr: "اشرح خطواتك في ٣ إلى ٥ جمل.",
    topic: "math.fractions",
    difficulty: "hard",
    marks: 4,
    gradingMode: "manual",
    feedbackEn: "Look for halving the numerator and keeping the fraction in lowest terms.",
    feedbackAr: "المطلوب قسمة البسط على ٢ ثم تبسيط الكسر.",
  },
  {
    key: "q_alg_solve",
    bank: "math",
    type: "mcq_single",
    promptEn: "Solve for x: 3x + 6 = 18",
    promptAr: "أوجد قيمة س: ٣س + ٦ = ١٨",
    topic: "math.algebra",
    difficulty: "easy",
    marks: 2,
    options: [
      { key: "a", textEn: "x = 2", textAr: "س = ٢", correct: false },
      { key: "b", textEn: "x = 4", textAr: "س = ٤", correct: true },
      { key: "c", textEn: "x = 6", textAr: "س = ٦", correct: false },
      { key: "d", textEn: "x = 8", textAr: "س = ٨", correct: false },
    ],
    gradingMode: "auto",
  },
  {
    key: "q_alg_tf",
    bank: "math",
    type: "true_false",
    promptEn: "The point (2, 5) satisfies y = 2x + 1.",
    promptAr: "النقطة (٢، ٥) تحقق المعادلة ص = ٢س + ١.",
    topic: "math.algebra",
    difficulty: "medium",
    marks: 1,
    options: [
      { key: "true", textEn: "True", textAr: "صحيح", correct: true },
      { key: "false", textEn: "False", textAr: "خطأ", correct: false },
    ],
    gradingMode: "auto",
  },
  {
    key: "q_alg_short",
    bank: "math",
    type: "short_answer",
    promptEn: "What is the value of x in 5x = 45?",
    promptAr: "ما قيمة س في ٥س = ٤٥؟",
    topic: "math.algebra",
    difficulty: "easy",
    marks: 1,
    acceptedAnswers: ["9", "٩", "x=9", "س=٩"],
    gradingMode: "auto",
  },
  {
    key: "q_alg_essay",
    bank: "math",
    type: "essay",
    promptEn:
      "Explain how you check whether a value is a solution of a linear equation. Give one example.",
    promptAr:
      "اشرح كيف تتحقق من أن قيمة معينة حل لمعادلة خطية، مع ذكر مثال.",
    topic: "math.algebra",
    difficulty: "medium",
    marks: 3,
    gradingMode: "manual",
  },
  {
    key: "q_cells_mcq",
    bank: "science",
    type: "mcq_single",
    promptEn: "Which organelle is the powerhouse of the cell?",
    promptAr: "أي عضية تُعد مصنع الطاقة في الخلية؟",
    topic: "sci.cells",
    difficulty: "easy",
    marks: 1,
    options: [
      { key: "a", textEn: "Nucleus", textAr: "النواة", correct: false },
      { key: "b", textEn: "Mitochondria", textAr: "الميتوكوندريا", correct: true },
      { key: "c", textEn: "Vacuole", textAr: "الفجوة", correct: false },
      { key: "d", textEn: "Cell wall", textAr: "الجدار الخلوي", correct: false },
    ],
    gradingMode: "auto",
  },
  {
    key: "q_cells_multi",
    bank: "science",
    type: "mcq_multi",
    promptEn: "Select the parts found in a plant cell but not in an animal cell.",
    promptAr: "اختر الأجزاء الموجودة في الخلية النباتية وليس في الخلية الحيوانية.",
    topic: "sci.cells",
    difficulty: "medium",
    marks: 2,
    options: [
      { key: "a", textEn: "Cell wall", textAr: "الجدار الخلوي", correct: true },
      { key: "b", textEn: "Chloroplast", textAr: "البلاستيدة الخضراء", correct: true },
      { key: "c", textEn: "Nucleus", textAr: "النواة", correct: false },
      { key: "d", textEn: "Large central vacuole", textAr: "الفجوة المركزية الكبيرة", correct: true },
    ],
    gradingMode: "auto",
  },
  {
    key: "q_cells_essay",
    bank: "science",
    type: "essay",
    promptEn: "Compare plant and animal cells in three sentences.",
    promptAr: "قارن بين الخلية النباتية والحيوانية في ثلاث جمل.",
    topic: "sci.cells",
    difficulty: "medium",
    marks: 2,
    gradingMode: "manual",
  },
];

type AnswerSpec = {
  key: string;
  response: {
    selectedKeys: string[];
    text?: string;
    blanks?: string[];
    booleanAnswer?: boolean;
  };
};

export const seedDemoContent = internalMutation({
  args: {
    adminId: v.id("users"),
    usersByEmail: v.record(v.string(), v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const demoSettings = await ctx.db.query("platform_settings").first();
    if (demoSettings) {
      await ctx.db.patch(demoSettings._id, {
        demoDataLoaded: true,
        demoAccountsEnabled: true,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("platform_settings", {
        schoolNameEn: "Noqta Academy",
        schoolNameAr: "أكاديمية نُقطة",
        defaultLanguage: "en",
        gradingScale: DEFAULT_GRADING_SCALE,
        defaultPassThreshold: 60,
        defaultDurationMinutes: 30,
        gamificationEnabled: true,
        leaderboardsEnabled: false,
        notificationsEnabled: true,
        demoDataLoaded: true,
        demoAccountsEnabled: true,
        updatedAt: now,
        updatedBy: args.adminId,
      });
    }

    const emailOf = (key: string) =>
      DEMO_ACCOUNTS.find((a) => a.key === key)!.email;
    const userOf = (key: string) => args.usersByEmail[emailOf(key)];

    const years = await ctx.db.query("academic_years").collect();
    const yearId =
      years.find((y) => y.isActive)?._id ??
      (await ctx.db.insert("academic_years", {
        name: "2026–2027",
        startDate: "2026-09-01",
        endDate: "2027-06-30",
        isActive: true,
        createdAt: now,
      }));

    const grade8 = await ctx.db.insert("grades", {
      nameEn: "Grade 8",
      nameAr: "الصف الثامن",
      level: 8,
      academicYearId: yearId,
      createdAt: now,
    });
    const grade7 = await ctx.db.insert("grades", {
      nameEn: "Grade 7",
      nameAr: "الصف السابع",
      level: 7,
      academicYearId: yearId,
      createdAt: now,
    });

    const subjectMath = await ctx.db.insert("subjects", {
      nameEn: "Mathematics",
      nameAr: "الرياضيات",
      code: "MATH",
      color: "#3b6ef6",
      createdAt: now,
    });
    const subjectScience = await ctx.db.insert("subjects", {
      nameEn: "Science",
      nameAr: "العلوم",
      code: "SCI",
      color: "#0f9d8f",
      createdAt: now,
    });
    await ctx.db.insert("subjects", {
      nameEn: "English",
      nameAr: "اللغة الإنجليزية",
      code: "ENG",
      color: "#7c5cf0",
      createdAt: now,
    });
    await ctx.db.insert("subjects", {
      nameEn: "Arabic",
      nameAr: "اللغة العربية",
      code: "ARB",
      color: "#d97706",
      createdAt: now,
    });

    const topicSpecs = [
      { key: "math.fractions", subjectId: subjectMath, gradeId: grade8, nameEn: "Fractions", nameAr: "الكسور" },
      { key: "math.algebra", subjectId: subjectMath, gradeId: grade8, nameEn: "Linear equations", nameAr: "المعادلات الخطية" },
      { key: "sci.cells", subjectId: subjectScience, gradeId: grade7, nameEn: "Cells", nameAr: "الخلايا" },
    ];
    const topicIds: Record<string, Id<"topics">> = {};
    for (const [index, topic] of topicSpecs.entries()) {
      topicIds[topic.key] = await ctx.db.insert("topics", {
        subjectId: topic.subjectId,
        gradeId: topic.gradeId,
        nameEn: topic.nameEn,
        nameAr: topic.nameAr,
        order: index,
        createdAt: now,
      });
    }

    const classA = await ctx.db.insert("classes", {
      nameEn: "Grade 8A — Mathematics",
      nameAr: "الصف الثامن أ — الرياضيات",
      gradeId: grade8,
      academicYearId: yearId,
      subjectId: subjectMath,
      homeroomTeacherId: userOf("teacherMath"),
      joinCode: "G8MATH",
      // Each demo class carries its own contact number, like a real school.
      whatsapp: "+201000000201",
      createdAt: now,
    });
    const classB = await ctx.db.insert("classes", {
      nameEn: "Grade 7B — Science",
      nameAr: "الصف السابع ب — العلوم",
      gradeId: grade7,
      academicYearId: yearId,
      subjectId: subjectScience,
      homeroomTeacherId: userOf("teacherScience"),
      joinCode: "G7SCI",
      whatsapp: "+201000000202",
      createdAt: now,
    });

    // Deliberately disjoint: each teacher only manages their own class, which
    // is what the authorization tests assert.
    for (const [teacherKey, classId, subjectId] of [
      ["teacherMath", classA, subjectMath],
      ["teacherScience", classB, subjectScience],
    ] as const) {
      await ctx.db.insert("teacher_assignments", {
        teacherId: userOf(teacherKey),
        classId: classId as Id<"classes">,
        subjectId: subjectId as Id<"subjects">,
        createdAt: now,
        createdBy: args.adminId,
      });
    }

    for (const [studentKey, classId] of [
      ["student1", classA],
      ["student2", classA],
      ["student3", classA],
      ["student4", classB],
      ["student3", classB],
    ] as const) {
      await ctx.db.insert("class_enrollments", {
        classId: classId as Id<"classes">,
        studentId: userOf(studentKey),
        status: "active",
        enrolledAt: now,
        createdBy: args.adminId,
      });
    }

    const mathBank = await ctx.db.insert("question_banks", {
      ownerId: userOf("teacherMath"),
      name: "Grade 8 — Fractions & Algebra",
      visibility: "shared",
      subjectId: subjectMath,
      createdAt: now,
    });
    const scienceBank = await ctx.db.insert("question_banks", {
      ownerId: userOf("teacherScience"),
      name: "Life science — Cells",
      visibility: "private",
      subjectId: subjectScience,
      createdAt: now,
    });

    const questionIds: Record<string, Id<"questions">> = {};
    for (const seed of QUESTION_SEEDS) {
      const bankId = seed.bank === "math" ? mathBank : scienceBank;
      const ownerId =
        seed.bank === "math" ? userOf("teacherMath") : userOf("teacherScience");
      const subjectId = seed.bank === "math" ? subjectMath : subjectScience;
      questionIds[seed.key] = await ctx.db.insert("questions", {
        bankId,
        ownerId,
        type: seed.type,
        promptEn: seed.promptEn,
        promptAr: seed.promptAr,
        instructionsEn: seed.instructionsEn,
        instructionsAr: seed.instructionsAr,
        imageUrl: seed.image ? IMAGE_DATA_URI : undefined,
        subjectId,
        topicId: topicIds[seed.topic],
        difficulty: seed.difficulty,
        defaultMarks: seed.marks,
        options: seed.options ?? [],
        acceptedAnswers: seed.acceptedAnswers,
        gradingMode: seed.gradingMode,
        feedbackEn: seed.feedbackEn,
        feedbackAr: seed.feedbackAr,
        createdAt: now,
        updatedAt: now,
      });
    }

    type AssessmentSpec = {
      titleEn: string;
      titleAr: string;
      kind: "quiz" | "homework" | "exam";
      ownerKey: string;
      subjectId: Id<"subjects">;
      topicKey: string;
      durationMinutes: number;
      attemptsAllowed: number;
      releasePolicy: "immediate" | "manual" | "on_close";
      showAnswers: boolean;
      openAt: number;
      closeAt: number;
      status: "published" | "draft";
      questions: { key: string; marks: number }[];
      assignClass: Id<"classes">;
    };

    const assessmentSpecs: AssessmentSpec[] = [
      {
        titleEn: "Fractions checkpoint quiz",
        titleAr: "اختبار الكسور التقييمي",
        kind: "quiz",
        ownerKey: "teacherMath",
        subjectId: subjectMath,
        topicKey: "math.fractions",
        durationMinutes: 20,
        attemptsAllowed: 2,
        releasePolicy: "immediate",
        showAnswers: true,
        openAt: now - 2 * DAY,
        closeAt: now + 5 * DAY,
        status: "published",
        assignClass: classA,
        questions: [
          { key: "q_frac_compare", marks: 2 },
          { key: "q_frac_equivalent", marks: 2 },
          { key: "q_frac_tf", marks: 1 },
          { key: "q_frac_blank", marks: 2 },
          { key: "q_frac_short", marks: 1 },
          { key: "q_frac_essay", marks: 4 },
        ],
      },
      {
        titleEn: "Algebra practice homework",
        titleAr: "واجب الجبر التدريبي",
        kind: "homework",
        ownerKey: "teacherMath",
        subjectId: subjectMath,
        topicKey: "math.algebra",
        durationMinutes: 45,
        attemptsAllowed: 3,
        releasePolicy: "immediate",
        showAnswers: true,
        openAt: now - DAY,
        closeAt: now + 7 * DAY,
        status: "published",
        assignClass: classA,
        questions: [
          { key: "q_alg_solve", marks: 2 },
          { key: "q_alg_tf", marks: 1 },
          { key: "q_alg_short", marks: 1 },
          { key: "q_alg_essay", marks: 3 },
        ],
      },
      {
        titleEn: "Cells and organisms quiz",
        titleAr: "اختبار الخلايا والكائنات الحية",
        kind: "quiz",
        ownerKey: "teacherScience",
        subjectId: subjectScience,
        topicKey: "sci.cells",
        durationMinutes: 15,
        attemptsAllowed: 1,
        releasePolicy: "manual",
        showAnswers: false,
        openAt: now - DAY,
        closeAt: now + 3 * DAY,
        status: "published",
        assignClass: classB,
        questions: [
          { key: "q_cells_mcq", marks: 1 },
          { key: "q_cells_multi", marks: 2 },
          { key: "q_cells_essay", marks: 2 },
        ],
      },
    ];

    const createdAssessments: Record<
      string,
      { id: Id<"assessments">; questions: { id: Id<"assessment_questions">; key: string; marks: number; snapshot: ReturnType<typeof snapshotFromQuestion> }[] }
    > = {};

    for (const spec of assessmentSpecs) {
      const ownerId = userOf(spec.ownerKey);
      const assessmentId = await ctx.db.insert("assessments", {
        ownerId,
        kind: spec.kind,
        titleEn: spec.titleEn,
        titleAr: spec.titleAr,
        instructionsEn: "Read every question carefully before answering.",
        instructionsAr: "اقرأ كل سؤال بعناية قبل الإجابة.",
        subjectId: spec.subjectId,
        topicId: topicIds[spec.topicKey],
        status: spec.status,
        openAt: spec.openAt,
        closeAt: spec.closeAt,
        durationMinutes: spec.durationMinutes,
        attemptsAllowed: spec.attemptsAllowed,
        passThreshold: 60,
        shuffleQuestions: false,
        shuffleOptions: false,
        allowLate: false,
        releasePolicy: spec.releasePolicy,
        showAnswersToStudents: spec.showAnswers,
        maxScore: totalMarks(spec.questions),
        version: 1,
        publishedAt: spec.status === "published" ? spec.openAt : undefined,
        createdAt: now,
        updatedAt: now,
      });
      const rows: {
        id: Id<"assessment_questions">;
        key: string;
        marks: number;
        snapshot: ReturnType<typeof snapshotFromQuestion>;
      }[] = [];
      for (const [index, item] of spec.questions.entries()) {
        const question = await ctx.db.get(questionIds[item.key]);
        if (!question) continue;
        const topic = question.topicId ? await ctx.db.get(question.topicId) : null;
        const snapshot = snapshotFromQuestion(question, topic);
        const rowId = await ctx.db.insert("assessment_questions", {
          assessmentId,
          questionId: question._id,
          order: index,
          marks: item.marks,
          version: 1,
          snapshot,
        });
        rows.push({ id: rowId, key: item.key, marks: item.marks, snapshot });
      }
      await ctx.db.insert("assessment_assignments", {
        assessmentId,
        classId: spec.assignClass,
        assignedBy: ownerId,
        assignedAt: now,
      });
      createdAssessments[spec.titleEn] = { id: assessmentId, questions: rows };
    }

    /* ------------------------------ attempts ------------------------------ */

    const quiz = createdAssessments["Fractions checkpoint quiz"];
    const homework = createdAssessments["Algebra practice homework"];
    const scienceQuiz = createdAssessments["Cells and organisms quiz"];

    const answerFor = (key: string): AnswerSpec["response"] => {
      switch (key) {
        case "q_frac_compare":
          return { selectedKeys: ["b"] };
        case "q_frac_equivalent":
          return { selectedKeys: ["a", "b", "d"] };
        case "q_frac_tf":
          return { selectedKeys: [], booleanAnswer: true };
        case "q_frac_blank":
          return { selectedKeys: [], blanks: ["0.75"] };
        case "q_frac_short":
          return { selectedKeys: [], text: "1/3" };
        case "q_frac_essay":
          return {
            selectedKeys: [],
            text:
              "Half of three quarters is three eighths. I multiply the denominator by two because I need half of the amount, so 3/4 × 1/2 = 3/8 cup.",
          };
        default:
          return { selectedKeys: [] };
      }
    };

    // 1) Fully graded + released attempt (demonstrates manual grading + release)
    const linaId = userOf("student1");
    const gradedAttemptId = await ctx.db.insert("attempts", {
      assessmentId: quiz.id,
      studentId: linaId,
      attemptNumber: 1,
      status: "graded",
      startedAt: now - 2 * DAY,
      expiresAt: now - 2 * DAY + 20 * 60 * 1000,
      submittedAt: now - 2 * DAY + 15 * 60 * 1000,
      autoSubmitted: false,
      score: 0,
      maxScore: quiz.questions.reduce((sum, q) => sum + q.marks, 0),
      percentage: 0,
      pendingManualCount: 0,
      gradedAt: now - DAY,
      gradedBy: userOf("teacherMath"),
      releasedAt: now - DAY,
      snapshotVersion: 1,
      lastSavedAt: now - 2 * DAY + 15 * 60 * 1000,
    });
    let gradedScore = 0;
    for (const row of quiz.questions) {
      const response = answerFor(row.key);
      const result = autoGrade(row.snapshot, row.marks, response);
      const awarded =
        row.key === "q_frac_essay"
          ? 3 // teacher awarded partial credit
          : result.awardedMarks;
      gradedScore += awarded;
      const answerId = await ctx.db.insert("attempt_answers", {
        attemptId: gradedAttemptId,
        assessmentQuestionId: row.id,
        questionId: undefined,
        response,
        flagged: false,
        maxMarks: row.marks,
        awardedMarks: awarded,
        isCorrect: result.needsManualGrading ? undefined : result.isCorrect,
        autoGraded: !result.needsManualGrading,
        needsManualGrading: false,
        feedback:
          row.key === "q_frac_essay"
            ? "Clear reasoning. Remember to write the final answer as a fraction in lowest terms."
            : undefined,
        gradedAt: now - DAY,
        gradedBy: userOf("teacherMath"),
        updatedAt: now - DAY,
      });
      await ctx.db.insert("grading_records", {
        attemptId: gradedAttemptId,
        answerId,
        actorId: row.key === "q_frac_essay" ? userOf("teacherMath") : undefined,
        kind: row.key === "q_frac_essay" ? "manual_grade" : "auto_grade",
        newMarks: awarded,
        createdAt: now - DAY,
      });
    }
    const quizMax = quiz.questions.reduce((sum, q) => sum + q.marks, 0);
    await ctx.db.patch(gradedAttemptId, {
      score: gradedScore,
      percentage: Math.round((gradedScore / quizMax) * 10000) / 100,
      passed: gradedScore / quizMax >= 0.6,
    });

    // 2) Submitted, waiting for essay grading (shows up in the teacher queue)
    const youssefId = userOf("student2");
    const pendingAttemptId = await ctx.db.insert("attempts", {
      assessmentId: quiz.id,
      studentId: youssefId,
      attemptNumber: 1,
      status: "submitted",
      startedAt: now - DAY,
      expiresAt: now - DAY + 20 * 60 * 1000,
      submittedAt: now - DAY + 12 * 60 * 1000,
      autoSubmitted: false,
      score: 0,
      maxScore: quizMax,
      percentage: 0,
      pendingManualCount: 1,
      snapshotVersion: 1,
      lastSavedAt: now - DAY + 12 * 60 * 1000,
    });
    for (const row of quiz.questions) {
      const response =
        row.key === "q_frac_equivalent"
          ? { selectedKeys: ["a", "c"] }
          : row.key === "q_frac_essay"
            ? {
                selectedKeys: [],
                text: "I think you need 3/8 but I am not sure about the steps.",
              }
            : answerFor(row.key);
      const result = autoGrade(row.snapshot, row.marks, response);
      await ctx.db.insert("attempt_answers", {
        attemptId: pendingAttemptId,
        assessmentQuestionId: row.id,
        response,
        flagged: false,
        maxMarks: row.marks,
        awardedMarks: result.needsManualGrading ? undefined : result.awardedMarks,
        isCorrect: result.needsManualGrading ? undefined : result.isCorrect,
        autoGraded: !result.needsManualGrading,
        needsManualGrading: result.needsManualGrading,
        updatedAt: now - DAY,
      });
    }

    // 3) In-progress attempt so the resume/autosave path is visible
    const maryamId = userOf("student3");
    const inProgressId = await ctx.db.insert("attempts", {
      assessmentId: quiz.id,
      studentId: maryamId,
      attemptNumber: 1,
      status: "in_progress",
      startedAt: now - 5 * 60 * 1000,
      expiresAt: now + 15 * 60 * 1000,
      autoSubmitted: false,
      score: 0,
      maxScore: quizMax,
      percentage: 0,
      pendingManualCount: 0,
      snapshotVersion: 1,
      lastSavedAt: now - 3 * 60 * 1000,
    });
    for (const row of quiz.questions.slice(0, 2)) {
      await ctx.db.insert("attempt_answers", {
        attemptId: inProgressId,
        assessmentQuestionId: row.id,
        response: answerFor(row.key),
        flagged: row.key === "q_frac_equivalent",
        maxMarks: row.marks,
        autoGraded: false,
        needsManualGrading: false,
        updatedAt: now - 3 * 60 * 1000,
      });
    }

    /* --------------------------- notifications ---------------------------- */

    const notify = async (
      userId: Id<"users">,
      type: "assignment" | "result" | "deadline" | "announcement",
      titleEn: string,
      titleAr: string,
      bodyEn?: string,
      bodyAr?: string,
      link?: string,
    ) =>
      ctx.db.insert("notifications", {
        userId,
        type,
        titleEn,
        titleAr,
        bodyEn,
        bodyAr,
        link,
        createdAt: now,
      });

    for (const studentKey of ["student1", "student2", "student3", "student4"] as const) {
      await notify(
        userOf(studentKey),
        "assignment",
        "New assessment published",
        "تم نشر تقييم جديد",
        "Fractions checkpoint quiz is open until the end of the week.",
        "اختبار الكسور التقييمي متاح حتى نهاية الأسبوع.",
        `/assessments/${quiz.id}`,
      );
    }
    await notify(
      linaId,
      "result",
      "Your result is released",
      "تم إصدار نتيجتك",
      "Fractions checkpoint quiz — your teacher released the marks.",
      "اختبار الكسور التقييمي — أصدر المعلم الدرجات.",
      `/results/${gradedAttemptId}`,
    );
    await notify(
      youssefId,
      "deadline",
      "Homework due soon",
      "موعد الواجب يقترب",
      "Algebra practice homework closes in a week.",
      "ينتهي واجب الجبر التدريبي خلال أسبوع.",
      `/assessments/${homework.id}`,
    );
    await notify(
      userOf("teacherMath"),
      "announcement",
      "Essays waiting for grading",
      "مقالات بانتظار التصحيح",
      "One essay from Fractions checkpoint quiz needs manual grading.",
      "يوجد مقال واحد في اختبار الكسور يحتاج تصحيحاً يدوياً.",
      "/teacher/grading",
    );
    await notify(
      userOf("student3"),
      "announcement",
      "Cells quiz published for Grade 7B",
      "نشر اختبار الخلايا للصف السابع ب",
      "Science quiz from Mr. Omar is now open.",
      "اختبار العلوم من الأستاذ عمر متاح الآن.",
      `/assessments/${scienceQuiz.id}`,
    );

    /* --------------------------- gamification ----------------------------- */

    for (const spec of DEFAULT_ACHIEVEMENTS) {
      const existing = await ctx.db
        .query("achievements")
        .withIndex("by_code", (q) => q.eq("code", spec.code))
        .first();
      if (!existing) {
        await ctx.db.insert("achievements", {
          ...spec,
          active: true,
          createdAt: now,
        });
      }
    }
    await ctx.db.insert("student_achievements", {
      studentId: linaId,
      achievementCode: "first_steps",
      earnedAt: now - DAY,
      meta: "Fractions checkpoint quiz",
    });
    await ctx.db.patch(
      (
        await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", linaId))
          .first()
      )!._id,
      { points: 40, streak: 2 },
    );

    await logAudit(ctx, {
      actor: {
        userId: args.adminId,
        name: "Noqta Admin",
        role: ROLES.SUPER_ADMIN,
      },
      action: "demo.seed",
      entity: "platform_settings",
      summaryEn: "Demo sandbox content and accounts created.",
      summaryAr: "تم إنشاء محتوى وحسابات البيئة التجريبية.",
      details: {
        accounts: Object.keys(args.usersByEmail).length,
        assessments: assessmentSpecs.length,
        questions: QUESTION_SEEDS.length,
        demoPassword: DEMO_PASSWORD.length > 0 ? "provided" : "n/a",
      },
    });

    return { ok: true, assessments: assessmentSpecs.length };
  },
});

/** Cleans up: used by an admin to switch the demo sandbox off. */
export const setDemoAccountsEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      deny(ERROR_CODES.UNAUTHENTICATED, "Sign in first.", "سجّل الدخول أولاً.");
    }
    const profile = await getProfile(ctx, userId);
    if (profile?.role !== ROLES.SUPER_ADMIN) {
      deny(
        ERROR_CODES.FORBIDDEN,
        "Only a super admin can change demo settings.",
        "يمكن لمسؤول المنصة فقط تغيير إعدادات البيئة التجريبية.",
      );
    }
    const settings = await ctx.db.query("platform_settings").first();
    const now = Date.now();
    if (settings) {
      await ctx.db.patch(settings._id, {
        demoAccountsEnabled: args.enabled,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("platform_settings", {
        schoolNameEn: "Noqta Academy",
        schoolNameAr: "أكاديمية نُقطة",
        defaultLanguage: "en",
        gradingScale: DEFAULT_GRADING_SCALE,
        defaultPassThreshold: 60,
        defaultDurationMinutes: 30,
        gamificationEnabled: true,
        leaderboardsEnabled: false,
        notificationsEnabled: true,
        demoDataLoaded: false,
        demoAccountsEnabled: args.enabled,
        updatedAt: now,
        updatedBy: userId,
      });
    }
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: args.enabled ? "demo.enable_signin" : "demo.disable_signin",
      entity: "platform_settings",
      summaryEn: `Demo one-click sign-in ${args.enabled ? "enabled" : "disabled"}.`,
      summaryAr: `تم ${args.enabled ? "تمكين" : "تعطيل"} تسجيل الدخول التجريبي.`,
    });
    return { ok: true };
  },
});
