import axios from "axios";
import { handleSessionExpired } from "@/utils/authSession";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5050/api",
  timeout: 15000,
  withCredentials: true
});

apiClient.interceptors.request.use((config) => {
  if (typeof window === "undefined") {
    return config;
  }

  const raw = localStorage.getItem("userData");
  if (!raw) {
    return config;
  }

  try {
    const parsed = JSON.parse(raw) as {
      token?: string;
      activeBranch?: { id?: string };
      user?: { defaults?: { gymId?: string; branchId?: string } };
    };

    // Always attach the JWT as a Bearer token. The backend also reads the
    // gym_access_token cookie, but cross-origin HttpOnly cookies are unreliable
    // in many browsers (third-party cookie blocking, tracking prevention, etc.).
    // Sending the token in the Authorization header guarantees authentication
    // works regardless of cookie policies.
    const token =
      typeof parsed?.token === "string" && parsed.token.trim().length > 0
        ? parsed.token.trim()
        : null;
    if (token && !config.headers["Authorization"]) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    const gymId = parsed?.user?.defaults?.gymId;
    const branchId =
      typeof parsed?.activeBranch?.id === "string" && parsed.activeBranch.id.trim()
        ? parsed.activeBranch.id.trim()
        : parsed?.user?.defaults?.branchId;
    if (gymId) {
      config.headers["X-Gym-Id"] = gymId;
    }
    if (branchId) {
      config.headers["X-Branch-Id"] = branchId;
    }
  } catch {
    // Ignore malformed local user data.
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = String(error?.config?.url ?? "");
    const isLogout = requestUrl.includes("/auth/logout");
    if (status === 401 && typeof window !== "undefined" && !isLogout) {
      handleSessionExpired();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
