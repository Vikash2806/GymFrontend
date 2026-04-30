export type PricingPlanLimitKey = "members" | "users" | "branches" | "expenses";

export type PricingPlan = {
  id: string;
  name: string;
  description: string;
  currency: "INR";
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  popular?: boolean;
  features: string[];
  limits: Record<PricingPlanLimitKey, number>;
};

export type PricingPlansResponse = {
  success: boolean;
  version?: number;
  notes?: string;
  plans?: PricingPlan[];
  message?: string;
};

export type GymPlanResponse = {
  success: boolean;
  pricingVersion?: number;
  gymSubscription?: {
    planId?: string | null;
    planName?: string;
    durationType?: "monthly" | "yearly" | null;
    status?: string;
    subscriptionStatus?: string;
    paymentStatus?: string;
    startDate?: string | null;
    endDate?: string | null;
    billingStart?: string | null;
    billingEnd?: string | null;
  };
  plan?: PricingPlan | null;
  message?: string;
};
