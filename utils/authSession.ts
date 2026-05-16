const AUTH_COOKIE_NAME = "gym_access_token";
const LEGACY_AUTH_COOKIE_NAME = "token";

export const AUTH_SESSION_EXPIRED_EVENT = "gym:auth-session-expired";

let handlingSessionExpiry = false;

function clearClientAuthCookie(): void {
  if (typeof document === "undefined") {
    return;
  }
  const secureAttr = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secureAttr}`;
  document.cookie = `${LEGACY_AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secureAttr}`;
}

function clearStoredAuth(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem("userData");
  clearClientAuthCookie();
}

function redirectToLogin(): void {
  if (typeof window === "undefined") {
    return;
  }
  const pathname = window.location.pathname;
  if (pathname === "/login" || pathname === "/signup") {
    return;
  }
  const next = encodeURIComponent(`${pathname}${window.location.search}`);
  window.location.replace(`/login?next=${next}`);
}

async function clearServerAuthCookie(): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5050/api";
  try {
    await fetch(`${baseUrl}/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
  } catch {
    // Local session is still cleared; HttpOnly cookie clear is best-effort.
  }
}

/** Clears client auth state, notifies Redux, clears server cookie, and redirects to login. */
export function handleSessionExpired(): void {
  if (typeof window === "undefined" || handlingSessionExpiry) {
    return;
  }
  handlingSessionExpiry = true;
  clearStoredAuth();
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
  void clearServerAuthCookie().finally(() => {
    redirectToLogin();
  });
}

/** Voluntary sign-out: clear local state and server HttpOnly cookie without forced redirect. */
export async function clearAuthOnLogout(): Promise<void> {
  clearStoredAuth();
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
  await clearServerAuthCookie();
}

/** Immediate user-initiated logout — no session-verify UI; redirect without awaiting the API. */
export function performUserLogout(): void {
  if (typeof window === "undefined") {
    return;
  }
  clearStoredAuth();
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
  void clearServerAuthCookie();
  window.location.replace("/login");
}
