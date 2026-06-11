/** Wall QR payload for mobile check-in/out: gym://branch?gymId=...&branchId=... */
export function buildBranchCheckInQrValue(gymId: string, branchId: string): string {
  return `gym://branch?gymId=${encodeURIComponent(gymId)}&branchId=${encodeURIComponent(branchId)}`;
}
