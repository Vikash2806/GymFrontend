/** Ensures API calls always target `/api` on the backend (avoids 404 Route not found). */
export function resolveApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5050/api";
  const trimmed = raw.replace(/\/+$/, "");
  if (trimmed.endsWith("/api")) {
    return trimmed;
  }
  return `${trimmed}/api`;
}
