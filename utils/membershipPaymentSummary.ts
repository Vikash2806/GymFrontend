export type MembershipPaymentSummaryInput = {
  planPrice: number;
  miscFeeAmount?: number;
  personalTrainerFeeAmount?: number;
  discountAmount?: number;
  paidAmount?: number;
  miscFeesEnabled?: boolean;
  personalTrainerEnabled?: boolean;
};

export type MembershipPaymentSummary = {
  planAmount: number;
  miscFeeAmount: number;
  personalTrainerFeeAmount: number;
  discountAmount: number;
  subtotalAmount: number;
  finalPayableAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "paid" | "partial" | "pending";
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeMoney(value: unknown): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return roundMoney(numeric);
}

/** Plan + misc + trainer; discount is applied only when computing final (never added to subtotal). */
export function computeMembershipMoneyLines(
  input: MembershipPaymentSummaryInput
): Pick<
  MembershipPaymentSummary,
  "planAmount" | "miscFeeAmount" | "personalTrainerFeeAmount" | "discountAmount" | "subtotalAmount" | "finalPayableAmount"
> {
  const planAmount = normalizeMoney(input.planPrice);
  const miscFeeAmount = input.miscFeesEnabled === false ? 0 : normalizeMoney(input.miscFeeAmount);
  const personalTrainerFeeAmount =
    input.personalTrainerEnabled === false ? 0 : normalizeMoney(input.personalTrainerFeeAmount);
  const subtotalAmount = roundMoney(planAmount + miscFeeAmount + personalTrainerFeeAmount);
  const discountAmount = Math.min(normalizeMoney(input.discountAmount), subtotalAmount);
  const finalPayableAmount = roundMoney(Math.max(0, subtotalAmount - discountAmount));
  return {
    planAmount,
    miscFeeAmount,
    personalTrainerFeeAmount,
    discountAmount,
    subtotalAmount,
    finalPayableAmount
  };
}

export function calculateMembershipPaymentSummary(
  input: MembershipPaymentSummaryInput
): MembershipPaymentSummary {
  const { planAmount, miscFeeAmount, personalTrainerFeeAmount, discountAmount, subtotalAmount, finalPayableAmount } =
    computeMembershipMoneyLines(input);
  const paidAmount = Math.min(normalizeMoney(input.paidAmount), finalPayableAmount);
  const remainingAmount = roundMoney(Math.max(0, finalPayableAmount - paidAmount));
  const status: MembershipPaymentSummary["status"] =
    remainingAmount <= 0 ? "paid" : paidAmount > 0 ? "partial" : "pending";

  return {
    planAmount,
    miscFeeAmount,
    personalTrainerFeeAmount,
    discountAmount,
    subtotalAmount,
    finalPayableAmount,
    paidAmount,
    remainingAmount,
    status
  };
}
