import type { SessionPayload } from "@/redux/features/auth/sessionTypes";
import { FEATURES, hasFeature } from "./permissions";

export type GymMembershipRole = "owner" | "manager" | "staff";

/** Resolves `associatedGyms[].gymRole` for the gym in `user.defaults`. */
export function gymMembershipRoleFromSession(session: SessionPayload | null): GymMembershipRole | null {
  if (session?.rbac?.role === "owner" || session?.rbac?.role === "manager" || session?.rbac?.role === "staff") {
    return session.rbac.role;
  }
  if (!session?.user?.defaults?.gymId) {
    return null;
  }
  const gid = session.user.defaults.gymId;
  const list = session.user.associatedGyms;
  if (!Array.isArray(list)) {
    return null;
  }
  const entry = list.find((g) => g.gymId === gid);
  const r = entry?.gymRole;
  if (r === "owner" || r === "manager" || r === "staff") {
    return r;
  }
  return null;
}

export function canAccessStaffUsersModule(session: SessionPayload | null): boolean {
  return hasFeature(session, FEATURES.STAFF_MANAGEMENT);
}

export function isOwnerFromSession(session: SessionPayload | null): boolean {
  if (session?.rbac?.role?.toLowerCase() === "owner") {
    return true;
  }
  return gymMembershipRoleFromSession(session) === "owner";
}
