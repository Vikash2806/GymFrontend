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
  expenseType:
    | "employee_salary"
    | "equipment_repair"
    | "sanitary_worker_salary"
    | "gym_rent"
    | "food_expense"
    | "custom";
  expenseTypeLabel?: string;
  employeeUserId?: string | null;
  employeeName?: string | null;
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
  startDate?: string;
  endDateExclusive?: string;
  summary?: ExpenseCategorySummaryRow[];
  totalAmount?: number;
};

export type ExpenseEmployeeOption = {
  id: string;
  fullName: string;
  phone: string;
  role: "manager" | "staff";
  branchIds: string[];
};

export type ExpenseEmployeesResponse = {
  success: boolean;
  message?: string;
  staffUsers?: ExpenseEmployeeOption[];
};
