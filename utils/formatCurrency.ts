/** INR with paise (matches finance / billing tables). */
export function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Whole rupees (no fractional part) — e.g. compact member list cells. */
export function formatInrWhole(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
