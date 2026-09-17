import { test, describe, before } from "node:test";
import assert from "node:assert/strict";

/**
 * End-to-end against the live system, as a real customer.
 *
 * Signs in with a real account, bootstraps if needed, creates one monitor of
 * every type, waits for the worker to actually probe them, and cleans up
 * after itself. Nothing here is mocked: it is the same HTTP the browser makes
 * against the deployed API.
 *
 * Credentials come from the environment and are never committed. Without them
 * the suite skips, so a checkout with no secrets still runs green:
 *
 *   UPTIMEMONK_E2E_EMAIL=...  UPTIMEMONK_E2E_PASSWORD=...  npm run test:e2e
 *
 * The account must already exist and be verified — the API refuses an
 * unconfirmed address, which `verification.test` here asserts rather than
 * works around.
 */

const EMAIL = process.env.UPTIMEMONK_E2E_EMAIL ?? "jidaso4157@findize.com";
const PASSWORD = process.env.UPTIMEMONK_E2E_PASSWORD ?? "123456";
const API = process.env.UPTIMEMONK_E2E_API ?? "https://api.uptimemonke.com";
const WEB_KEY = process.env.UPTIMEMONK_E2E_WEB_KEY ?? "AIzaSyDBco29lK8EeJ6eD7Rf0JSX2Mqb4yKlRjc";

const skip = !EMAIL || !PASSWORD ? "set UPTIMEMONK_E2E_EMAIL and UPTIMEMONK_E2E_PASSWORD" : false;

/** Short, because first-check jitter is bounded by the interval itself. */
const INTERVAL = 60;
/** Jitter, plus config sync, plus the probe. Generous but not unbounded. */
const PROBE_DEADLINE_MS = 150_000;

/** Every check type, with the minimum each one needs to be valid. */
const TYPES = [
  { type: "http", target: "https://example.com" },
  { type: "keyword", target: "https://example.com", keyword: "Example Domain" },
  { type: "ssl", target: "example.com", sslExpiryAlertDays: [30, 14, 7, 1] },
  { type: "tcp", target: "example.com", port: 443 },
  { type: "dns", target: "example.com", dnsRecordType: "A" },
  { type: "icmp", target: "1.1.1.1" },
  { type: "heartbeat", heartbeatGraceSeconds: 600 },
];

let token = "";
let orgId = "";
const created = [];

async function signIn() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${WEB_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    }
  );
  const body = await res.json();
  if (body.error) throw new Error(`sign-in failed: ${body.error.message}`);
  return body.idToken;
}

const api = (path, init = {}) =>
  fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });

describe("live end-to-end", { skip }, () => {
  before(async () => {
    token = await signIn();
    const res = await api("/v1/bootstrap", { method: "POST" });
    const body = await res.json();
    assert.ok(res.ok, `bootstrap failed: ${JSON.stringify(body)}`);
    orgId = body.orgId;
    // The orgId arrives as a custom claim, so the token has to be reissued
    // before any route that reads it will work.
    token = await signIn();
  });

  test("the account is verified, because the API refuses anything else", async () => {
    const res = await api("/v1/monitors");
    assert.notEqual(res.status, 403, "account needs its email confirmed first");
    assert.equal(res.status, 200);
  });

  test("every monitor type can be created", async () => {
    for (const spec of TYPES) {
      const res = await api("/v1/monitors", {
        method: "POST",
        // A short interval on purpose. The scheduler jitters a monitor's
        // first check by up to its whole interval, so at 300s this suite
        // would have to wait five minutes to see one probe.
        body: JSON.stringify({ name: `e2e ${spec.type}`, intervalSeconds: INTERVAL, ...spec }),
      });
      const body = await res.json();
      assert.equal(res.status, 201, `${spec.type}: ${JSON.stringify(body)}`);
      created.push(body.id);
    }
    assert.equal(created.length, TYPES.length);
  });

  test("the worker picks them up and probes them", async () => {
    // Polls rather than sleeping a fixed time: the scheduler jitters each
    // monitor's first check, so a fixed wait is either flaky or wasteful.
    const deadline = Date.now() + PROBE_DEADLINE_MS;
    let probed = [];
    while (Date.now() < deadline) {
      const res = await api("/v1/monitors");
      const { monitors } = await res.json();
      probed = monitors.filter(
        (m) => created.includes(m.id) && m.type !== "heartbeat" && m.lastCheckedAt
      );
      if (probed.length >= TYPES.length - 1) break;
      await new Promise((r) => setTimeout(r, 4000));
    }
    assert.equal(
      probed.length,
      TYPES.length - 1,
      "every type except heartbeat should have been checked"
    );
    // A heartbeat monitor is pending until something pings it — that is the
    // whole point of the type, not a failure.
  });

  test("an ssl monitor records the certificate window", async () => {
    const res = await api("/v1/monitors");
    const { monitors } = await res.json();
    const ssl = monitors.find((m) => created.includes(m.id) && m.type === "ssl");
    assert.ok(ssl?.certExpiresAt, "no certificate expiry recorded");
    assert.ok(ssl.certExpiresAt > Date.now(), "certificate already expired");
  });

  test("a heartbeat ping brings its monitor up", async () => {
    const res = await api("/v1/monitors");
    const { monitors } = await res.json();
    const hb = monitors.find((m) => created.includes(m.id) && m.type === "heartbeat");
    assert.ok(hb?.heartbeatToken, "no heartbeat token issued");

    const ping = await fetch(`${API}/heartbeat/${hb.heartbeatToken}`);
    assert.equal(ping.status, 200);

    const after = await (await api("/v1/monitors")).json();
    const now = after.monitors.find((m) => m.id === hb.id);
    assert.equal(now.status, "up");
  });

  test("cleanup: every monitor this run created is removed", async () => {
    for (const id of created) {
      const res = await api(`/v1/monitors/${id}`, { method: "DELETE" });
      assert.ok(res.ok, `could not delete ${id}`);
    }
    /**
     * Poll rather than assert once.
     *
     * A delete writes to Firestore, and `/v1/monitors` reads the worker's
     * local mirror — so the two are briefly out of step and a single check
     * here fails intermittently. That is this suite racing the config
     * listener, not the product losing a delete.
     */
    const deadline = Date.now() + 30_000;
    let leftover = created;
    while (Date.now() < deadline) {
      const { monitors } = await (await api("/v1/monitors")).json();
      leftover = monitors.filter((m) => created.includes(m.id)).map((m) => m.id);
      if (!leftover.length) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    assert.deepEqual(leftover, [], "left monitors behind in a live workspace");
  });
});
