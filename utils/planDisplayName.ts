/**
 * Membership plan names from imports sometimes include a trailing price segment
 * (e.g. "3 Months - ₹1000"). UI should show the plan label only (e.g. "3 Months").
 */
export function stripPlanNamePriceSuffix(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") {
    return "";
  }
  return raw
    .replace(/\s*[-–—]\s*(?:₹|Rs\.?)\s*[\d,]+(?:\.\d+)?\s*$/i, "")
    .trim();
}
