import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  ERROR_CODES,
  deny,
  logAudit,
  requireRole,
} from "./lib/guards";
import { bilingualPair, hasBilingualContent } from "./lib/bilingual";
import {
  difficultyValidator,
  questionTypeValidator,
  ROLES,
} from "./schema";

const STAFF = [ROLES.TEACHER, ROLES.SUPER_ADMIN] as const;

const optionInput = v.object({
  key: v.string(),
  textEn: v.string(),
  textAr: v.string(),
  correct: v.boolean(),
});

/** Shared with assessments.ts so direct-to-assessment authoring validates the
 *  same payload as a question-bank entry. */
export const questionInput = {
  type: questionTypeValidator,
  promptEn: v.string(),
  promptAr: v.string(),
  instructionsEn: v.optional(v.string()),
  instructionsAr: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  subjectId: v.optional(v.id("subjects")),
  topicId: v.optional(v.id("topics")),
  difficulty: difficultyValidator,
  defaultMarks: v.number(),
  options: v.array(optionInput),
  acceptedAnswers: v.optional(v.array(v.string())),
  gradingMode: v.union(v.literal("auto"), v.literal("manual")),
  feedbackEn: v.optional(v.string()),
  feedbackAr: v.optional(v.string()),
};

type QuestionPayload = {
  type: "mcq_single" | "mcq_multi" | "true_false" | "short_answer" | "essay" | "fill_blank" | "image";
  promptEn: string;
  promptAr: string;
  instructionsEn?: string;
  instructionsAr?: string;
  imageUrl?: string;
  subjectId?: Id<"subjects">;
  topicId?: Id<"topics">;
  difficulty: "easy" | "medium" | "hard";
  defaultMarks: number;
  options: { key: string; textEn: string; textAr: string; correct: boolean }[];
  acceptedAnswers?: string[];
  gradingMode: "auto" | "manual";
  feedbackEn?: string;
  feedbackAr?: string;
};

/**
 * Validation shared by create/update/bulk import. Returns message codes.
 *
 * A question only has to be written in *one* language: the author may work in
 * Arabic, in English, or supply both. Whichever side is filled in is mirrored
 * by `normalizeQuestion` before it is stored.
 */
export function validateQuestion(payload: QuestionPayload): string | null {
  if (!hasBilingualContent(payload.promptEn, payload.promptAr, 3)) {
    return "promptRequired";
  }
  if (!hasBilingualContent(payload.promptEn, payload.promptAr, 1)) {
    return "promptRequired";
  }
  if (payload.defaultMarks <= 0 || payload.defaultMarks > 100) {
    return "marksRange";
  }
  const needsOptions = [
    "mcq_single",
    "mcq_multi",
    "true_false",
    "image",
  ].includes(payload.type);
  if (needsOptions && payload.options.length < 2) {
    return "optionsRequired";
  }
  if (needsOptions) {
    const keys = new Set(payload.options.map((o) => o.key));
    // Option text only needs one language as well (mirrored below).
    if (keys.size !== payload.options.length) return "duplicateOptionKeys";
    const correct = payload.options.filter((o) => o.correct);
    if (correct.length === 0) return "correctAnswerRequired";
    if (payload.type !== "mcq_multi" && correct.length > 1) {
      return "singleCorrectOnly";
    }
    if (payload.options.some((o) => !o.textEn.trim() && !o.textAr.trim())) {
      return "optionTextRequired";
    }
  }
  if (
    (payload.type === "short_answer" || payload.type === "fill_blank") &&
    payload.gradingMode === "auto" &&
    (payload.acceptedAnswers ?? []).filter((a) => a.trim()).length === 0
  ) {
    return "acceptedAnswersRequired";
  }
  if (payload.type === "image" && !payload.imageUrl) return "imageRequired";
  return null;
}

/**
 * Mirrors single-language authoring into both stored fields so the whole app
 * (student runtime, analytics, exports) keeps working with one shape.
 */
