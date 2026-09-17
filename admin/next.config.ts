import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_API_URL: "https://api.uptimemonke.com",
    NEXT_PUBLIC_MAIN_URL: "https://www.uptimemonke.com",
  },
};

export default nextConfig;
