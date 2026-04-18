export type MembershipPlan = {
  _id: string;
  gymId: string;
  branchId: string;
  name: string;
  type: string;
  duration: number;
  price: number;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MembershipPlanInput = {
  branchId: string;
  name: string;
  type: string;
  duration: number;
  price: number;
  description: string;
  isActive?: boolean;
};
