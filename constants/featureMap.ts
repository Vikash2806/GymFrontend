export const FEATURE_MAP = {
  dashboard: ["dashboard"],
  master: ["membership_plans", "membership_plans_add", "membership_plans_edit", "membership_plans_delete", "packages"],
  operations: [
    "member_management",
    "member_management_add",
    "member_management_edit",
    "member_management_delete",
    "subscription_management",
    "subscription_management_add",
    "subscription_management_edit",
    "subscription_management_delete",
    "transactions",
    "transactions_export"
  ],
  branches: ["branch_management"],
  billing: ["billing_dashboard"],
  expenses: ["expenses", "expenses_add", "expenses_edit", "expenses_delete"],
  staff: ["staff_management", "staff_management_add", "staff_management_edit", "staff_management_delete"],
  settings: ["settings", "gym_profile", "subscription_pricing"],
  admin_only: ["user_management", "rbac_settings"]
} as const;

export type FeatureSection = keyof typeof FEATURE_MAP;
export type FeatureKey = (typeof FEATURE_MAP)[FeatureSection][number];

const ALL_FEATURE_SET = new Set<string>(Object.values(FEATURE_MAP).flatMap((items) => items));

export const ALL_FEATURE_KEYS = [...ALL_FEATURE_SET] as FeatureKey[];

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === "string" && ALL_FEATURE_SET.has(value);
}
