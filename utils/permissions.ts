import type { SessionPayload } from "@/redux/features/auth/sessionTypes";
import type { FeatureKey } from "@/constants/featureMap";

export const FEATURES = {
  DASHBOARD: "dashboard",
  MEMBERSHIP_PLANS: "membership_plans",
  PACKAGES: "packages",
  MEMBER_MANAGEMENT: "member_management",
  SUBSCRIPTION_MANAGEMENT: "subscription_management",
  BRANCH_MANAGEMENT: "branch_management",
  BILLING_DASHBOARD: "billing_dashboard",
  FINANCIAL_OVERVIEW: "financial_overview",
  EXPENSES: "expenses",
  STAFF_MANAGEMENT: "staff_management",
  SETTINGS: "settings",
  GYM_PROFILE: "gym_profile",
  USER_MANAGEMENT: "user_management",
  RBAC_SETTINGS: "rbac_settings"
} as const;

// Temporary alias to keep imports stable while pages migrate.
export const PERMISSIONS = FEATURES;

export type Permission = (typeof FEATURES)[keyof typeof FEATURES] | FeatureKey | string;

type GymMembershipRole = "owner" | "manager" | "staff";

function gymRoleFromSession(session: SessionPayload | null): GymMembershipRole | null {
  if (!session?.user?.defaults?.gymId || !Array.isArray(session.user.associatedGyms)) {
    return null;
  }
  const gymId = session.user.defaults.gymId;
  const membership = session.user.associatedGyms.find((g) => g.gymId === gymId);
  const role = membership?.gymRole;
  if (role === "owner" || role === "manager" || role === "staff") {
    return role;
  }
  return null;
}

function fallbackFeaturesByRole(session: SessionPayload | null): FeatureKey[] {
  const role =
    session?.rbac?.role?.toLowerCase() === "owner" ||
    session?.rbac?.role?.toLowerCase() === "manager" ||
    session?.rbac?.role?.toLowerCase() === "staff"
      ? (session.rbac.role.toLowerCase() as GymMembershipRole)
      : gymRoleFromSession(session);

  if (role === "owner") {
    return Object.values(FEATURES);
  }
  if (role === "manager") {
    return [
      FEATURES.DASHBOARD,
      FEATURES.MEMBERSHIP_PLANS,
      FEATURES.MEMBER_MANAGEMENT,
      FEATURES.SUBSCRIPTION_MANAGEMENT,
      FEATURES.BILLING_DASHBOARD,
      FEATURES.FINANCIAL_OVERVIEW
    ];
  }
  if (role === "staff") {
    return [
      FEATURES.DASHBOARD,
      FEATURES.MEMBERSHIP_PLANS,
      FEATURES.MEMBER_MANAGEMENT,
      FEATURES.SUBSCRIPTION_MANAGEMENT,
      FEATURES.BILLING_DASHBOARD
    ];
  }
  return [];
}

export function featuresFromSession(session: SessionPayload | null): FeatureKey[] {
  const role = String(session?.rbac?.role ?? "").toLowerCase();
  if (role === "owner") {
    return Object.values(FEATURES);
  }
  const fromRbac = (session?.rbac?.permissions ?? []).map((value) => String(value).trim()).filter(Boolean);
  if (fromRbac.length > 0) {
    return [...new Set(fromRbac)] as FeatureKey[];
  }
  return fallbackFeaturesByRole(session);
}

// Backward-compatible alias used by current sidebar; now returns feature keys.
export function permissionsFromSession(session: SessionPayload | null): FeatureKey[] {
  return featuresFromSession(session);
}

export function hasFeature(session: SessionPayload | null, permission: Permission): boolean {
  const required = String(permission);
  const features = featuresFromSession(session);
  if (features.includes(required as FeatureKey)) {
    return true;
  }
  // Backward compatibility with old RBAC snapshots where branches were gated by "settings".
  if (required === FEATURES.BRANCH_MANAGEMENT && features.includes(FEATURES.SETTINGS as FeatureKey)) {
    return true;
  }
  return false;
}

export const hasPermission = hasFeature;

const FEATURE_ROUTE_ORDER: Array<{ feature: FeatureKey; route: string }> = [
  { feature: FEATURES.MEMBER_MANAGEMENT, route: "/pages/members" },
  { feature: FEATURES.DASHBOARD, route: "/pages/dashboard" },
  { feature: FEATURES.BILLING_DASHBOARD, route: "/pages/billing" },
  { feature: FEATURES.FINANCIAL_OVERVIEW, route: "/pages/finance" },
  { feature: FEATURES.EXPENSES, route: "/pages/expenses" },
  { feature: FEATURES.BRANCH_MANAGEMENT, route: "/pages/branches" },
  { feature: FEATURES.STAFF_MANAGEMENT, route: "/pages/staff-manager" },
  { feature: FEATURES.SETTINGS, route: "/pages/settings" },
  { feature: FEATURES.RBAC_SETTINGS, route: "/admin/rbac" }
];

export function getFirstAccessibleRoute(session: SessionPayload | null): string {
  const features = featuresFromSession(session);
  for (const entry of FEATURE_ROUTE_ORDER) {
    if (features.includes(entry.feature as FeatureKey)) {
      return entry.route;
    }
  }
  return "/pages/settings";
}

type SidebarModule = "members" | "plans" | "subscriptions" | "payments" | "finance" | "expenses" | "branches" | "staff" | "settings";

const MODULE_TO_FEATURE: Record<SidebarModule, FeatureKey> = {
  members: FEATURES.MEMBER_MANAGEMENT,
  plans: FEATURES.MEMBERSHIP_PLANS,
  subscriptions: FEATURES.SUBSCRIPTION_MANAGEMENT,
  payments: FEATURES.BILLING_DASHBOARD,
  finance: FEATURES.FINANCIAL_OVERVIEW,
  expenses: FEATURES.EXPENSES,
  branches: FEATURES.BRANCH_MANAGEMENT,
  staff: FEATURES.STAFF_MANAGEMENT,
  settings: FEATURES.SETTINGS
};

export function canAccessModule(features: string[], module: SidebarModule): boolean {
  const required = MODULE_TO_FEATURE[module];
  return features.includes(required);
}
