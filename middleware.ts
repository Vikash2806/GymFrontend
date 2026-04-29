import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "gym_access_token";
const LEGACY_AUTH_COOKIE_NAME = "token";
const PROTECTED_PREFIXES = ["/pages"];
const AUTH_PAGES = new Set(["/login", "/signup"]);

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token =
    request.cookies.get(AUTH_COOKIE_NAME)?.value ?? request.cookies.get(LEGACY_AUTH_COOKIE_NAME)?.value;
  const isAuthenticated = Boolean(token);
  const isProtected = isProtectedPath(pathname);
  const isAuthPage = AUTH_PAGES.has(pathname);

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/pages/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/pages/:path*",
    "/dashboard/:path*",
    "/transactions/:path*",
    "/members/:path*",
    "/login",
    "/signup"
  ]
};
