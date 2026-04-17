import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api",
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
    const parsed = JSON.parse(raw);
    if (parsed?.token) {
      config.headers.Authorization = `Bearer ${parsed.token}`;
    }
  } catch {
    // Ignore malformed local user data.
  }

  return config;
});

export default apiClient;
