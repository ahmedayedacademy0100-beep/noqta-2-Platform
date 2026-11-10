import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  assertClassAccess,
  classIdsForTeacher,
  deny,
  ERROR_CODES,
  logAudit,
  requireStudent,
  requireTeacher,
} from "./lib/guards";
import { ROLES } from "./schema";

/* -------------------------------------------------------------------------- */
/* Validators                                                                 */
/* -------------------------------------------------------------------------- */

const gameOptionValidator = v.object({
  textEn: v.string(),
  textAr: v.string(),
  emoji: v.optional(v.string()),
});

const gameQuestionValidator = v.object({
  promptEn: v.string(),
  promptAr: v.string(),
  phraseEn: v.optional(v.string()),
  options: v.array(gameOptionValidator),
  correctIndex: v.number(),
});

const GAME_TYPE = v.union(
  v.literal("quiz"),
  v.literal("sprint"),
  v.literal("situations"),
  v.literal("daily"),
);

const MAX_QUESTIONS = 20;
const MIN_QUESTIONS = 1;
const MAX_OPTIONS = 6;

type GameQuestionInput = {
  promptEn: string;
  promptAr: string;
  phraseEn?: string;
  options: { textEn: string; textAr: string; emoji?: string }[];
  correctIndex: number;
};

/** Validates and trims teacher-authored questions before they are stored. */
function sanitizeQuestions(questions: GameQuestionInput[]): GameQuestionInput[] {
  if (questions.length < MIN_QUESTIONS) {
    deny(
      ERROR_CODES.INVALID,
      "Add at least one question.",
      "أضف سؤالاً واحداً على الأقل.",
    );
  }
  if (questions.length > MAX_QUESTIONS) {
    deny(
      ERROR_CODES.INVALID,
      `A game can hold at most ${MAX_QUESTIONS} questions.`,
      `اللعبة يمكن أن تحتوي على ${MAX_QUESTIONS} سؤالاً كحد أقصى.`,
    );
  }
  return questions.map((question, index) => {
    const promptEn = question.promptEn.trim();
    const promptAr = question.promptAr.trim();
    if (promptEn.length === 0 && promptAr.length === 0) {
      deny(
        ERROR_CODES.INVALID,
        `Question ${index + 1} needs a prompt.`,
        `السؤال ${index + 1} يحتاج نصاً.`,
      );
    }
    const options = question.options
      .map((option) => ({
        textEn: option.textEn.trim(),
        textAr: option.textAr.trim(),
        emoji: option.emoji?.trim() || undefined,
      }))
      .filter((option) => option.textEn.length > 0 || option.textAr.length > 0);
    if (options.length < 2) {
      deny(
        ERROR_CODES.INVALID,
        `Question ${index + 1} needs at least two answers.`,
        `السؤال ${index + 1} يحتاج إجابتين على الأقل.`,
      );
    }
    if (options.length > MAX_OPTIONS) {
      deny(
        ERROR_CODES.INVALID,
        `Question ${index + 1} has too many answers.`,
        `السؤال ${index + 1} يحتوي على إجابات كثيرة.`,
      );
    }
    if (
      question.correctIndex < 0 ||
      question.correctIndex >= options.length ||
      !Number.isInteger(question.correctIndex)
    ) {
      deny(
        ERROR_CODES.INVALID,
        `Mark the correct answer for question ${index + 1}.`,
        `حدّد الإجابة الصحيحة للسؤال ${index + 1}.`,
      );
    }
    return {
      promptEn,
      promptAr,
      phraseEn: question.phraseEn?.trim() || undefined,
      options,
      correctIndex: question.correctIndex,
    };
  });
}

async function assertGameOwner(
  ctx: Parameters<typeof requireTeacher>[0],
  gameId: Id<"class_games">,
) {
  const { profile } = await requireTeacher(ctx);
  const game = await ctx.db.get(gameId);
  if (!game) {
    deny(ERROR_CODES.NOT_FOUND, "Game not found.", "اللعبة غير موجودة.");
  }
  if (profile.role !== ROLES.SUPER_ADMIN && game.ownerId !== profile.userId) {
    deny(
      ERROR_CODES.FORBIDDEN,
      "This game belongs to another teacher.",
      "هذه اللعبة تخص معلماً آخر.",
    );
  }
  return { profile, game };
}

/* -------------------------------------------------------------------------- */
/* Teacher                                                                    */
/* -------------------------------------------------------------------------- */

/** Classes the signed-in teacher can build a game for. */
export const teacherClasses = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireTeacher(ctx);
    const rows: { classId: Id<"classes">; nameEn: string; nameAr: string }[] = [];
    if (profile.role === ROLES.SUPER_ADMIN) {
      for (const cls of await ctx.db.query("classes").collect()) {
        if (cls.archivedAt === undefined) {
          rows.push({ classId: cls._id, nameEn: cls.nameEn, nameAr: cls.nameAr });
        }
      }
    } else {
      const ids = await classIdsForTeacher(ctx, profile.userId);
      for (const id of ids) {
        const cls = await ctx.db.get(id as Id<"classes">);
        if (cls && cls.archivedAt === undefined) {
          rows.push({ classId: cls._id, nameEn: cls.nameEn, nameAr: cls.nameAr });
        }
      }
    }
    rows.sort((a, b) => a.nameEn.localeCompare(b.nameEn));
    return rows;
  },
});

