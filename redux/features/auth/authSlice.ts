import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import apiClient from "@/utils/api";

type LoginPayload = {
  username: string;
  password: string;
};

type UserData = {
  username: string;
  token?: string;
};

type AuthState = {
  isLoggedIn: boolean;
  loading: boolean;
  userData: UserData | null;
  error: string | null;
};

const storedUserData =
  typeof window !== "undefined" ? localStorage.getItem("userData") : null;

const initialState: AuthState = {
  isLoggedIn: !!storedUserData,
  loading: false,
  userData: storedUserData ? (JSON.parse(storedUserData) as UserData) : null,
  error: null
};

export const loginAsync = createAsyncThunk<UserData, LoginPayload>(
  "users/login",
  async (credentials, { rejectWithValue }) => {
    const useMockAuth =
      process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH !== "false";

    if (useMockAuth) {
      if (
        credentials.username.trim().length > 0 &&
        credentials.password.trim().length > 0
      ) {
        return {
          username: credentials.username,
          token: "mock-token"
        };
      }
      return rejectWithValue("Invalid credentials");
    }

    try {
      const response = await apiClient.post("/users/login", credentials);
      return response.data as UserData;
    } catch {
      return rejectWithValue("Invalid credentials");
    }
  }
);

export const logoutAsync = createAsyncThunk("users/logout", async () => {
  const useMockAuth = process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH !== "false";
  if (!useMockAuth) {
    await apiClient.post("/users/logout");
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

export const { logout } = authSlice.actions;
export default authSlice.reducer;

export const selectLoadingState = (state: any) => state.auth.loading;
export const selectUser = (state: any) => state.auth.userData;
export const selectIsLoggedIn = (state: any) => state.auth.isLoggedIn;
