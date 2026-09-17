import { APP_URL } from "../config.js";

/**
 * Origins allowed to call the worker API via CORS.
 *
 * Includes:
 * - The primary customer dashboard (APP_URL, uptimemonke.com, www.uptimemonke.com)
 * - The internal operations console (ops.uptimemonke.com, uptimemonke-admin.web.app)
 * - Any subdomains on uptimemonke.com and uptimemonk.com
 * - Firebase Hosting preview domains (*.web.app, *.firebaseapp.com)
 * - Localhost dev servers (localhost:*)
 */
export const ALLOWED_ORIGINS: Array<string | RegExp> = [
  APP_URL,
  "https://www.uptimemonke.com",
  "https://uptimemonke.com",
  "https://ops.uptimemonke.com",
  /^https:\/\/(?:[a-z0-9-]+\.)*uptimemonke\.com$/,
  /^https:\/\/(?:[a-z0-9-]+\.)*uptimemonk\.com$/,
  /\.web\.app$/,
  /\.firebaseapp\.com$/,
  /localhost:\d+$/,
];

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some((allowed) => {
    if (typeof allowed === "string") return allowed === origin;
    if (allowed instanceof RegExp) return allowed.test(origin);
    return false;
  });
}
