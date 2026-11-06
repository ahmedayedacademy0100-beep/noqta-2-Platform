import { ConvexError } from "convex/values";

type Translate = (key: string, params?: Record<string, string | number>) => string;
type Language = "en" | "ar";

/**
 * Convex denies requests with `{ code, messageEn, messageAr }`. The code is
 * translated on the client, so the same failure reads correctly in Arabic and
 * English without shipping user-facing strings from the server.
 */
export function describeError(
  error: unknown,
  t: Translate,
  lang: Language,
): string {
  if (error instanceof ConvexError) {
    const data = error.data as
      | { code?: string; messageEn?: string; messageAr?: string }
      | undefined;
    if (data?.code) {
      const key = `error.${data.code}`;
      const translated = t(key);
      if (translated !== key) return translated;
    }
    const fallback = lang === "ar" ? data?.messageAr : data?.messageEn;
    if (fallback) return fallback;
    if (data?.messageEn) return data.messageEn;
  }
  if (error instanceof Error) return error.message;
  return t("error.title");
}

/** True when the failure means "show the 403 screen" rather than a toast. */
export function isAccessDenied(error: unknown): boolean {
  if (!(error instanceof ConvexError)) return false;
  const code = (error.data as { code?: string } | undefined)?.code;
  return code === "FORBIDDEN" || code === "SUSPENDED" || code === "NO_PROFILE";
}

/** True when the caller is simply not signed in. */
export function isUnauthenticated(error: unknown): boolean {
  if (!(error instanceof ConvexError)) return false;
  return (error.data as { code?: string } | undefined)?.code === "UNAUTHENTICATED";
}
