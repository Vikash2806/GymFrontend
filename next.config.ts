import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

/** Absolute path to this app (directory containing next.config). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
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
