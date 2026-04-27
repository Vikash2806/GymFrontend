export type StaffUserRow = {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  role: "manager" | "staff" | null;
  branch: { id: string; code: string; name: string };
  branches?: Array<{ id: string; code: string; name: string }>;
  salarySummary?: {
    lifetimeTotal: number;
    currentMonthTotal: number;
    currentMonthKey: string;
  };
  status: "active" | "inactive";
  createdAt: string;
};

export type StaffUsersListResponse = {
  success: boolean;
  users?: StaffUserRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
};

export type StaffUserMutationResponse = {
  success: boolean;
  user?: StaffUserRow;
  message?: string;
};

export type StaffUserExpenseTransaction = {
  id: string;
  categoryId: string | null;
  amount: number;
  date: string;
  notes: string;
  createdAt: string;
};

export type StaffUserDetailsResponse = {
  success: boolean;
  user?: StaffUserRow;
  transactions?: StaffUserExpenseTransaction[];
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
};
