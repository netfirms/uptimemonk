import { Agent } from "undici";
import { PROBE_CONCURRENCY } from "../config.js";

/**
 * The HTTP dispatcher used for every probe.
 *
 * Connection reuse is deliberately off. Keep-alive is the right default for an
 * ordinary client and exactly wrong for a monitor: a reused socket skips DNS,
 * TCP and TLS, so response times read artificially fast and a broken handshake
 * or an expiring certificate stays invisible until the pool happens to
 * reconnect. We want to measure what a real first-time visitor experiences.
 *
 * `keepAliveTimeout: 1` is how undici expresses "close as soon as the response
 * is done" — there is no boolean switch.
 */
export const probeAgent = new Agent({
  keepAliveTimeout: 1,
  keepAliveMaxTimeout: 1,
  pipelining: 0,
  connections: PROBE_CONCURRENCY,
  connect: {
    // Distinguishes "cannot open a socket" from "server is slow to answer".
    timeout: 10_000,
  },
});
