import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { loginAsync, logout, logoutAsync, setSession, signupAsync } from "./auth/authSlice";
import type { SessionPayload } from "./auth/sessionTypes";
import { ALL_FEATURE_KEYS, type FeatureKey } from "@/constants/featureMap";

type RbacState = {
  role: string | null;
  permissions: string[];
  config: {
    owner: FeatureKey[];
    manager: FeatureKey[];
    staff: FeatureKey[];
  };
};

const initialState: RbacState = {
  role: null,
  permissions: [],
  config: {
    owner: [],
    manager: [],
    staff: []
  }
};

if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem("userData");
    if (raw) {
      const parsed = JSON.parse(raw) as SessionPayload;
      initialState.role = parsed?.rbac?.role ?? null;
      initialState.permissions = parsed?.rbac?.permissions ?? [];
    }
  } catch {
    // Ignore invalid local cache.
  }
}

function fromSession(session: SessionPayload | null): RbacState {
  return {
    role: session?.rbac?.role ?? null,
    permissions: session?.rbac?.permissions ?? [],
    config: {
      owner: [],
      manager: [],
      staff: []
    }
  };
}

function uniqueFeatures(features: FeatureKey[]): FeatureKey[] {
  return [...new Set(features)];
}

function featureSort(features: FeatureKey[]): FeatureKey[] {
  const indexMap = new Map<string, number>(ALL_FEATURE_KEYS.map((feature, index) => [feature, index]));
  return [...features].sort(
    (a, b) => (indexMap.get(a) ?? Number.MAX_SAFE_INTEGER) - (indexMap.get(b) ?? Number.MAX_SAFE_INTEGER)
  );
}

function normalizeRoleFeatures(role: "owner" | "manager" | "staff", features: FeatureKey[]): FeatureKey[] {
  const deduped = featureSort(uniqueFeatures(features));
  if (role === "owner") {
    const withoutLocked = deduped.filter((feature) => feature !== "rbac_settings");
    return [...withoutLocked, "rbac_settings"];
  }
  return deduped.filter((feature) => feature !== "rbac_settings" && feature !== "user_management");
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
      state.permissions = [];
      state.config = { owner: [], manager: [], staff: [] };
    },
    setRbacConfig(
      state,
      action: PayloadAction<{ owner: FeatureKey[]; manager: FeatureKey[]; staff: FeatureKey[] }>
    ) {
      state.config.owner = normalizeRoleFeatures("owner", action.payload.owner);
      state.config.manager = normalizeRoleFeatures("manager", action.payload.manager);
      state.config.staff = normalizeRoleFeatures("staff", action.payload.staff);
    },
    toggleRoleFeature(
      state,
      action: PayloadAction<{ role: "owner" | "manager" | "staff"; feature: FeatureKey; checked: boolean }>
    ) {
      const { role, feature, checked } = action.payload;
      if (role !== "owner" && (feature === "rbac_settings" || feature === "user_management")) {
        return;
      }
      if (role === "owner" && feature === "rbac_settings") {
        return;
      }
      const current = new Set(state.config[role]);
      if (checked) {
        current.add(feature);
      } else {
        current.delete(feature);
      }
      state.config[role] = normalizeRoleFeatures(role, [...current]);
    },
    setRoleFeatures(state, action: PayloadAction<{ role: "owner" | "manager" | "staff"; features: FeatureKey[] }>) {
      state.config[action.payload.role] = normalizeRoleFeatures(action.payload.role, action.payload.features);
    },
    resetRbacConfig(state) {
      state.config = { owner: [], manager: [], staff: [] };
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
        state.permissions = [];
        state.config = { owner: [], manager: [], staff: [] };
      })
      .addCase(logoutAsync.fulfilled, (state) => {
        state.role = null;
        state.permissions = [];
        state.config = { owner: [], manager: [], staff: [] };
      });
  }
});

export const {
  hydrateRbacFromSession,
  clearRbac,
  setRbacConfig,
  toggleRoleFeature,
  setRoleFeatures,
  resetRbacConfig
} = rbacSlice.actions;
export const selectRbacRole = (state: { rbac: RbacState }) => state.rbac.role;
export const selectRbacPermissions = (state: { rbac: RbacState }) => state.rbac.permissions;
export const selectRbacConfig = (state: { rbac: RbacState }) => state.rbac.config;
export default rbacSlice.reducer;
