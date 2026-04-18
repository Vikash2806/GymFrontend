/** Same pattern as backend `memberValidation.parseOptionalEmail`. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns normalized email or `null` if empty/invalid (optional field). */
export function normalizeOptionalEmail(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const s = value.trim().toLowerCase();
  if (!s) {
    return null;
  }
  if (!EMAIL_RE.test(s) || s.length > 254) {
    return null;
  }
  return s;
}
