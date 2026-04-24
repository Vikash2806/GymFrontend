export const PASSWORD_MIN_LENGTH = 6;

export const PASSWORD_MIN_LENGTH_MESSAGE = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;

export function isPasswordLongEnough(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  return value.trim().length >= PASSWORD_MIN_LENGTH;
}

export async function validateOptionalPasswordMinLength(_: unknown, value: unknown): Promise<void> {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return;
  }
  if (!isPasswordLongEnough(raw)) {
    throw new Error(PASSWORD_MIN_LENGTH_MESSAGE);
  }
}
