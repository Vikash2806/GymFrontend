export type ExpenseCategory = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseRow = {
  id: string;
  gymId: string;
  branchId: string | null;
  branchName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  amount: number;
  date: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseCategoriesResponse = {
  success: boolean;
  message?: string;
  categories?: ExpenseCategory[];
};

export type ExpensesListResponse = {
  success: boolean;
  message?: string;
  expenses?: ExpenseRow[];
  total?: number;
  page?: number;
  pageSize?: number;
};

export type ExpenseMutationResponse = {
  success: boolean;
  message?: string;
  expense?: ExpenseRow;
  category?: ExpenseCategory;
};

export type ExpenseCategorySummaryRow = {
  categoryId: string | null;
  categoryName: string;
  totalAmount: number;
  expenseCount: number;
};

export type ExpenseCategorySummaryResponse = {
  success: boolean;
  message?: string;
  year?: number;
  month?: number;
  summary?: ExpenseCategorySummaryRow[];
  totalAmount?: number;
};
