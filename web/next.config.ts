import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // firebase-admin must not be bundled into the server build.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
