import type { Language } from "@/i18n";

/**
 * Rendering helpers for *submitted* answers, shared by the student result review
 * and the teacher grading sheet.
 *
 * The rule these exist to enforce: an answer that was recorded must never be
 * shown as "not answered". Two things used to break that:
 *
 * 1. Option text was resolved with the active language only, so an option whose
 *    translation was blank rendered as an empty string — and the caller, seeing
 *    an empty string, fell back to "unanswered".
 * 2. The fallback was decided from the *rendered text* rather than from the
 *    stored response, so a non-empty response with no visible text looked
 *    unanswered.
 *
 * Option text now resolves through a chain (active language → other language →
 * option key) and the fallback is decided from the stored response itself.
 */

export type StoredAnswerResponse = {
  selectedKeys: string[];
  text?: string;
  blanks?: string[];
  booleanAnswer?: boolean;
};

export type AnswerOption = { key: string; textEn: string; textAr: string };

export function optionText(
  option: AnswerOption | undefined,
  key: string,
  lang: Language,
): string {
  if (!option) return key;
  const primary = lang === "ar" ? option.textAr : option.textEn;
  const secondary = lang === "ar" ? option.textEn : option.textAr;
  return primary?.trim() || secondary?.trim() || key;
}

/** Mirrors the server's `hasResponse`: does this response carry an answer? */
export function hasStoredAnswer(
  response: StoredAnswerResponse | undefined,
): boolean {
  if (!response) return false;
  if ((response.selectedKeys ?? []).some((key) => key.length > 0)) return true;
  if (response.booleanAnswer !== undefined) return true;
  if ((response.blanks ?? []).some((blank) => blank.trim().length > 0)) return true;
  if ((response.text ?? "").trim().length > 0) return true;
  return false;
}

/**
 * The parts of a stored answer, in reading order. Returns an empty array only
 * when the student genuinely did not answer.
 */
export function storedAnswerParts(
  response: StoredAnswerResponse | undefined,
  options: AnswerOption[],
  labels: { yes: string; no: string },
  lang: Language,
): string[] {
  const parts: string[] = [];

  const text = (response?.text ?? "").trim();
  if (text) parts.push(text);

  const blanks = (response?.blanks ?? []).filter((blank) => blank.trim().length > 0);
  if (blanks.length > 0) parts.push(blanks.join(" · "));

  const keys = (response?.selectedKeys ?? []).filter((key) => key.length > 0);
  if (keys.length > 0) {
    parts.push(
      keys
        .map((key) =>
          optionText(
            options.find((option) => option.key === key),
            key,
            lang,
          ),
        )
        .join(" · "),
    );
  }

  if (response?.booleanAnswer !== undefined) {
    parts.push(response.booleanAnswer ? labels.yes : labels.no);
  }

  return parts;
}

export function storedAnswerText(
  response: StoredAnswerResponse | undefined,
  options: AnswerOption[],
  labels: { yes: string; no: string },
  lang: Language,
): string {
  return storedAnswerParts(response, options, labels, lang).join("\n");
}

/** The correct answer(s) of a question, with the same text fallback chain. */
export function correctAnswerParts(
  options: (AnswerOption & { correct: boolean })[],
  acceptedAnswers: string[] | undefined,
  lang: Language,
): string[] {
  const parts: string[] = [];
  const correct = options.filter((option) => option.correct);
  if (correct.length > 0) {
    parts.push(correct.map((option) => optionText(option, option.key, lang)).join(" · "));
  }
  const accepted = (acceptedAnswers ?? []).filter(Boolean);
  if (accepted.length > 0) parts.push(accepted.join(" / "));
  return parts;
}
