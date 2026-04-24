import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import apiClient from "@/utils/api";
import { isValidIndianMobile, toE164IndianMobile } from "@/utils/mobileValidation";
import type {
  LegacyUserData,
  SessionGym,
  SessionGymBranch,
  SessionPayload,
  SessionUser
} from "./sessionTypes";

type LoginPayload = {
  mobileNumber: string;
  password: string;
};

type SignupPayload = {
  firstName: string;
  lastName?: string;
  mobileNumber: string;
  recoveryEmail?: string;
  password: string;
  gymName: string;
  gymLogo: string | null;
};

export type UserData = SessionPayload | LegacyUserData;

type AuthState = {
  isLoggedIn: boolean;
  loading: boolean;
  userData: UserData | null;
  error: string | null;
};

function isMockAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === "true";
}

function isLikelyMockSession(data: unknown): boolean {
  if (!data || typeof data !== "object") {
    return false;
  }
  const session = data as { token?: string; user?: { id?: string } };
  return session.token === "mock-token" || session.user?.id === "mock-user";
}

function parseStoredSession(): UserData | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = localStorage.getItem("userData");
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as UserData;
    if (!isMockAuthEnabled() && isLikelyMockSession(parsed)) {
      localStorage.removeItem("userData");
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

const storedUserData = parseStoredSession();

const initialState: AuthState = {
  isLoggedIn: Boolean(
    storedUserData &&
      typeof storedUserData === "object" &&
      "token" in storedUserData &&
      Boolean((storedUserData as { token?: string }).token)
  ),
  loading: false,
  userData: storedUserData,
  error: null
};

function isSessionPayload(data: UserData | null): data is SessionPayload {
  return !!data && typeof data === "object" && "token" in data && "user" in data;
}

export const loginAsync = createAsyncThunk<SessionPayload, LoginPayload>(
  "auth/login",
  async (credentials, { rejectWithValue }) => {
    const normalizedMobile = toE164IndianMobile(credentials.mobileNumber);
    if (!normalizedMobile || !isValidIndianMobile(normalizedMobile)) {
      return rejectWithValue("Please enter a valid mobile number");
    }

    const useMockAuth = isMockAuthEnabled();

    if (useMockAuth) {
      if (normalizedMobile.trim().length > 0 && credentials.password.trim().length > 0) {
        const mockUser: SessionUser = {
          id: "mock-user",
          email: null,
          phone: normalizedMobile,
          fullName: "Demo User",
          profilePhoto: null,
          defaults: { gymId: "mock-gym", branchId: "mock-branch" }
        };
        const mockGym: SessionGym = {
          id: "mock-gym",
          name: "Demo Gym",
          logoUrl: null,
          branches: [{ id: "mock-branch", code: "BR001", name: "Main Branch" }]
        };
        return {
          token: "mock-token",
          user: mockUser,
          gym: mockGym,
          activeBranch: mockGym.branches[0]
        };
      }
      return rejectWithValue("Invalid credentials");
    }

    try {
      const response = await apiClient.post<SessionPayload>("/auth/signin", {
        mobileNumber: normalizedMobile,
        password: credentials.password
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = (error.response?.data as { message?: string } | undefined)?.message;
        return rejectWithValue(message ?? "Invalid credentials");
      }
      return rejectWithValue("Invalid credentials");
    }
  }
);

export const signupAsync = createAsyncThunk<SessionPayload, SignupPayload>(
  "auth/signup",
  async (payload, { rejectWithValue }) => {
    const normalizedMobile = toE164IndianMobile(payload.mobileNumber);
    if (!normalizedMobile || !isValidIndianMobile(normalizedMobile)) {
      return rejectWithValue("Please enter a valid mobile number");
    }

    const useMockAuth = isMockAuthEnabled();
    if (useMockAuth) {
      if (
        payload.firstName.trim().length === 0 ||
        payload.password.trim().length < 6 ||
        !payload.gymName.trim()
      ) {
        return rejectWithValue("Please enter valid details");
      }
      const mockUser: SessionUser = {
        id: "mock-user",
        email: payload.recoveryEmail?.trim() || null,
        phone: normalizedMobile,
        fullName: `${payload.firstName} ${payload.lastName ?? ""}`.trim(),
        profilePhoto: null,
        defaults: { gymId: "mock-gym", branchId: "mock-branch" }
      };
      const mockGym: SessionGym = {
        id: "mock-gym",
        name: payload.gymName.trim(),
        logoUrl: payload.gymLogo,
        branches: [{ id: "mock-branch", code: "BR001", name: "Main Branch" }]
      };
      return {
        token: "mock-token",
        user: mockUser,
        gym: mockGym,
        activeBranch: mockGym.branches[0]
      };
    }

    try {
      const response = await apiClient.post<SessionPayload>("/auth/signup", {
        firstName: payload.firstName,
        lastName: payload.lastName ?? "",
        mobileNumber: normalizedMobile,
        recoveryEmail: payload.recoveryEmail?.trim(),
        password: payload.password,
        gymName: payload.gymName.trim(),
        gymLogo: payload.gymLogo
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = (error.response?.data as { message?: string } | undefined)?.message;
        return rejectWithValue(message ?? "Signup failed. Please try again.");
      }
      return rejectWithValue("Signup failed. Please try again.");
    }
  }
);

export const logoutAsync = createAsyncThunk("users/logout", async () => {
  const useMockAuth = isMockAuthEnabled();
  if (!useMockAuth) {
    try {
      await apiClient.post("/auth/logout");
  } catch {
    // Local auth state is still cleared in fulfilled reducer.
  }
  }
  return true;
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.isLoggedIn = false;
      state.userData = null;
      state.error = null;
      if (typeof window !== "undefined") {
        localStorage.removeItem("userData");
      }
    },
    setSession(state, action: { payload: SessionPayload }) {
      state.isLoggedIn = true;
      state.userData = action.payload;
      if (typeof window !== "undefined") {
        localStorage.setItem("userData", JSON.stringify(action.payload));
      }
    },
    patchSessionToken(state, action: { payload: { token: string } }) {
      if (state.userData && isSessionPayload(state.userData)) {
        state.userData = { ...state.userData, token: action.payload.token };
        localStorage.setItem("userData", JSON.stringify(state.userData));
      }
    },
    updateGymInSession(state, action: { payload: { name?: string; logoUrl?: string | null } }) {
      if (state.userData && isSessionPayload(state.userData) && state.userData.gym) {
        state.userData = {
          ...state.userData,
          gym: {
            ...state.userData.gym,
            ...action.payload
          }
        };
        localStorage.setItem("userData", JSON.stringify(state.userData));
      }
    },
    updateBranchInSession(state, action: { payload: { branchId: string; name: string } }) {
      if (!state.userData || !isSessionPayload(state.userData) || !state.userData.gym) {
        return;
      }
      const branches = state.userData.gym.branches.map((b) =>
        b.id === action.payload.branchId ? { ...b, name: action.payload.name } : b
      );
      let activeBranch = state.userData.activeBranch;
      if (activeBranch?.id === action.payload.branchId) {
        activeBranch = { ...activeBranch, name: action.payload.name };
      }
      state.userData = {
        ...state.userData,
        gym: { ...state.userData.gym, branches },
        activeBranch
      };
      localStorage.setItem("userData", JSON.stringify(state.userData));
    },
    setActiveBranch(state, action: { payload: { branch: SessionPayload["activeBranch"]; token?: string } }) {
      if (!state.userData || !isSessionPayload(state.userData)) {
        return;
      }
      const next: SessionPayload = {
        ...state.userData,
        activeBranch: action.payload.branch,
        user: state.userData.user.defaults
          ? {
              ...state.userData.user,
              defaults: {
                gymId: state.userData.user.defaults!.gymId,
                branchId: action.payload.branch?.id ?? state.userData.user.defaults!.branchId
              }
            }
          : state.userData.user,
        token: action.payload.token ?? state.userData.token
      };
      state.userData = next;
      localStorage.setItem("userData", JSON.stringify(state.userData));
    },
    replaceGymBranches(state, action: { payload: SessionGymBranch[] }) {
      if (!state.userData || !isSessionPayload(state.userData) || !state.userData.gym) {
        return;
      }
      const branches = action.payload;
      let activeBranch = state.userData.activeBranch;
      const prevActiveId = activeBranch?.id;
      if (branches.length > 0) {
        if (!activeBranch || !branches.some((b) => b.id === activeBranch!.id)) {
          activeBranch = branches[0] ?? null;
        } else {
          activeBranch = branches.find((b) => b.id === activeBranch!.id) ?? null;
        }
      } else {
        activeBranch = null;
      }
      let user = state.userData.user;
      if (user.defaults && activeBranch && prevActiveId !== activeBranch.id) {
        user = {
          ...user,
          defaults: { gymId: user.defaults.gymId, branchId: activeBranch.id }
        };
      }
      state.userData = {
        ...state.userData,
        gym: { ...state.userData.gym, branches },
        activeBranch,
        user
      };
      localStorage.setItem("userData", JSON.stringify(state.userData));
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.isLoggedIn = true;
        state.userData = action.payload;
        if (typeof window !== "undefined") {
          localStorage.setItem("userData", JSON.stringify(action.payload));
        }
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.loading = false;
        state.isLoggedIn = false;
        state.userData = null;
        state.error = (action.payload as string) ?? "Login failed";
      })
      .addCase(signupAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signupAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.isLoggedIn = false;
        state.userData = null;
        if (typeof window !== "undefined") {
          localStorage.removeItem("userData");
        }
      })
      .addCase(signupAsync.rejected, (state, action) => {
        state.loading = false;
        state.isLoggedIn = false;
        state.userData = null;
        state.error = (action.payload as string) ?? "Signup failed";
      })
      .addCase(logoutAsync.fulfilled, (state) => {
        state.isLoggedIn = false;
        state.userData = null;
        state.error = null;
        if (typeof window !== "undefined") {
          localStorage.removeItem("userData");
        }
      });
  }
});

export const {
  logout,
  setSession,
  patchSessionToken,
  updateGymInSession,
  updateBranchInSession,
  setActiveBranch,
  replaceGymBranches
} = authSlice.actions;
export default authSlice.reducer;

export const selectLoadingState = (state: { auth: AuthState }) => state.auth.loading;
export const selectUser = (state: { auth: AuthState }) => state.auth.userData;
export const selectIsLoggedIn = (state: { auth: AuthState }) => state.auth.isLoggedIn;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;
export const selectSession = (state: { auth: AuthState }): SessionPayload | null => {
  const data = state.auth.userData;
  return data && isSessionPayload(data) ? data : null;
};
