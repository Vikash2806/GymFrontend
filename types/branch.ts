export type BranchRow = {
  id: string;
  code: string;
  name: string;
  contact: {
    phone: string;
    email: string | null;
  };
  address: {
    country: string;
    state: string;
    city: string;
    line1: string;
    line2: string;
    pincode: string;
  };
  timezone: string;
  status: "active" | "inactive";
  memberCount: number;
  manager: {
    id: string;
    fullName: string;
    status: "active" | "inactive";
  } | null;
};

export type BranchesListResponse = {
  success: boolean;
  stats: {
    totalBranches: number;
    activeBranches: number;
    totalMembers: number;
  };
  branches: BranchRow[];
  total: number;
  page: number;
  pageSize: number;
  message?: string;
};

export type BranchMutationResponse = {
  success: boolean;
  branch?: BranchRow;
  message?: string;
  token?: string;
  defaults?: { gymId: string; branchId: string };
};
