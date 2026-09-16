import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { openDb, closeDb } from "./db/index.js";
import { monitorRoutes } from "./api/monitors.js";
import { miscRoutes } from "./api/misc.js";
import { log } from "./lib/log.js";
import { API_VERSION, APP_URL, PORT } from "./config.js";

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

  const app = Fastify({
    // Fastify 5 takes a pre-built pino instance as `loggerInstance`; the
    // `logger` key only accepts a config object and throws on an instance.
    loggerInstance: log,
    // Caddy terminates TLS in front and sets the forwarded headers.
    trustProxy: true,
    bodyLimit: 256 * 1024,
  });

  await app.register(cors, {
    // APP_URL is the real dashboard origin; the Firebase Hosting domains stay
    // allowed because the app is served from there until the custom domain is
    // attached. Anything else is rejected.
    origin: [
      APP_URL,
      "https://www.uptimemonke.com",
      "https://uptimemonke.com",
      /\.web\.app$/,
      /\.firebaseapp\.com$/,
      /localhost:\d+$/,
    ],
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

  await app.listen({ port: PORT, host: "127.0.0.1" }); // Caddy is the only client
  log.info({ port: PORT, version: API_VERSION }, "api listening");

  const shutdown = async (signal: string) => {
    log.info({ signal }, "api shutting down");
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