/** Every game this teacher owns, with live participation numbers. */
export const myGames = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireTeacher(ctx);
    const games =
      profile.role === ROLES.SUPER_ADMIN
        ? await ctx.db.query("class_games").collect()
        : await ctx.db
            .query("class_games")
            .withIndex("by_owner", (q) => q.eq("ownerId", profile.userId))
            .collect();

    const rows = [];
    for (const game of [...games].sort((a, b) => b.createdAt - a.createdAt)) {
      const cls = await ctx.db.get(game.classId);
      const runs = await ctx.db
        .query("class_game_runs")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();
      rows.push({
        gameId: game._id,
        classId: game.classId,
        classNameEn: cls?.nameEn ?? "—",
        classNameAr: cls?.nameAr ?? "—",
        titleEn: game.titleEn,
        titleAr: game.titleAr,
        status: game.status,
        gameType: game.gameType ?? "quiz",
        questions: game.questions,
        questionCount: game.questions.length,
        players: runs.length,
        averagePercent:
          runs.length === 0
            ? null
            : Math.round(
                (runs.reduce((sum, run) => sum + (run.score / Math.max(1, run.total)) * 100, 0) /
                  runs.length) *
                  10,
              ) / 10,
        createdAt: game.createdAt,
      });
    }
    return rows;
  },
});

