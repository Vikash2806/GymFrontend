import type { SessionPayload } from "@/redux/features/auth/sessionTypes";
import { getFirstAccessibleRouteFromAccess } from "@/utils/routeAccess";
import {
  canViewMemberPayments,
  defaultManagerPermissions,
  defaultStaffPermissions,
  hasAnyModuleView,
  hasModulePermission,
  migrateFlatArraysToNested,
  permissionsFromUnknown,
  type ModuleKey,
  type PermissionAction,
  type RolePermissionMap
} from "@/constants/permissionSchema";

export const FEATURES = {
  DASHBOARD: "dashboard",
  MEMBERSHIP_PLANS: "membership_plans",
  PACKAGES: "packages",
  MEMBER_MANAGEMENT: "member_management",
  SUBSCRIPTION_MANAGEMENT: "subscription_management",
  TRANSACTIONS: "transactions",
  BRANCH_MANAGEMENT: "branch_management",
  EXPENSES: "expenses",
  STAFF_MANAGEMENT: "staff_management",
  SETTINGS: "settings",
  GYM_PROFILE: "gym_profile",
  SUBSCRIPTION_PRICING: "subscription_pricing",
  USER_MANAGEMENT: "user_management",
  RBAC_SETTINGS: "rbac_settings"
} as const;

export const PERMISSIONS = FEATURES;

export type Permission = (typeof FEATURES)[keyof typeof FEATURES] | ModuleKey | string;

export type { PermissionAction, RolePermissionMap };

function resolveRole(session: SessionPayload | null): string {
  return String(session?.rbac?.role ?? "").toLowerCase();
}

function fallbackPermissionsByRole(session: SessionPayload | null): RolePermissionMap {
  const role = resolveRole(session);
  if (role === "manager") {
    return defaultManagerPermissions();
  }
  if (role === "staff") {
    return defaultStaffPermissions();
  }
  return {};
}

export function permissionsFromSession(session: SessionPayload | null): RolePermissionMap {
  const role = resolveRole(session);
  if (role === "owner") {
    return {};
  }
  const raw = session?.rbac?.permissions;
  if (raw && (Array.isArray(raw) ? raw.length > 0 : Object.keys(raw).length > 0)) {
    return permissionsFromUnknown(raw, role);
  }
  return fallbackPermissionsByRole(session);
}

/** @deprecated Use permissionsFromSession — kept for gradual migration. */
export function featuresFromSession(session: SessionPayload | null): string[] {
  const map = permissionsFromSession(session);
  const role = resolveRole(session);
  if (role === "owner") {
    return Object.values(FEATURES);
  }
  const keys: string[] = [];
  for (const [module, perm] of Object.entries(map)) {
    if (!perm) {
      continue;
    }
    if (perm.view) {
      keys.push(module);
    }
    for (const [action, enabled] of Object.entries(perm)) {
      if (action === "view" || !enabled) {
        continue;
      }
      keys.push(`${module}_${action}`);
      if (action === "create") {
        keys.push(`${module}_add`);
      }
    }
  }
  return keys;
}

export function hasFeature(session: SessionPayload | null, permission: Permission): boolean {
  return hasModuleAction(session, String(permission), "view");
}

export const hasPermission = hasFeature;

export function canExportModule(session: SessionPayload | null, baseKey: string): boolean {
  return hasModuleAction(session, baseKey, "export");
}

export function hasModuleAction(
  session: SessionPayload | null,
  baseKey: string,
  action: PermissionAction
): boolean {
  const role = resolveRole(session);
  if (role === "owner") {
    return true;
  }
  const permissions = permissionsFromSession(session);
  return hasModulePermission(permissions, baseKey, action, role);
}

export function hasAnyModuleViewForSession(session: SessionPayload | null, baseKeys: string[]): boolean {
  const role = resolveRole(session);
  if (role === "owner") {
    return true;
  }
  return hasAnyModuleView(permissionsFromSession(session), baseKeys, role);
}

export function canViewMemberPaymentsForSession(session: SessionPayload | null): boolean {
  const role = resolveRole(session);
  if (role === "owner") {
    return true;
  }
  return canViewMemberPayments(permissionsFromSession(session), role);
}

export function getFirstAccessibleRoute(session: SessionPayload | null): string {
  return getFirstAccessibleRouteFromAccess(session);
}
