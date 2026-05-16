import type { SessionPayload } from "@/redux/features/auth/sessionTypes";
import {
  getFirstAccessibleSettingsRoute,
  hasAnySettingsView,
  isSettingsPath,
  SETTINGS_DEFAULT_ROUTE,
  SETTINGS_ROUTES
} from "@/app/(dashboard)/pages/settings/settingsRoutes";
import {
  defaultManagerPermissions,
  defaultStaffPermissions,
  hasModulePermission,
  permissionsFromUnknown,
  type PermissionAction,
  type RolePermissionMap
} from "@/constants/permissionSchema";

export const FEATURES = {
  DASHBOARD: "dashboard",
  MEMBERSHIP_PLANS: "membership_plans",
  MEMBER_MANAGEMENT: "member_management",
  TRANSACTIONS: "transactions",
  BRANCH_MANAGEMENT: "branch_management",
  EXPENSES: "expenses",
  STAFF_MANAGEMENT: "staff_management",
  SETTINGS: "settings",
  GYM_PROFILE: "gym_profile",
  SUBSCRIPTION_PRICING: "subscription_pricing",
  RBAC_SETTINGS: "rbac_settings"
} as const;

export type MainNavItemKey =
  | "Dashboard"
  | "Branches"
  | "GymMembers"
  | "Transactions"
  | "Expenses"
  | "StaffManager"
  | "RbacAdmin"
  | "Settings";

export type SettingsNavItemKey = "settings-profile" | "settings-gym" | "settings-pricing";

type RouteAccessChecker = (session: SessionPayload | null) => boolean;

function resolveRole(session: SessionPayload | null): string {
  return String(session?.rbac?.role ?? "").toLowerCase();
}

function permissionsFromSession(session: SessionPayload | null): RolePermissionMap {
  const role = resolveRole(session);
  if (role === "owner") {
    return {};
  }
  const raw = session?.rbac?.permissions;
  if (raw && (Array.isArray(raw) ? raw.length > 0 : Object.keys(raw).length > 0)) {
    return permissionsFromUnknown(raw, role);
  }
  if (role === "manager") {
    return defaultManagerPermissions();
  }
  if (role === "staff") {
    return defaultStaffPermissions();
  }
  return {};
}

function hasModuleAction(
  session: SessionPayload | null,
  baseKey: string,
  action: PermissionAction
): boolean {
  const role = resolveRole(session);
  if (role === "owner") {
    return true;
  }
  return hasModulePermission(permissionsFromSession(session), baseKey, action, role);
}

function hasFeature(session: SessionPayload | null, module: string): boolean {
  return hasModuleAction(session, module, "view");
}

/** Ordered most-specific first for pathname matching. */
const PROTECTED_ROUTE_ACCESS: ReadonlyArray<{ path: string; allowed: RouteAccessChecker }> = [
  {
    path: SETTINGS_ROUTES.profile,
    allowed: (session) => hasFeature(session, FEATURES.SETTINGS)
  },
  {
    path: SETTINGS_ROUTES.gym,
    allowed: (session) => hasFeature(session, FEATURES.GYM_PROFILE)
  },
  {
    path: SETTINGS_ROUTES.subscription,
    allowed: (session) => hasFeature(session, FEATURES.SUBSCRIPTION_PRICING)
  },
  {
    path: "/pages/settings",
    allowed: (session) => hasAnySettingsView(session)
  },
  { path: "/admin/rbac", allowed: (session) => hasFeature(session, FEATURES.RBAC_SETTINGS) },
  {
    path: "/pages/billing",
    allowed: (session) => hasModuleAction(session, FEATURES.MEMBER_MANAGEMENT, "view")
  },
  {
    path: "/pages/members",
    allowed: (session) =>
      hasModuleAction(session, FEATURES.MEMBER_MANAGEMENT, "view") ||
      hasModuleAction(session, FEATURES.MEMBERSHIP_PLANS, "view")
  },
  {
    path: "/pages/transactions",
    allowed: (session) =>
      hasModuleAction(session, FEATURES.MEMBER_MANAGEMENT, "view") ||
      hasModuleAction(session, FEATURES.TRANSACTIONS, "view")
  },
  {
    path: "/pages/branches",
    allowed: (session) => hasModuleAction(session, FEATURES.BRANCH_MANAGEMENT, "view")
  },
  { path: "/pages/dashboard", allowed: (session) => hasModuleAction(session, FEATURES.DASHBOARD, "view") },
  { path: "/pages/expenses", allowed: (session) => hasModuleAction(session, FEATURES.EXPENSES, "view") },
  {
    path: "/pages/staff-manager",
    allowed: (session) => hasModuleAction(session, FEATURES.STAFF_MANAGEMENT, "view")
  }
];

