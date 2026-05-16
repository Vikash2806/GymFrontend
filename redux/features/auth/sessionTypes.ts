import type { RolePermissionMap } from "@/constants/permissionSchema";

export type SessionAssociatedGym = {
  gymId: string;
  gymRole?: "owner" | "manager" | "staff";
  isActive?: boolean;
  branches?: Array<{ branchId: string; role: string }>;
  lastLogin?: string;
};

export type SessionUser = {
  id: string;
  email: string | null;
  phone: string;
  fullName: string;
  profilePhoto: string | null;
  defaults: { gymId: string; branchId: string } | null;
  associatedGyms?: SessionAssociatedGym[];
  status?: string;
};

export type SessionGymBranch = {
  id: string;
  code: string;
  name: string;
};

export type SessionGym = {
  id: string;
  name: string;
  logoUrl: string | null;
  status?: string;
  branches: SessionGymBranch[];
};

export type SessionPayload = {
  token?: string;
  user: SessionUser;
  gym: SessionGym | null;
  activeBranch: SessionGymBranch | null;
  rbac?: {
    role: string;
    permissions: RolePermissionMap | string[];
  } | null;
};

/** Legacy localStorage shape (pre-gym). */
export type LegacyUserData = {
  token?: string;
  mobileNumber?: string;
  firstName?: string;
  lastName?: string;
};
