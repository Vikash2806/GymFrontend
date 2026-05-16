import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

/** Absolute path to this app (directory containing next.config). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function apiConnectOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5050/api";
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:5050";
  }
}

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js + framer-motion need inline scripts/styles; dev also needs unsafe-eval for HMR.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' ${apiConnectOrigin()} https://api.razorpay.com ws: wss:`,
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    // CSP in dev breaks Next HMR and leaves framer-motion content at opacity:0.
    if (process.env.NODE_ENV === "development") {
      return [];
    }
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  },
  // Allow LAN-origin requests during local development.
  allowedDevOrigins: ["192.168.1.12"],
  /**
   * Next otherwise picks the nearest parent `package-lock.json` as the
   * workspace root. A stray lockfile under `$HOME` breaks file tracing and
   * produces missing webpack chunks (`Cannot find module './601.js'`) and
   * broken CSS in dev.
   */
  outputFileTracingRoot: projectRoot
};

export default nextConfig;