export function normalizeQuestion(payload: QuestionPayload) {
  const prompt = bilingualPair(payload.promptEn, payload.promptAr);
  const instructions =
    payload.instructionsEn?.trim() || payload.instructionsAr?.trim()
      ? bilingualPair(payload.instructionsEn, payload.instructionsAr)
      : { en: undefined, ar: undefined };
  const feedback =
    payload.feedbackEn?.trim() || payload.feedbackAr?.trim()
      ? bilingualPair(payload.feedbackEn, payload.feedbackAr)
      : { en: undefined, ar: undefined };
  return {
    promptEn: prompt.en,
    promptAr: prompt.ar,
    instructionsEn: instructions.en,
    instructionsAr: instructions.ar,
    feedbackEn: feedback.en,
    feedbackAr: feedback.ar,
    options: payload.options.map((option) => {
      const text = bilingualPair(option.textEn, option.textAr);
      return { key: option.key, textEn: text.en, textAr: text.ar, correct: option.correct };
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Banks                                                                      */
/* -------------------------------------------------------------------------- */

export const banks = query({
  args: {},
  handler: async (ctx) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const all = await ctx.db.query("question_banks").collect();
    const visible = all.filter(
      (bank) =>
        profile.role === ROLES.SUPER_ADMIN ||
        bank.ownerId === userId ||
        (bank.visibility === "shared" && bank.archivedAt === undefined),
    );
    const rows = await Promise.all(
      visible.map(async (bank) => {
        const questions = await ctx.db
          .query("questions")
          .withIndex("by_bank", (q) => q.eq("bankId", bank._id))
          .collect();
        const owner = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", bank.ownerId))
          .first();
        const subject = bank.subjectId ? await ctx.db.get(bank.subjectId) : null;
        return {
          _id: bank._id,
          name: bank.name,
          visibility: bank.visibility,
          subjectId: bank.subjectId,
          subjectNameEn: subject?.nameEn,
          subjectNameAr: subject?.nameAr,
          ownerId: bank.ownerId,
          ownerName: owner?.name ?? "—",
          isMine: bank.ownerId === userId,
          canEdit:
            bank.ownerId === userId || profile.role === ROLES.SUPER_ADMIN,
          questionCount: questions.filter((q) => q.archivedAt === undefined)
            .length,
          createdAt: bank.createdAt,
        };
      }),
    );
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createBank = mutation({
  args: {
    name: v.string(),
    visibility: v.union(v.literal("private"), v.literal("shared")),
    subjectId: v.optional(v.id("subjects")),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const name = args.name.trim();
    if (name.length < 2) {
      deny(ERROR_CODES.INVALID, "Give the bank a name.", "أدخل اسماً لبنك الأسئلة.");
    }
    const id = await ctx.db.insert("question_banks", {
      ownerId: userId,
      name,
      visibility: args.visibility,
      subjectId: args.subjectId,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "question_bank.create",
      entity: "question_banks",
      entityId: id as string,
      summaryEn: `Created question bank "${name}".`,
      summaryAr: `تم إنشاء بنك الأسئلة "${name}".`,
    });
    return { id };
  },
});

export const updateBank = mutation({
  args: {
    bankId: v.id("question_banks"),
    name: v.optional(v.string()),
    visibility: v.optional(
      v.union(v.literal("private"), v.literal("shared")),
    ),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const bank = await ctx.db.get(args.bankId);
    if (!bank) deny(ERROR_CODES.NOT_FOUND, "Bank not found.", "لم يتم العثور على البنك.");
    if (bank.ownerId !== userId && profile.role !== ROLES.SUPER_ADMIN) {
      deny(
        ERROR_CODES.FORBIDDEN,
        "Only the owner can edit this bank.",
        "يمكن للمالك فقط تعديل هذا البنك.",
      );
    }
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) {
      if (args.name.trim().length < 2) {
        deny(ERROR_CODES.INVALID, "Give the bank a name.", "أدخل اسماً لبنك الأسئلة.");
      }
      patch.name = args.name.trim();
    }
    if (args.visibility !== undefined) patch.visibility = args.visibility;
    await ctx.db.patch(args.bankId, patch);
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "question_bank.update",
      entity: "question_banks",
      entityId: args.bankId as string,
      summaryEn: `Updated question bank "${bank.name}".`,
      summaryAr: `تم تحديث بنك الأسئلة "${bank.name}".`,
      details: args,
    });
    return { ok: true };
  },
});

/* -------------------------------------------------------------------------- */
/* Questions                                                                  */
/* -------------------------------------------------------------------------- */

export const questions = query({
  args: {
    bankId: v.optional(v.id("question_banks")),
    subjectId: v.optional(v.id("subjects")),
    topicId: v.optional(v.id("topics")),
    type: v.optional(questionTypeValidator),
    difficulty: v.optional(difficultyValidator),
    search: v.optional(v.string()),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const banks = await ctx.db.query("question_banks").collect();
    const readableBankIds = new Set(
      banks
        .filter(
          (bank) =>
            profile.role === ROLES.SUPER_ADMIN ||
            bank.ownerId === userId ||
            (bank.visibility === "shared" && bank.archivedAt === undefined),
        )
        .map((bank) => bank._id as string),
    );
    const editableBankIds = new Set(
      banks
        .filter(
          (bank) =>
            profile.role === ROLES.SUPER_ADMIN || bank.ownerId === userId,
        )
        .map((bank) => bank._id as string),
    );

    let rows = await ctx.db.query("questions").collect();
    rows = rows.filter((q) => readableBankIds.has(q.bankId as string));
    if (args.bankId) rows = rows.filter((q) => q.bankId === args.bankId);
    if (args.subjectId) rows = rows.filter((q) => q.subjectId === args.subjectId);
    if (args.topicId) rows = rows.filter((q) => q.topicId === args.topicId);
    if (args.type) rows = rows.filter((q) => q.type === args.type);
    if (args.difficulty) rows = rows.filter((q) => q.difficulty === args.difficulty);
    if (!args.includeArchived) rows = rows.filter((q) => q.archivedAt === undefined);
    const search = args.search?.trim().toLowerCase();
    if (search) {
      rows = rows.filter(
        (q) =>
          q.promptEn.toLowerCase().includes(search) ||
          q.promptAr.includes(search),
      );
    }

    const subjects = await ctx.db.query("subjects").collect();
    const topics = await ctx.db.query("topics").collect();
    return rows
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((q) => ({
        _id: q._id,
        bankId: q.bankId,
        type: q.type,
        promptEn: q.promptEn,
        promptAr: q.promptAr,
        instructionsEn: q.instructionsEn,
        instructionsAr: q.instructionsAr,
        imageUrl: q.imageUrl,
        subjectId: q.subjectId,
        subjectNameEn: subjects.find((s) => s._id === q.subjectId)?.nameEn,
        subjectNameAr: subjects.find((s) => s._id === q.subjectId)?.nameAr,
        topicId: q.topicId,
        topicNameEn: topics.find((t) => t._id === q.topicId)?.nameEn,
        topicNameAr: topics.find((t) => t._id === q.topicId)?.nameAr,
        difficulty: q.difficulty,
        defaultMarks: q.defaultMarks,
        options: q.options,
        acceptedAnswers: q.acceptedAnswers,
        gradingMode: q.gradingMode,
        feedbackEn: q.feedbackEn,
        feedbackAr: q.feedbackAr,
        archivedAt: q.archivedAt,
        canEdit: editableBankIds.has(q.bankId as string),
        updatedAt: q.updatedAt,
      }));
  },
});

function assertBankEditable(
  bank: Doc<"question_banks">,
  userId: Id<"users">,
  role: Doc<"profiles">["role"],
) {
  if (bank.ownerId === userId || role === ROLES.SUPER_ADMIN) return;
  deny(
    ERROR_CODES.FORBIDDEN,
    "You can reuse questions from this bank, but only its owner can edit it.",
    "يمكنك إعادة استخدام أسئلة هذا البنك، لكن مالكه فقط يمكنه تعديله.",
  );
}

export const createQuestion = mutation({
  args: {
    bankId: v.id("question_banks"),
    ...questionInput,
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const bank = await ctx.db.get(args.bankId);
    if (!bank) deny(ERROR_CODES.NOT_FOUND, "Bank not found.", "لم يتم العثور على البنك.");
    assertBankEditable(bank, userId, profile.role);
    const error = validateQuestion(args);
    if (error) {
      deny(ERROR_CODES.INVALID, `Invalid question: ${error}`, `سؤال غير صالح: ${error}`);
    }
    const now = Date.now();
    const normalized = normalizeQuestion(args);
    const id = await ctx.db.insert("questions", {
      bankId: args.bankId,
      ownerId: userId,
      type: args.type,
      promptEn: normalized.promptEn,
      promptAr: normalized.promptAr,
      instructionsEn: normalized.instructionsEn,
      instructionsAr: normalized.instructionsAr,
      imageUrl: args.imageUrl,
      subjectId: args.subjectId ?? bank.subjectId,
      topicId: args.topicId,
      difficulty: args.difficulty,
      defaultMarks: args.defaultMarks,
      options: normalized.options,
      acceptedAnswers: args.acceptedAnswers,
      gradingMode: args.gradingMode,
      feedbackEn: normalized.feedbackEn,
      feedbackAr: normalized.feedbackAr,
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "question.create",
      entity: "questions",
      entityId: id as string,
      summaryEn: `Added a ${args.type} question to "${bank.name}".`,
      summaryAr: `تمت إضافة سؤال من نوع ${args.type} إلى "${bank.name}".`,
    });
    return { id };
  },
});

export const updateQuestion = mutation({
  args: {
    questionId: v.id("questions"),
    ...questionInput,
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const question = await ctx.db.get(args.questionId);
    if (!question) {
      deny(ERROR_CODES.NOT_FOUND, "Question not found.", "لم يتم العثور على السؤال.");
    }
    const bank = await ctx.db.get(question.bankId);
    if (!bank) deny(ERROR_CODES.NOT_FOUND, "Bank not found.", "لم يتم العثور على البنك.");
    assertBankEditable(bank, userId, profile.role);
    const error = validateQuestion(args);
    if (error) {
      deny(ERROR_CODES.INVALID, `Invalid question: ${error}`, `سؤال غير صالح: ${error}`);
    }
    const normalized = normalizeQuestion(args);
    await ctx.db.patch(args.questionId, {
      type: args.type,
      promptEn: normalized.promptEn,
      promptAr: normalized.promptAr,
      instructionsEn: normalized.instructionsEn,
      instructionsAr: normalized.instructionsAr,
      imageUrl: args.imageUrl,
      subjectId: args.subjectId,
      topicId: args.topicId,
      difficulty: args.difficulty,
      defaultMarks: args.defaultMarks,
      options: normalized.options,
      acceptedAnswers: args.acceptedAnswers,
      gradingMode: args.gradingMode,
      feedbackEn: normalized.feedbackEn,
      feedbackAr: normalized.feedbackAr,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "question.update",
      entity: "questions",
      entityId: args.questionId as string,
      summaryEn: "Edited a question. Existing assessment snapshots keep the old wording.",
      summaryAr: "تم تعديل سؤال. تبقى نسخ التقييمات السابقة بمحتواها القديم.",
      details: { type: args.type },
    });
    return { ok: true };
  },
});

export const duplicateQuestion = mutation({
  args: { questionId: v.id("questions") },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const question = await ctx.db.get(args.questionId);
    if (!question) deny(ERROR_CODES.NOT_FOUND, "Question not found.", "لم يتم العثور على السؤال.");
    const bank = await ctx.db.get(question.bankId);
    if (!bank) deny(ERROR_CODES.NOT_FOUND, "Bank not found.", "لم يتم العثور على البنك.");
    assertBankEditable(bank, userId, profile.role);
    const now = Date.now();
    const id = await ctx.db.insert("questions", {
      bankId: question.bankId,
      ownerId: userId,
      type: question.type,
      promptEn: `${question.promptEn} (copy)`,
      promptAr: `${question.promptAr} (نسخة)`,
      instructionsEn: question.instructionsEn,
      instructionsAr: question.instructionsAr,
      imageUrl: question.imageUrl,
      subjectId: question.subjectId,
      topicId: question.topicId,
      difficulty: question.difficulty,
      defaultMarks: question.defaultMarks,
      options: question.options,
      acceptedAnswers: question.acceptedAnswers,
      gradingMode: question.gradingMode,
      feedbackEn: question.feedbackEn,
      feedbackAr: question.feedbackAr,
      createdAt: now,
      updatedAt: now,
      archivedAt: undefined,
    });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "question.duplicate",
      entity: "questions",
      entityId: id as string,
      summaryEn: "Duplicated a question.",
      summaryAr: "تم نسخ سؤال.",
    });
    return { id };
  },
});

