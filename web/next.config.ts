import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  // firebase-admin must not be bundled into the server build.
  serverExternalPackages: ["firebase-admin"],
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
};

export default nextConfig;
