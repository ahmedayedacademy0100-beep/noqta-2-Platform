import { useI18n } from "@/i18n";

export type LandingCopyEntry = { key: string; en: string; ar: string };

/** Same signature as `t`, so it can replace it one-for-one. */
export type CopyFn = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

function interpolate(
  value: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return value;
  return Object.entries(vars).reduce(
    (out, [name, replacement]) => out.split(`{${name}}`).join(String(replacement)),
    value,
  );
}

/**
 * Landing copy resolution.
 *
 * Everything the owner edits in Admin → Settings is stored on
 * `platform_settings.landingCopy` under its i18n key. An override wins when it
 * has text; otherwise the shipped dictionary string is used, so the page can
 * never render an empty heading.
 */
export function useLandingCopy(
  entries: LandingCopyEntry[] | undefined,
): CopyFn {
  const { t, lang } = useI18n();
  const overrides = new Map<string, LandingCopyEntry>();
  for (const entry of entries ?? []) overrides.set(entry.key, entry);

  return (key, vars) => {
    const entry = overrides.get(key);
    if (entry) {
      const value =
        lang === "ar" ? entry.ar.trim() || entry.en.trim() : entry.en.trim() || entry.ar.trim();
      if (value.length > 0) return interpolate(value, vars);
    }
    return t(key, vars);
  };
}
