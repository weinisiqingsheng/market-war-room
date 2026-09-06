import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Workspace TypeScript packages (e.g. `@war-room/types`) ship raw TS source
   * in Phase 0A; transpile them through the app build.
   */
  transpilePackages: ["@war-room/types"],
};

export default nextConfig;
