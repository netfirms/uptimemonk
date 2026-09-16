import { readFileSync } from "node:fs";

function loadVersion(): string {
  if (process.env.UPTIMEMONK_VERSION) return process.env.UPTIMEMONK_VERSION;
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    );
    return pkg.version || "0.1.0";
  } catch {
    return process.env.npm_package_version || "0.1.0";
  }
}

export const VERSION = loadVersion();
export const API_VERSION = process.env.UPTIMEMONK_API_VERSION || VERSION;
export const WORKER_VERSION = process.env.UPTIMEMONK_WORKER_VERSION || VERSION;
