export type GymUsageSnapshotResponse = {
  success: boolean;
  message?: string;
  usage?: {
    members: number;
    users: number;
    branches: number;
    expenses: number;
    maxMembers: number;
    maxUsers: number;
    maxBranches: number;
    maxExpenses: number;
  };
  limitsReached?: {
    members: boolean;
    users: boolean;
    branches: boolean;
    expenses: boolean;
  };
  planName?: string;
};
