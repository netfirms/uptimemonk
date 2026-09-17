import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { openDb, closeDb } from "./db/index.js";
import { monitorRoutes } from "./api/monitors.js";
import { miscRoutes } from "./api/misc.js";
import { contactRoutes } from "./api/contacts.js";
import { statusRoutes } from "./api/status.js";
import { billingRoutes } from "./api/billing.js";
import { orgRoutes } from "./api/org.js";
import { adminRoutes } from "./api/admin.js";
import { seedSystemConfig, startSystemConfigListener } from "./sync/configListener.js";
import { log } from "./lib/log.js";
import { API_VERSION, PORT } from "./config.js";
import { ALLOWED_ORIGINS } from "./lib/cors.js";

/**
 * The API process.
 *
 * Separate systemd unit from the worker so restarting it never pauses
 * monitoring. It shares the SQLite file in WAL mode — one writer at a time,
 * with busy_timeout making the API's occasional write wait out the worker's
 * flush rather than fail.
 */
async function main(): Promise<void> {
  openDb();
  // Fill the admin console's config document on first boot, so nobody has to
  // retype what the worker is already running. Never overwrites, never
  // includes a secret.
  await seedSystemConfig();
  const stopConfigListener = startSystemConfigListener();

  const app = Fastify({
    // Fastify 5 takes a pre-built pino instance as `loggerInstance`; the
    // `logger` key only accepts a config object and throws on an instance.
    loggerInstance: log,
    // Caddy terminates TLS in front and sets the forwarded headers.
    trustProxy: true,
    bodyLimit: 256 * 1024,
  });

  await app.register(cors, {
    // Allows customer dashboard, internal ops console (ops.uptimemonke.com),
    // preview deployments, and local dev environments.
    origin: ALLOWED_ORIGINS,
    credentials: true,
  });

  // The heartbeat endpoint is unauthenticated by design — the token in the URL
  // is the credential — so it needs its own ceiling.
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    allowList: (req) => req.url === "/healthz",
  });

  app.addHook("onSend", async (_req, reply) => {
    reply.header("x-uptimemonk-version", API_VERSION);
  });

  await app.register(monitorRoutes);
  await app.register(miscRoutes);
  await app.register(contactRoutes);
  await app.register(statusRoutes);
  await app.register(billingRoutes);
  await app.register(orgRoutes);
  await app.register(adminRoutes);

  await app.listen({ port: PORT, host: "127.0.0.1" }); // Caddy is the only client
  log.info({ port: PORT, version: API_VERSION }, "api listening");

  const shutdown = async (signal: string) => {
    log.info({ signal }, "api shutting down");
    stopConfigListener();
    await app.close();
    closeDb();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  log.fatal({ err }, "api failed to start");
  process.exit(1);
});
