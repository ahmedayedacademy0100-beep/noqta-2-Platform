import type { Infer } from "convex/values";
import type { questionSnapshotValidator } from "../schema";

/**
 * Deterministic grading rules.
 *
 * Objective types are graded here, on the server, against the *frozen* question
 * snapshot stored on the assessment. A later edit to the question bank can
 * therefore never change a score that was already awarded.
 */

export type QuestionSnapshot = Infer<typeof questionSnapshotValidator>;

export type StoredResponse = {
  selectedKeys: string[];
  text?: string;
  blanks?: string[];
  booleanAnswer?: boolean;
};

export type GradeResult = {
  awardedMarks: number;
  isCorrect: boolean | undefined;
  needsManualGrading: boolean;
};

/** Arabic-aware, case-insensitive text normalization for free-text answers. */
export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "") // harakat + tatweel
    .replace(/[\u0623\u0625\u0622]/g, "\u0627") // alef variants
    .replace(/\u0649/g, "\u064A") // alef maqsura
    .replace(/\u0629/g, "\u0647") // ta marbuta
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[.,!?;:،؛؟'"()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function correctKeysOf(snapshot: QuestionSnapshot): string[] {
  return snapshot.options.filter((o) => o.correct).map((o) => o.key);
}

/**
 * Which boolean a true/false question expects.
 *
 * Question options can be authored as keys "true"/"false" or as ordinary
 * "a"/"b" options labelled True/False, so the correct *option* is inspected
 * instead of assuming a key name. Returns null when no reliable answer exists.
 */
function truthyAnswerOf(snapshot: QuestionSnapshot): boolean | null {
  const correct = snapshot.options.filter((o) => o.correct);
  if (correct.length === 1) {
    const option = correct[0];
    const key = option.key.trim().toLowerCase();
    if (key === "true" || key === "t") return true;
    if (key === "false" || key === "f") return false;
    const text = `${option.textEn} ${option.textAr}`.toLowerCase();
    const saysFalse = /(false|خطأ|خطا|خاطئ|غير صحيح)/.test(text);
    const saysTrue = /(true|صح|صحيح)/.test(text);
    if (saysFalse && !saysTrue) return false;
    if (saysTrue && !saysFalse) return true;
  }
  // Legacy rows only stored a "true"/"false" key on the first option.
  const firstKey = snapshot.options[0]?.key?.trim().toLowerCase();
  if (firstKey === "true" || firstKey === "false") return firstKey === "true";
  return null;
}

export function isManualOnly(snapshot: QuestionSnapshot): boolean {
  if (snapshot.type === "essay") return true;
  if (snapshot.gradingMode === "manual") return true;
  if (
    (snapshot.type === "short_answer" || snapshot.type === "fill_blank") &&
    (snapshot.acceptedAnswers ?? []).length === 0
  ) {
    return true;
  }
  return false;
}

function textAnswersOf(response: StoredResponse): string[] {
  if (response.blanks && response.blanks.length > 0) return response.blanks;
  if (response.text) return [response.text];
  return [];
}

export function autoGrade(
  snapshot: QuestionSnapshot,
  marks: number,
  response: StoredResponse,
): GradeResult {
  const correctKeys = correctKeysOf(snapshot);
  const selected = response.selectedKeys ?? [];

  switch (snapshot.type) {
    case "mcq_single":
    case "image": {
      const isCorrect =
        selected.length === 1 && correctKeys.includes(selected[0]);
      return {
        awardedMarks: isCorrect ? marks : 0,
        isCorrect,
        needsManualGrading: false,
      };
    }
    case "true_false": {
      const truthy = truthyAnswerOf(snapshot);
      if (truthy === null) {
        // No reliable correct value stored: let the teacher decide.
        return { awardedMarks: 0, isCorrect: undefined, needsManualGrading: true };
      }
      const answered = response.booleanAnswer;
      const isCorrect = answered !== undefined && answered === truthy;
      return {
        awardedMarks: isCorrect ? marks : 0,
        isCorrect,
        needsManualGrading: false,
      };
    }
    case "mcq_multi": {
      const hits = selected.filter((key) => correctKeys.includes(key)).length;
      const wrong = selected.filter((key) => !correctKeys.includes(key)).length;
      const ratio =
        correctKeys.length === 0
          ? 0
          : Math.max(0, (hits - wrong) / correctKeys.length);
      return {
        awardedMarks: round2(marks * ratio),
        isCorrect: hits === correctKeys.length && wrong === 0,
        needsManualGrading: false,
      };
    }
    case "fill_blank": {
      if (isManualOnly(snapshot)) {
        return { awardedMarks: 0, isCorrect: undefined, needsManualGrading: true };
      }
      const rawAccepted = snapshot.acceptedAnswers ?? [];
      const blanks = textAnswersOf(response);
      if (blanks.length === 0) {
        return { awardedMarks: 0, isCorrect: undefined, needsManualGrading: true };
      }
      // One blank: the accepted list holds alternatives for that same blank.
      if (blanks.length === 1) {
        const hit = rawAccepted
          .map(normalizeAnswer)
          .includes(normalizeAnswer(blanks[0]));
        return { awardedMarks: hit ? marks : 0, isCorrect: hit, needsManualGrading: false };
      }
      // Several blanks: answers are positional, and `|` separates accepted
      // alternatives inside a single position ("1|١" for the first blank).
      const groups = rawAccepted.map((answer) =>
        answer.split("|").map(normalizeAnswer),
      );
      const hits = blanks.filter((blank, index) =>
        (groups[index] ?? []).includes(normalizeAnswer(blank)),
      ).length;
      const ratio = hits / blanks.length;
      return {
        awardedMarks: round2(marks * ratio),
        isCorrect: hits === blanks.length,
        needsManualGrading: false,
      };
    }
    case "short_answer": {
      if (isManualOnly(snapshot)) {
        return { awardedMarks: 0, isCorrect: undefined, needsManualGrading: true };
      }
      const accepted = (snapshot.acceptedAnswers ?? []).map(normalizeAnswer);
      const answer = normalizeAnswer(response.text ?? "");
      const isCorrect = answer.length > 0 && accepted.includes(answer);
      return {
        awardedMarks: isCorrect ? marks : 0,
        isCorrect,
        needsManualGrading: false,
      };
    }
    case "essay":
    default:
      return { awardedMarks: 0, isCorrect: undefined, needsManualGrading: true };
  }
}

export function hasResponse(snapshot: QuestionSnapshot, response: StoredResponse): boolean {
  if ((response.selectedKeys ?? []).length > 0) return true;
  if (response.booleanAnswer !== undefined) return true;
  if ((response.blanks ?? []).some((b) => b.trim().length > 0)) return true;
  if ((response.text ?? "").trim().length > 0) return true;
  return false;
}
