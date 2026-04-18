const INDIAN_MOBILE_REGEX = /^(?:\+91|91)?[6-9]\d{9}$/;

export function sanitizeMobileNumber(input: string): string {
  return input.replace(/[^\d+]/g, "");
}

/** Strips non-digits and keeps at most the last 10 digits (for controlled form fields). */
export function stripToIndianMobileDigits(value: unknown): string {
  const raw = String(value ?? "").replace(/\D/g, "");
  return raw.length > 10 ? raw.slice(-10) : raw;
}

export function normalizeIndianMobileNumber(input: string): string | null {
  const sanitized = sanitizeMobileNumber(input).replace(/\s+/g, "");

  if (!INDIAN_MOBILE_REGEX.test(sanitized)) {
    return null;
  }

  const digitsOnly = sanitized.replace(/\D/g, "");
  const localNumber = digitsOnly.length === 10 ? digitsOnly : digitsOnly.slice(-10);

  return localNumber.length === 10 ? localNumber : null;
}

export function toE164IndianMobile(input: string): string | null {
  const normalized = normalizeIndianMobileNumber(input);
  return normalized ? `+91${normalized}` : null;
}

export function isValidIndianMobile(input: string): boolean {
  return normalizeIndianMobileNumber(input) !== null;
}
