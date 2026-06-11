import axios from "axios";
import { resolveApiBaseUrl } from "@/utils/apiBaseUrl";

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
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
      user?: { defaults?: { gymId?: string; branchId?: string } };
    };
    const token =
      typeof parsed?.token === "string" && parsed.token.trim().length > 0
        ? parsed.token.trim()
        : null;
    if (token && !config.headers["Authorization"]) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    const gymId = parsed?.user?.defaults?.gymId;
    const branchId = parsed?.user?.defaults?.branchId;
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
