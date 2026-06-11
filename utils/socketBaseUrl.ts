import { resolveApiBaseUrl } from "@/utils/apiBaseUrl";

/** Socket.IO connects to the API host root (not `/api`). */
export function resolveSocketBaseUrl(): string {
  const apiBase = resolveApiBaseUrl().replace(/\/+$/, "");
  if (apiBase.endsWith("/api")) {
    return apiBase.slice(0, -"/api".length);
  }
  return apiBase;
}
