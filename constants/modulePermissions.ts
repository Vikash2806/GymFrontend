import type { FeatureKey } from "./featureMap";

export type ModuleAction = "view" | "add" | "edit" | "delete";

export type CrudModuleId =
  | "membership_plans"
  | "members"
  | "member_subscriptions"
  | "expenses"
  | "staff";

export type CrudModuleSection = "master" | "operations" | "expenses" | "staff";

export type CrudModuleConfig = {
  id: CrudModuleId;
  label: string;
  baseKey: FeatureKey;
  section: CrudModuleSection;
};

export const CRUD_MODULES: readonly CrudModuleConfig[] = [
  {
    id: "membership_plans",
    label: "Membership Plans",
    baseKey: "membership_plans",
    section: "master"
  },
  { id: "members", label: "Members", baseKey: "member_management", section: "operations" },
  {
    id: "member_subscriptions",
    label: "Member subscriptions",
    baseKey: "subscription_management",
    section: "operations"
  },
  { id: "expenses", label: "Expenses", baseKey: "expenses", section: "expenses" },
  { id: "staff", label: "Staff / Manager", baseKey: "staff_management", section: "staff" }
] as const;

export const CRUD_MODULE_BASE_KEYS = new Set<string>(CRUD_MODULES.map((module) => module.baseKey));

export const HIDDEN_FEATURES = ["packages"] as const;

export const FEATURE_DEPENDENCIES: Partial<Record<string, string[]>> = {
  membership_plans: ["packages"]
};

export const GRANULAR_ACTION_KEYS = [
  "membership_plans_add",
  "membership_plans_edit",
  "membership_plans_delete",
  "member_management_add",
  "member_management_edit",
  "member_management_delete",
  "member_management_import",
  "member_management_export",
  "member_management_new_membership",
  "member_management_overdue_payment",
  "member_management_cancel_membership",
  "transactions_export",
  "subscription_management_add",
  "subscription_management_edit",
  "subscription_management_delete",
  "expenses_add",
  "expenses_edit",
  "expenses_delete",
  "expenses_export",
  "staff_management_add",
  "staff_management_edit",
  "staff_management_delete",
  "staff_management_export",
  "branch_management_create",
  "branch_management_edit",
  "branch_management_delete",
  "branch_management_export"
] as const;

export function moduleActionKey(baseKey: string, action: Exclude<ModuleAction, "view">): string {
  return `${baseKey}_${action}`;
}

export function getCrudModuleByBaseKey(baseKey: string): CrudModuleConfig | undefined {
  return CRUD_MODULES.find((module) => module.baseKey === baseKey);
}

export function hasGranularActionKeys(features: string[], baseKey: string): boolean {
  return (
    features.includes(moduleActionKey(baseKey, "add")) ||
    features.includes(moduleActionKey(baseKey, "edit")) ||
    features.includes(moduleActionKey(baseKey, "delete"))
  );
}

export function applyFeatureDependencies(features: FeatureKey[]): FeatureKey[] {
  const next = new Set(features);
  for (const [parent, deps] of Object.entries(FEATURE_DEPENDENCIES)) {
    if (!deps?.length || !next.has(parent as FeatureKey)) {
      continue;
    }
    for (const dep of deps) {
      next.add(dep as FeatureKey);
    }
  }
  return [...next];
}
