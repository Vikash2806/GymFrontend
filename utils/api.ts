import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5050/api",
  timeout: 15000
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
    if (parsed?.token) {
      config.headers.Authorization = `Bearer ${parsed.token}`;
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

export default apiClient;
