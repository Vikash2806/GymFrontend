import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { loginAsync, logout, logoutAsync, setSession, signupAsync } from "./auth/authSlice";
import type { SessionPayload } from "./auth/sessionTypes";
import {
  applyModuleDependencies,
  emptyRolePermissions,
  MODULE_REGISTRY,
  ownerFullPermissions,
  permissionsFromUnknown,
  registryForRoleMaster,
  sanitizeRolePermissions,
  type ModuleKey,
  type ModuleRegistryEntry,
  type PermissionAction,
  type RolePermissionMap
} from "@/constants/permissionSchema";

type RbacState = {
  role: string | null;
  permissions: RolePermissionMap;
  config: {
    owner: RolePermissionMap;
    manager: RolePermissionMap;
    staff: RolePermissionMap;
  };
};

const initialState: RbacState = {
  role: null,
  permissions: {},
  config: {
    owner: {},
    manager: {},
    staff: {}
  }
};

if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem("userData");
    if (raw) {
      const parsed = JSON.parse(raw) as SessionPayload;
      initialState.role = parsed?.rbac?.role ?? null;
      initialState.permissions = permissionsFromUnknown(parsed?.rbac?.permissions, parsed?.rbac?.role ?? "");
    }
  } catch {
    // Ignore invalid local cache.
  }
}

function fromSession(session: SessionPayload | null): Pick<RbacState, "role" | "permissions"> {
  return {
    role: session?.rbac?.role ?? null,
    permissions: permissionsFromUnknown(session?.rbac?.permissions, session?.rbac?.role ?? "")
  };
}

function normalizeConfigRole(role: "owner" | "manager" | "staff", map: RolePermissionMap): RolePermissionMap {
  if (role === "owner") {
    return ownerFullPermissions();
  }
  return sanitizeRolePermissions(role, map);
}

function getRegistryEntry(moduleKey: ModuleKey): ModuleRegistryEntry {
  const entry = MODULE_REGISTRY.find((item) => item.key === moduleKey);
  if (!entry) {
    throw new Error(`Unknown module: ${moduleKey}`);
  }
  return entry;
}

function setModuleAction(
  map: RolePermissionMap,
  moduleKey: ModuleKey,
  action: PermissionAction,
  enabled: boolean
) {
  const entry = getRegistryEntry(moduleKey);
  if (!entry.actions.includes(action)) {
    return;
  }
  const current = { ...(map[moduleKey] ?? {}) };
  if (enabled) {
    current[action] = true;
    if (action !== "view") {
      current.view = true;
    }
  } else {
    delete current[action];
    if (action === "view") {
      for (const a of entry.actions) {
        if (a !== "view") {
          delete current[a];
        }
      }
    }
  }
  if (Object.keys(current).length === 0) {
    delete map[moduleKey];
  } else {
    map[moduleKey] = current;
  }
}

const rbacSlice = createSlice({
  name: "rbac",
  initialState,
  reducers: {
    hydrateRbacFromSession(state, action: PayloadAction<SessionPayload | null>) {
      const next = fromSession(action.payload);
      state.role = next.role;
      state.permissions = next.permissions;
    },
    clearRbac(state) {
      state.role = null;
      state.permissions = {};
      state.config = { owner: {}, manager: {}, staff: {} };
    },
    setRbacConfig(
      state,
      action: PayloadAction<{ owner: RolePermissionMap; manager: RolePermissionMap; staff: RolePermissionMap }>
    ) {
      state.config.owner = normalizeConfigRole("owner", action.payload.owner);
      state.config.manager = normalizeConfigRole("manager", action.payload.manager);
      state.config.staff = normalizeConfigRole("staff", action.payload.staff);
    },
    toggleModuleView(
      state,
      action: PayloadAction<{ role: "owner" | "manager" | "staff"; module: ModuleKey; checked: boolean }>
    ) {
      const { role, module, checked } = action.payload;
      if (role === "owner") {
        return;
      }
      const map = { ...state.config[role] };
      setModuleAction(map, module, "view", checked);
      state.config[role] = normalizeConfigRole(role, applyModuleDependencies(map));
    },
    toggleModulePermission(
      state,
      action: PayloadAction<{
        role: "owner" | "manager" | "staff";
        module: ModuleKey;
        action: PermissionAction;
        checked: boolean;
      }>
    ) {
      const { role, module, action: permAction, checked } = action.payload;
      if (role === "owner" || permAction === "view") {
        return;
      }
      const map = { ...state.config[role] };
      setModuleAction(map, module, permAction, checked);
      state.config[role] = normalizeConfigRole(role, applyModuleDependencies(map));
    },
    toggleRbacSettingsForManager(state, action: PayloadAction<{ checked: boolean }>) {
      const map = { ...state.config.manager };
      setModuleAction(map, "rbac_settings", "view", action.payload.checked);
      state.config.manager = normalizeConfigRole("manager", applyModuleDependencies(map));
    },
    setRolePermissions(
      state,
      action: PayloadAction<{ role: "owner" | "manager" | "staff"; permissions: RolePermissionMap }>
    ) {
      const { role, permissions } = action.payload;
      if (role === "owner") {
        state.config.owner = ownerFullPermissions();
        return;
      }
      state.config[role] = normalizeConfigRole(role, applyModuleDependencies(permissions));
    },
    setAllRolePermissions(
      state,
      action: PayloadAction<{ role: "owner" | "manager" | "staff"; enabled: boolean }>
    ) {
      const { role, enabled } = action.payload;
      if (role === "owner") {
        state.config.owner = ownerFullPermissions();
        return;
      }
      if (!enabled) {
        state.config[role] = emptyRolePermissions();
        return;
      }
      const full: RolePermissionMap = {};
      for (const entry of registryForRoleMaster()) {
        const perm: RolePermissionMap[ModuleKey] = {};
        for (const act of entry.actions) {
          perm[act] = true;
        }
        full[entry.key] = perm;
      }
      state.config[role] = normalizeConfigRole(role, applyModuleDependencies(full));
    },
    resetRbacConfig(state) {
      state.config = { owner: {}, manager: {}, staff: {} };
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginAsync.fulfilled, (state, action) => {
        const next = fromSession(action.payload);
        state.role = next.role;
        state.permissions = next.permissions;
      })
      .addCase(signupAsync.fulfilled, (state, action) => {
        const next = fromSession(action.payload);
        state.role = next.role;
        state.permissions = next.permissions;
      })
      .addCase(setSession, (state, action) => {
        const next = fromSession(action.payload);
        state.role = next.role;
        state.permissions = next.permissions;
      })
      .addCase(logout, (state) => {
        state.role = null;
        state.permissions = {};
        state.config = { owner: {}, manager: {}, staff: {} };
      })
      .addCase(logoutAsync.fulfilled, (state) => {
        state.role = null;
        state.permissions = {};
        state.config = { owner: {}, manager: {}, staff: {} };
      });
  }
});

export const {
  hydrateRbacFromSession,
  clearRbac,
  setRbacConfig,
  toggleModuleView,
  toggleModulePermission,
  toggleRbacSettingsForManager,
  setRolePermissions,
  setAllRolePermissions,
  resetRbacConfig
} = rbacSlice.actions;

export const selectRbacRole = (state: { rbac: RbacState }) => state.rbac.role;
export const selectRbacPermissions = (state: { rbac: RbacState }) => state.rbac.permissions;
export const selectRbacConfig = (state: { rbac: RbacState }) => state.rbac.config;
export default rbacSlice.reducer;
