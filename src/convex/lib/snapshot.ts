import type { Doc } from "../_generated/dataModel";
import type { QuestionSnapshot } from "./grading";

/**
 * Questions are versioned by *snapshot*: when a question is added to an
 * assessment the wording, options, marks and correct keys are copied into the
 * assessment. Later edits to the question bank never touch historical attempts.
 */
export function snapshotFromQuestion(
  question: Doc<"questions">,
  topic?: Doc<"topics"> | null,
): QuestionSnapshot {
  return {
    type: question.type,
    promptEn: question.promptEn,
    promptAr: question.promptAr,
    instructionsEn: question.instructionsEn,
    instructionsAr: question.instructionsAr,
    imageUrl: question.imageUrl,
    options: question.options.map((o) => ({
      key: o.key,
      textEn: o.textEn,
      textAr: o.textAr,
      correct: o.correct,
    })),
    acceptedAnswers: question.acceptedAnswers,
    gradingMode: question.gradingMode,
    topicId: question.topicId,
    topicLabelEn: topic?.nameEn,
    topicLabelAr: topic?.nameAr,
    feedbackEn: question.feedbackEn,
    feedbackAr: question.feedbackAr,
    difficulty: question.difficulty,
  };
}

export function totalMarks(
  items: { marks: number }[],
): number {
  return Math.round(items.reduce((sum, item) => sum + item.marks, 0) * 100) / 100;
}

/** Deterministic shuffle so a re-read of the same attempt keeps its order. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state * 16807) % 2147483647;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
