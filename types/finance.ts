export type FinanceOverviewPeriod = {
  year: number;
  month: number;
  startIso: string;
  endIso: string;
};

export type FinanceOverviewTotals = {
  revenue: number;
  overdue: number;
  expenses: number;
};

export type RevenueByDay = { day: number; amount: number };

export type RevenueByBranchRow = {
  branchId: string;
  branchName: string;
  revenue: number;
  overdue: number;
};

export type PaymentThisMonthRow = {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  paidAt: string;
  branchId: string;
  branchName?: string;
};

export type PendingMemberRow = {
  memberId: string;
  name: string;
  pendingAmount: number;
  planName: string;
  branchId: string;
};

export type FinanceOverviewPayload = {
  period: FinanceOverviewPeriod;
  totals: FinanceOverviewTotals;
  revenueByDay: RevenueByDay[];
  revenueByBranch: RevenueByBranchRow[];
  paymentsThisMonth: PaymentThisMonthRow[];
  paymentsThisMonthHasMore: boolean;
  pendingMembers: PendingMemberRow[];
  pendingMembersHasMore: boolean;
  pendingSummary: {
    totalMembers: number;
    totalPending: number;
    averagePending: number;
  };
};

export type FinanceOverviewResponse = {
  success: boolean;
  message?: string;
  overview?: FinanceOverviewPayload;
};