export const createGame = mutation({
  args: {
    classId: v.id("classes"),
    titleEn: v.string(),
    titleAr: v.string(),
    gameType: v.optional(GAME_TYPE),
    questions: v.array(gameQuestionValidator),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireTeacher(ctx);
    await assertClassAccess(ctx, profile, args.classId);
    const titleEn = args.titleEn.trim();
    const titleAr = args.titleAr.trim();
    if (titleEn.length === 0 && titleAr.length === 0) {
      deny(ERROR_CODES.INVALID, "Give the game a title.", "اكتب اسماً للعبة.");
    }
    const questions = sanitizeQuestions(args.questions);
    const now = Date.now();
    const gameId = await ctx.db.insert("class_games", {
      ownerId: profile.userId,
      classId: args.classId,
      titleEn: titleEn || titleAr,
      titleAr: titleAr || titleEn,
      status: "open",
      gameType: args.gameType ?? "quiz",
      questions,
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, {
      actor: { userId: profile.userId, name: profile.name, role: profile.role },
      action: "game.create",
      entity: "class_game",
      entityId: gameId as string,
      summaryEn: `Created class game "${titleEn || titleAr}" with ${questions.length} questions.`,
      summaryAr: `أنشأ لعبة صفية "${titleAr || titleEn}" بعدد ${questions.length} سؤالًا.`,
    });
    return { ok: true, gameId };
  },
});

export const updateGame = mutation({
  args: {
    gameId: v.id("class_games"),
    titleEn: v.string(),
    titleAr: v.string(),
    gameType: v.optional(GAME_TYPE),
    questions: v.array(gameQuestionValidator),
  },
  handler: async (ctx, args) => {
    const { game } = await assertGameOwner(ctx, args.gameId);
    const titleEn = args.titleEn.trim();
    const titleAr = args.titleAr.trim();
    if (titleEn.length === 0 && titleAr.length === 0) {
      deny(ERROR_CODES.INVALID, "Give the game a title.", "اكتب اسماً للعبة.");
    }
    await ctx.db.patch(args.gameId, {
      titleEn: titleEn || titleAr,
      titleAr: titleAr || titleEn,
      gameType: args.gameType ?? game.gameType ?? "quiz",
      questions: sanitizeQuestions(args.questions),
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const setGameStatus = mutation({
  args: {
    gameId: v.id("class_games"),
    status: v.union(v.literal("open"), v.literal("closed")),
  },
  handler: async (ctx, args) => {
    await assertGameOwner(ctx, args.gameId);
    await ctx.db.patch(args.gameId, {
      status: args.status,
      closedAt: args.status === "closed" ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const deleteGame = mutation({
  args: { gameId: v.id("class_games") },
  handler: async (ctx, args) => {
    await assertGameOwner(ctx, args.gameId);
    const runs = await ctx.db
      .query("class_game_runs")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
    for (const run of runs) await ctx.db.delete(run._id);
    await ctx.db.delete(args.gameId);
    return { ok: true };
  },
});

/** Per-student results for one game (teacher view). */
export const gameResults = query({
  args: { gameId: v.id("class_games") },
  handler: async (ctx, args) => {
    await assertGameOwner(ctx, args.gameId);
    const runs = await ctx.db
      .query("class_game_runs")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
    const rows = [];
    for (const run of [...runs].sort((a, b) => b.score - a.score)) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", run.studentId))
        .first();
      rows.push({
        studentId: run.studentId,
        name: profile?.name ?? "—",
        avatar: profile?.avatar ?? null,
        score: run.score,
        total: run.total,
        submittedAt: run.submittedAt,
      });
    }
    return rows;
  },
});

/* -------------------------------------------------------------------------- */
/* Student                                                                    */
/* -------------------------------------------------------------------------- */

/** Open games assigned to the classes this student is enrolled in. */
export const myClassGames = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireStudent(ctx);
    const enrollments = await ctx.db
      .query("class_enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    const classIds = enrollments
      .filter((row) => row.status === "active")
      .map((row) => row.classId);

    const rows = [];
    for (const classId of classIds) {
      const cls = await ctx.db.get(classId);
      const games = await ctx.db
        .query("class_games")
        .withIndex("by_class", (q) => q.eq("classId", classId))
        .collect();
      for (const game of games.filter((row) => row.status === "open")) {
        const runs = await ctx.db
          .query("class_game_runs")
          .withIndex("by_game_student", (q) =>
            q.eq("gameId", game._id).eq("studentId", userId),
          )
          .collect();
        const owner = await ctx.db.get(game.ownerId);
        rows.push({
          gameId: game._id,
          titleEn: game.titleEn,
          titleAr: game.titleAr,
          gameType: game.gameType ?? "quiz",
          classNameEn: cls?.nameEn ?? "—",
          classNameAr: cls?.nameAr ?? "—",
          teacherName: owner?.name ?? "—",
          questionCount: game.questions.length,
          bestScore: runs.length === 0 ? null : Math.max(...runs.map((run) => run.score)),
          attempts: runs.length,
          createdAt: game.createdAt,
        });
      }
    }
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Questions for one open game, without the answer key. */
export const gameForPlay = query({
  args: { gameId: v.id("class_games") },
  handler: async (ctx, args) => {
    const { userId } = await requireStudent(ctx);
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      deny(ERROR_CODES.NOT_FOUND, "Game not found.", "اللعبة غير موجودة.");
    }
    const enrollment = await ctx.db
      .query("class_enrollments")
      .withIndex("by_class_student", (q) =>
        q.eq("classId", game.classId).eq("studentId", userId),
      )
      .first();
    if (!enrollment || enrollment.status !== "active") {
      deny(
        ERROR_CODES.NOT_ASSIGNED,
        "This game is not part of your class.",
        "هذه اللعبة ليست ضمن صفك.",
      );
    }
    if (game.status !== "open") {
      deny(ERROR_CODES.CLOSED, "This game is closed.", "هذه اللعبة مغلقة.");
    }
    return {
      gameId: game._id,
      titleEn: game.titleEn,
      titleAr: game.titleAr,
      gameType: game.gameType ?? "quiz",
      questions: game.questions.map((question) => ({
        promptEn: question.promptEn,
        promptAr: question.promptAr,
        phraseEn: question.phraseEn ?? null,
        options: question.options,
      })),
    };
  },
});

/**
 * Grades one attempt on the server. Correct answers never reach the browser
 * before submission, and a repeated attempt can only earn the XP difference
 * over the student's previous best.
 */
export const submitGameRun = mutation({
  args: {
    gameId: v.id("class_games"),
    answers: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireStudent(ctx);
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      deny(ERROR_CODES.NOT_FOUND, "Game not found.", "اللعبة غير موجودة.");
    }
    const enrollment = await ctx.db
      .query("class_enrollments")
      .withIndex("by_class_student", (q) =>
        q.eq("classId", game.classId).eq("studentId", userId),
      )
      .first();
    if (!enrollment || enrollment.status !== "active") {
      deny(
        ERROR_CODES.NOT_ASSIGNED,
        "This game is not part of your class.",
        "هذه اللعبة ليست ضمن صفك.",
      );
    }
    if (game.status !== "open") {
      deny(ERROR_CODES.CLOSED, "This game is closed.", "هذه اللعبة مغلقة.");
    }

    const total = game.questions.length;
    const results = game.questions.map((question, index) => {
      const chosen = args.answers[index];
      const valid = Number.isInteger(chosen) && chosen >= 0 && chosen < question.options.length;
      return {
        correctIndex: question.correctIndex,
        chosen: valid ? chosen : -1,
        correct: valid && chosen === question.correctIndex,
      };
    });
    const score = results.filter((row) => row.correct).length;

    const previous = await ctx.db
      .query("class_game_runs")
      .withIndex("by_game_student", (q) =>
        q.eq("gameId", game._id).eq("studentId", userId),
      )
      .collect();
    const previousBest = previous.reduce((best, run) => Math.max(best, run.score), 0);

    await ctx.db.insert("class_game_runs", {
      gameId: game._id,
      classId: game.classId,
      studentId: userId,
      score,
      total,
      submittedAt: Date.now(),
    });

    let pointsAwarded = 0;
    if (score > previousBest) {
      pointsAwarded = (score - previousBest) * 2;
      await ctx.db.patch(profile._id, {
        points: profile.points + pointsAwarded,
        updatedAt: Date.now(),
      });
    }

    return { score, total, results, pointsAwarded };
  },
});
