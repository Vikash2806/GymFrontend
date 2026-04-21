export const FEATURE_MAP = {
  dashboard: ["dashboard"],
  master: ["membership_plans", "packages"],
  operations: ["member_management", "subscription_management"],
  branches: ["branch_management"],
  billing: ["billing_dashboard"],
  finance: ["financial_overview"],
  expenses: ["expenses"],
  staff: ["staff_management"],
  settings: ["settings", "gym_profile"],
  admin_only: ["user_management", "rbac_settings"]
} as const;

export type FeatureSection = keyof typeof FEATURE_MAP;
export type FeatureKey = (typeof FEATURE_MAP)[FeatureSection][number];

const ALL_FEATURE_SET = new Set<string>(Object.values(FEATURE_MAP).flatMap((items) => items));

export const ALL_FEATURE_KEYS = [...ALL_FEATURE_SET] as FeatureKey[];

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === "string" && ALL_FEATURE_SET.has(value);
}
