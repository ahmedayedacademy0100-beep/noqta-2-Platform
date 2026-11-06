/**
 * Class contact numbers are stored as a bare `+<digits>` string so they can be
 * dropped straight into a `wa.me` link. Anything else (letters, spaces, a
 * missing country code that leaves too few digits) is rejected rather than
 * silently stored.
 */
export function normalizeWhatsapp(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return `+${digits}`;
}
