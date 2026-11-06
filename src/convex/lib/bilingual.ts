/**
 * Bilingual content is stored as an (English, Arabic) pair so the UI can pick
 * the field that matches the reader's language. Authors are *not* forced to
 * write both: `bilingualPair` mirrors whichever side they filled in, so
 * `pick(en, ar)` renders the same text in either language instead of an empty
 * string. Writing both languages still works exactly as before.
 */
export function bilingualPair(
  en: string | undefined,
  ar: string | undefined,
): { en: string; ar: string } {
  const primary = (en ?? "").trim();
  const secondary = (ar ?? "").trim();
  if (primary && secondary) return { en: primary, ar: secondary };
  if (primary) return { en: primary, ar: primary };
  return { en: secondary, ar: secondary };
}

/** True when at least one language was filled in with real content. */
export function hasBilingualContent(
  en: string | undefined,
  ar: string | undefined,
  minLength = 1,
): boolean {
  return (en ?? "").trim().length >= minLength || (ar ?? "").trim().length >= minLength;
}