export const archiveQuestion = mutation({
  args: { questionId: v.id("questions"), archived: v.boolean() },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const question = await ctx.db.get(args.questionId);
    if (!question) deny(ERROR_CODES.NOT_FOUND, "Question not found.", "لم يتم العثور على السؤال.");
    const bank = await ctx.db.get(question.bankId);
    if (!bank) deny(ERROR_CODES.NOT_FOUND, "Bank not found.", "لم يتم العثور على البنك.");
    assertBankEditable(bank, userId, profile.role);
    await ctx.db.patch(args.questionId, {
      archivedAt: args.archived ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: args.archived ? "question.archive" : "question.restore",
      entity: "questions",
      entityId: args.questionId as string,
      summaryEn: args.archived ? "Archived a question." : "Restored a question.",
      summaryAr: args.archived ? "تم أرشفة سؤال." : "تم استعادة سؤال.",
    });
    return { ok: true };
  },
});

/** Validated bulk import (the CSV is parsed client-side, rows validated here). */
export const importQuestions = mutation({
  args: {
    bankId: v.id("question_banks"),
    rows: v.array(v.object({ ...questionInput, promptEn: v.string(), promptAr: v.string() })),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    const bank = await ctx.db.get(args.bankId);
    if (!bank) deny(ERROR_CODES.NOT_FOUND, "Bank not found.", "لم يتم العثور على البنك.");
    assertBankEditable(bank, userId, profile.role);
    if (args.rows.length === 0 || args.rows.length > 200) {
      deny(
        ERROR_CODES.INVALID,
        "Import between 1 and 200 questions at a time.",
        "يمكن استيراد ما بين 1 و200 سؤال في المرة.",
      );
    }
    const results: { row: number; ok: boolean; error?: string }[] = [];
    let created = 0;
    for (const [index, row] of args.rows.entries()) {
      const error = validateQuestion(row);
      if (error) {
        results.push({ row: index + 1, ok: false, error });
        continue;
      }
      const now = Date.now();
      const normalized = normalizeQuestion(row);
      await ctx.db.insert("questions", {
        bankId: args.bankId,
        ownerId: userId,
        type: row.type,
        promptEn: normalized.promptEn,
        promptAr: normalized.promptAr,
        instructionsEn: normalized.instructionsEn,
        instructionsAr: normalized.instructionsAr,
        imageUrl: row.imageUrl,
        subjectId: row.subjectId ?? bank.subjectId,
        topicId: row.topicId,
        difficulty: row.difficulty,
        defaultMarks: row.defaultMarks,
        options: normalized.options,
        acceptedAnswers: row.acceptedAnswers,
        gradingMode: row.gradingMode,
        feedbackEn: normalized.feedbackEn,
        feedbackAr: normalized.feedbackAr,
        createdAt: now,
        updatedAt: now,
      });
      created += 1;
      results.push({ row: index + 1, ok: true });
    }
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "question.bulk_import",
      entity: "question_banks",
      entityId: args.bankId as string,
      summaryEn: `Imported ${created} question(s) into "${bank.name}".`,
      summaryAr: `تم استيراد ${created} سؤالاً إلى "${bank.name}".`,
      details: { rejected: results.filter((r) => !r.ok).length },
    });
    return { created, results };
  },
});