/** First route the user may open after login or when redirected from a denied page. */
export const ACCESSIBLE_ROUTE_ORDER: ReadonlyArray<{ route: string; allowed: RouteAccessChecker }> = [
  {
    route: "/pages/members",
    allowed: (session) =>
      hasModuleAction(session, FEATURES.MEMBER_MANAGEMENT, "view") ||
      hasModuleAction(session, FEATURES.MEMBERSHIP_PLANS, "view")
  },
  { route: "/pages/dashboard", allowed: (session) => hasModuleAction(session, FEATURES.DASHBOARD, "view") },
  {
    route: "/pages/transactions",
    allowed: (session) =>
      hasModuleAction(session, FEATURES.MEMBER_MANAGEMENT, "view") ||
      hasModuleAction(session, FEATURES.TRANSACTIONS, "view")
  },
  { route: "/pages/expenses", allowed: (session) => hasModuleAction(session, FEATURES.EXPENSES, "view") },
  { route: "/pages/branches", allowed: (session) => hasModuleAction(session, FEATURES.BRANCH_MANAGEMENT, "view") },
  {
    route: "/pages/staff-manager",
    allowed: (session) => hasModuleAction(session, FEATURES.STAFF_MANAGEMENT, "view")
  },
  {
    route: SETTINGS_DEFAULT_ROUTE,
    allowed: (session) => hasFeature(session, FEATURES.SETTINGS)
  },
  {
    route: SETTINGS_ROUTES.gym,
    allowed: (session) => hasFeature(session, FEATURES.GYM_PROFILE)
  },
  {
    route: SETTINGS_ROUTES.subscription,
    allowed: (session) => hasFeature(session, FEATURES.SUBSCRIPTION_PRICING)
  },
  { route: "/admin/rbac", allowed: (session) => hasModuleAction(session, FEATURES.RBAC_SETTINGS, "view") }
];

function isOwnerSession(session: SessionPayload | null): boolean {
  return resolveRole(session) === "owner";
}

/**
 * Whether the current pathname is allowed for this session (Role Master permissions).
 * Returns true for unlisted non-dashboard paths (e.g. marketing pages).
 */
export function canAccessRoute(pathname: string, session: SessionPayload | null): boolean {
  if (isOwnerSession(session)) {
    return true;
  }

  if (isSettingsPath(pathname)) {
    const settingsRule = PROTECTED_ROUTE_ACCESS.find((rule) => rule.path === pathname);
    if (settingsRule) {
      return settingsRule.allowed(session);
    }
    return false;
  }

  const rule = PROTECTED_ROUTE_ACCESS.find((entry) => entry.path === pathname);
  if (rule) {
    return rule.allowed(session);
  }

  if (pathname.startsWith("/pages/") || pathname.startsWith("/admin/")) {
    return false;
  }

  return true;
}

export function getFirstAccessibleRouteFromAccess(session: SessionPayload | null): string {
  for (const entry of ACCESSIBLE_ROUTE_ORDER) {
    if (entry.allowed(session)) {
      return entry.route;
    }
  }
  return getFirstAccessibleSettingsRoute(session) ?? SETTINGS_DEFAULT_ROUTE;
}

export function isMainNavItemVisible(key: MainNavItemKey, session: SessionPayload | null): boolean {
  switch (key) {
    case "Dashboard":
      return hasModuleAction(session, FEATURES.DASHBOARD, "view");
    case "Branches":
      return hasModuleAction(session, FEATURES.BRANCH_MANAGEMENT, "view");
    case "GymMembers":
      return (
        hasModuleAction(session, FEATURES.MEMBER_MANAGEMENT, "view") ||
        hasModuleAction(session, FEATURES.MEMBERSHIP_PLANS, "view")
      );
    case "Transactions":
      return (
        hasModuleAction(session, FEATURES.MEMBER_MANAGEMENT, "view") ||
        hasModuleAction(session, FEATURES.TRANSACTIONS, "view")
      );
    case "Expenses":
      return hasModuleAction(session, FEATURES.EXPENSES, "view");
    case "StaffManager":
      return hasModuleAction(session, FEATURES.STAFF_MANAGEMENT, "view");
    case "RbacAdmin":
      return hasFeature(session, FEATURES.RBAC_SETTINGS);
    case "Settings":
      return hasAnySettingsView(session);
    default:
      return false;
  }
}

export function isSettingsNavItemVisible(key: SettingsNavItemKey, session: SessionPayload | null): boolean {
  switch (key) {
    case "settings-profile":
      return hasFeature(session, FEATURES.SETTINGS);
    case "settings-gym":
      return hasFeature(session, FEATURES.GYM_PROFILE);
    case "settings-pricing":
      return hasFeature(session, FEATURES.SUBSCRIPTION_PRICING);
    default:
      return false;
  }
}
