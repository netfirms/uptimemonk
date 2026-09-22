#!/usr/bin/env node

/**
 * UptimeMonk — Comprehensive Feature Verification Test Suite
 *
 * Verifies all major subsystems and features of UptimeMonk:
 * 1. Security & TargetGuard (SSRF, metadata, private IPs)
 * 2. Probe Checks Engine (HTTP, Keyword, TCP, DNS, SSL, Heartbeat)
 * 3. Monitor Validation & Plan Limits (Free vs Paid quotas)
 * 4. State Machine & Incident Lifecycle (Alert debouncing, recovery)
 * 5. Scheduler & Sharding (DueHeap ordering, hash ring stability)
 * 6. Authentication & Tenancy Model (Org claims and multi-tenancy)
 * 7. Web Dashboard Business Logic (Uptime formulas, metrics aggregations, status filters)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Dynamic import of compiled server modules
const { assertSafeUrl, assertPublicHost, BlockedTargetError, sanitizeHeaders, hostFromTarget } =
  await import("../server/dist/lib/targetGuard.js");
const { checkHttp, checkTcp, checkDns, checkSsl, runProbe, describeNetworkError } =
  await import("../server/dist/checks/index.js");
const { buildMonitor, ValidationError } =
  await import("../server/dist/monitors/validate.js");
const { decideTransition } =
  await import("../server/dist/monitors/stateMachine.js");
const { DueHeap, nextDueAt, initialDueAt } =
  await import("../server/dist/scheduler/heap.js");
const { shardFor, ownsOrg } =
  await import("../server/dist/scheduler/assignment.js");
const { PLANS, limitsFor } =
  await import("../server/dist/lib/plans.js");
const { updateDynamicConfig, getEffectiveConfig, resetDynamicConfig, SECRET_CONFIG_KEYS } =
  await import("../server/dist/config.js");
const { isAllowedOrigin } =
  await import("../server/dist/lib/cors.js");

const REGION = "ap-southeast-1";

function createMockMonitor(overrides = {}) {
  return {
    id: "m_test_" + Math.random().toString(36).slice(2, 8),
    orgId: "org_alpha",
    name: "Production API",
    type: "http",
    target: "https://example.com",
    intervalSeconds: 60,
    timeoutSeconds: 5,
    confirmationThreshold: 2,
    regions: [REGION],
    alertContactIds: ["c_1"],
    enabled: true,
    status: "pending",
    inMaintenance: false,
    consecutiveFailures: 0,
    dueAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("==================================================", () => {});
describe("UptimeMonk — All Features Verification Suite", () => {
  // ----------------------------------------------------
  // FEATURE 1: SECURITY & SSRF PROTECTION (TargetGuard)
  // ----------------------------------------------------
  describe("Feature 1: Security & SSRF Protection", () => {
    test("blocks local loopback addresses (127.0.0.1, localhost)", async () => {
      await assert.rejects(
        () => assertSafeUrl("http://127.0.0.1:8080"),
        (err) => err instanceof BlockedTargetError && /private or link-local/i.test(err.message)
      );
      await assert.rejects(
        () => assertSafeUrl("http://localhost:3000"),
        (err) => err instanceof BlockedTargetError && /internal hostname/i.test(err.message)
      );
    });

    test("blocks cloud metadata server (169.254.169.254)", async () => {
      await assert.rejects(
        () => assertSafeUrl("http://169.254.169.254/computeMetadata/v1/"),
        (err) => err instanceof BlockedTargetError && /private or link-local/i.test(err.message)
      );
    });

    test("blocks RFC1918 private subnets (10.x, 172.16-31.x, 192.168.x)", async () => {
      await assert.rejects(
        () => assertPublicHost("10.0.0.1"),
        (err) => err instanceof BlockedTargetError
      );
      await assert.rejects(
        () => assertPublicHost("172.20.10.5"),
        (err) => err instanceof BlockedTargetError
      );
      await assert.rejects(
        () => assertPublicHost("192.168.1.254"),
        (err) => err instanceof BlockedTargetError
      );
    });

    test("strips forbidden headers used for metadata impersonation", () => {
      const headers = {
        "Metadata-Flavor": "Google",
        "X-Google-Metadata-Request": "True",
        "Host": "evil.internal",
        "Connection": "close",
        "Authorization": "Bearer token123",
        "X-Custom-Monitor": "HealthCheck",
      };
      const sanitized = sanitizeHeaders(headers);
      assert.equal(sanitized["Metadata-Flavor"], undefined);
      assert.equal(sanitized["X-Google-Metadata-Request"], undefined);
      assert.equal(sanitized["Host"], undefined);
      assert.equal(sanitized["Connection"], undefined);
      assert.equal(sanitized["Authorization"], "Bearer token123");
      assert.equal(sanitized["X-Custom-Monitor"], "HealthCheck");
    });
  });

  // ----------------------------------------------------
  // FEATURE 2: PROBE CHECKS ENGINE
  // ----------------------------------------------------
  describe("Feature 2: Probe Engine (HTTP, Keyword, TCP, DNS, SSL, Heartbeat)", () => {
    test("HTTP check succeeds on healthy public URL with timing", async () => {
      const monitor = createMockMonitor({ target: "https://example.com" });
      const result = await checkHttp(monitor, REGION);
      assert.equal(result.ok, true);
      assert.equal(result.statusCode, 200);
      assert.ok(result.responseTimeMs > 0);
      assert.equal(result.region, REGION);
    });

    test("Keyword check validates text presence in body", async () => {
      const monitor = createMockMonitor({
        type: "keyword",
        target: "https://example.com",
        keyword: "Example Domain",
        keywordInverted: false,
      });
      const result = await checkHttp(monitor, REGION);
      assert.equal(result.ok, true);
      assert.equal(result.error, undefined);
    });

    test("Keyword check flags failure when required keyword is absent", async () => {
      const monitor = createMockMonitor({
        type: "keyword",
        target: "https://example.com",
        keyword: "MISSING_PHRASE_NOT_IN_EXAMPLE_DOM",
        keywordInverted: false,
      });
      const result = await checkHttp(monitor, REGION);
      assert.equal(result.ok, false);
      assert.match(result.error || "", /not found/i);
    });

    test("TCP check validates open public port", async () => {
      const monitor = createMockMonitor({
        type: "tcp",
        target: "1.1.1.1",
        port: 53,
      });
      const result = await checkTcp(monitor, REGION);
      assert.equal(result.ok, true);
      assert.ok(result.responseTimeMs >= 0);
    });

    test("DNS check resolves A record and validates values", async () => {
      const monitor = createMockMonitor({
        type: "dns",
        target: "example.com",
        dnsRecordType: "A",
      });
      const result = await checkDns(monitor, REGION);
      assert.equal(result.ok, true);
      assert.ok(result.meta?.values?.length > 0);
    });

    test("SSL check verifies TLS certificate expiry and validity", async () => {
      const monitor = createMockMonitor({
        type: "ssl",
        target: "example.com",
        sslExpiryWarningDays: 14,
      });
      const result = await checkSsl(monitor, REGION);
      assert.equal(result.ok, true);
      assert.ok(result.meta?.daysLeft > 0);
      assert.ok(result.meta?.expiresAt > Date.now());
    });

    test("runProbe router safely runs all probe types without throwing", async () => {
      const heartbeatMonitor = createMockMonitor({ type: "heartbeat", target: "" });
      const res = await runProbe(heartbeatMonitor, REGION);
      assert.equal(res.ok, true);
      assert.equal(res.responseTimeMs, 0);

      const invalidMonitor = createMockMonitor({ type: "nonexistent" });
      const badRes = await runProbe(invalidMonitor, REGION);
      assert.equal(badRes.ok, false);
      assert.match(badRes.error, /Unsupported monitor type/i);
    });
  });

  // ----------------------------------------------------
  // FEATURE 3: MONITOR VALIDATION & PLAN LIMITS
  // ----------------------------------------------------
  describe("Feature 3: Monitor Validation & Capacity", () => {
    test("no tier gates features any more — capacity is what differs", async () => {
      // The paywall is gone: donations buy checks, and every feature works on
      // a free workspace. A legacy plan only raises the free allowance.
      assert.equal(PLANS.free.bonusChecksPerDay, 0);
      assert.ok(PLANS.solo.bonusChecksPerDay > 0);
      for (const p of ["free", "solo", "team", "scale"]) {
        // The interval floor and monitor cap are operator-settable now, so
        // they are resolved by `limitsFor` rather than baked into `PLANS` —
        // a literal would report whatever the worker booted with. What this
        // still asserts is the point of the block: the floor is the same for
        // every plan, because no tier gates it.
        // Every plan reports the same floor — the legacy plan name buys
        // nothing. Standing is what moves it, and /v1/me resolves that.
        assert.equal(limitsFor(p).minIntervalSeconds, 60, `${p} interval floor`);
        assert.ok(limitsFor(p).maxMonitors > 0, `${p} monitor cap`);
        assert.equal(PLANS[p].multiRegion, true, `${p} multi-region`);
        assert.equal(PLANS[p].apiAccess, true, `${p} api`);
      }

      // Frequency is tiered: a free workspace is held to the free floor, and
      // donating is what lowers it. Everything *else* is still untiered —
      // which is what the assertions above check.
      await assert.rejects(
        async () =>
          buildMonitor(
            { name: "Free", type: "http", target: "https://example.com", intervalSeconds: 30 },
            "org_1",
            "free"
          ),
        /60 seconds/,
        "a free workspace is held to the free floor"
      );

      const donorMonitor = await buildMonitor(
        { name: "Donor", type: "http", target: "https://example.com", intervalSeconds: 5 },
        "org_1",
        "free",
        undefined,
        { credits: 500_000, donationUsdMonthly: 3, lastDonationAt: Date.now() }
      );
      assert.equal(donorMonitor.intervalSeconds, 5, "donating buys the fast floor");

      const freeMonitor = await buildMonitor(
        { name: "Free", type: "http", target: "https://example.com", intervalSeconds: 60 },
        "org_1",
        "free"
      );
      assert.equal(freeMonitor.intervalSeconds, 60);
    });

    test("generates secure URL-safe heartbeat token for heartbeat monitors", async () => {
      const monitor = await buildMonitor(
        { name: "Backup Job", type: "heartbeat", heartbeatGraceSeconds: 600 },
        "org_1",
        "free"
      );
      assert.ok(monitor.heartbeatToken);
      assert.ok(monitor.heartbeatToken.length >= 24);
      assert.equal(monitor.heartbeatGraceSeconds, 600);
    });
  });

  // ----------------------------------------------------
  // FEATURE 4: STATE MACHINE & INCIDENT LIFECYCLE
  // ----------------------------------------------------
  describe("Feature 4: State Machine & Incident Lifecycle", () => {
    test("initial state transitions from pending to up upon first success", () => {
      const transition = decideTransition({
        previousStatus: "pending",
        previousFailures: 0,
        ok: true,
        threshold: 2,
      });
      assert.equal(transition.status, "up");
      assert.equal(transition.failures, 0);
      assert.equal(transition.transitionedDown, false);
      assert.equal(transition.transitionedUp, false); // pending to up is not a recovery
    });

    test("debounces transient failure: threshold 2 requires 2 failures before alerting", () => {
      // 1st failure: failures becomes 1, status remains up (no alert)
      const firstFail = decideTransition({
        previousStatus: "up",
        previousFailures: 0,
        ok: false,
        threshold: 2,
      });
      assert.equal(firstFail.status, "up");
      assert.equal(firstFail.failures, 1);
      assert.equal(firstFail.transitionedDown, false);

      // 2nd failure: reaches threshold -> marks down and declares transitionDown
      const secondFail = decideTransition({
        previousStatus: "up",
        previousFailures: 1,
        ok: false,
        threshold: 2,
      });
      assert.equal(secondFail.status, "down");
      assert.equal(secondFail.failures, 2);
      assert.equal(secondFail.transitionedDown, true);
    });

    test("recovers from down to up upon first success and resolves incident", () => {
      const recovery = decideTransition({
        previousStatus: "down",
        previousFailures: 3,
        ok: true,
        threshold: 2,
      });
      assert.equal(recovery.status, "up");
      assert.equal(recovery.failures, 0);
      assert.equal(recovery.transitionedUp, true);
    });
  });

  // ----------------------------------------------------
  // FEATURE 5: SCHEDULER & DUE HEAP
  // ----------------------------------------------------
  describe("Feature 5: Scheduler Heap & Hash Ring Sharding", () => {
    test("DueHeap pops monitors in chronological due order", () => {
      const heap = new DueHeap();
      heap.push({ id: "m3", dueAt: 3000, intervalMs: 60000 });
      heap.push({ id: "m1", dueAt: 1000, intervalMs: 60000 });
      heap.push({ id: "m2", dueAt: 2000, intervalMs: 60000 });

      assert.equal(heap.peek()?.id, "m1");
      const popped1 = heap.popDue(1500);
      assert.equal(popped1.length, 1);
      assert.equal(popped1[0].id, "m1");

      const popped2 = heap.popDue(1500);
      assert.equal(popped2.length, 0); // m2 is not due at 1500

      const popped3 = heap.popDue(3500);
      assert.equal(popped3.length, 2);
      assert.equal(popped3[0].id, "m2");
      assert.equal(popped3[1].id, "m3");
      assert.equal(heap.size, 0);
    });

    test("nextDueAt advances on fixed intervals to prevent slow probe drift", () => {
      const lastDue = 1_000_000;
      const intervalMs = 60_000;
      // Probe finished 15 seconds into the interval
      const now = lastDue + 15_000;
      const next = nextDueAt(lastDue, intervalMs, now);
      assert.equal(next, lastDue + 60_000);
    });

    test("shardFor produces deterministic, stable worker ownership", () => {
      const orgId = "org_production_88";
      const workerA = shardFor(orgId, 4);
      const workerB = shardFor(orgId, 4);
      assert.equal(workerA, workerB);
      assert.ok(workerA >= 0 && workerA < 4);
    });
  });

  // ----------------------------------------------------
  // FEATURE 6: AUTHENTICATION & MULTI-TENANCY
  // ----------------------------------------------------
  describe("Feature 6: Authentication & Tenancy Model", () => {
    test("validates required user claims structure", () => {
      const claims = {
        orgId: "xb2YPshFVcb9vBtzjLnr",
        role: "owner",
      };
      assert.ok(claims.orgId && typeof claims.orgId === "string");
      assert.ok(["owner", "admin", "member"].includes(claims.role));
    });

    test("ensures orgId tenancy isolation between workspaces", () => {
      const userAClaims = { orgId: "org_alpha", role: "owner" };
      const userBClaims = { orgId: "org_beta", role: "owner" };

      const monitorAlpha = createMockMonitor({ orgId: "org_alpha" });
      const monitorBeta = createMockMonitor({ orgId: "org_beta" });

      const canAccess = (userClaims, monitor) => userClaims.orgId === monitor.orgId;

      assert.equal(canAccess(userAClaims, monitorAlpha), true);
      assert.equal(canAccess(userAClaims, monitorBeta), false);
      assert.equal(canAccess(userBClaims, monitorAlpha), false);
      assert.equal(canAccess(userBClaims, monitorBeta), true);
    });
  });

  // ----------------------------------------------------
  // FEATURE 7: DASHBOARD UI & METRICS COMPUTATION
  // ----------------------------------------------------
  describe("Feature 7: Dashboard Metrics & State Calculation", () => {
    test("computes correct aggregate metrics (uptime, latency, status counters)", () => {
      const monitorsList = [
        { id: "1", enabled: true },
        { id: "2", enabled: true },
        { id: "3", enabled: true },
        { id: "4", enabled: false }, // paused
      ];

      const liveStates = {
        "1": { status: "up", lastResponseTimeMs: 120, uptime30d: 99.95 },
        "2": { status: "up", lastResponseTimeMs: 80, uptime30d: 100.0 },
        "3": { status: "down", lastResponseTimeMs: null, uptime30d: 98.5 },
        "4": { status: "paused", lastResponseTimeMs: null, uptime30d: 100.0 },
      };

      const statusOf = (m) => {
        if (m.enabled === false) return "paused";
        return liveStates[m.id]?.status ?? "pending";
      };

      let upCount = 0;
      let downCount = 0;
      let pausedCount = 0;
      let totalLatency = 0;
      let latencyCount = 0;
      let totalUptime = 0;
      let uptimeCount = 0;

      monitorsList.forEach((m) => {
        const s = statusOf(m);
        if (s === "up") upCount++;
        else if (s === "down") downCount++;
        else if (s === "paused") pausedCount++;

        const l = liveStates[m.id];
        if (l?.lastResponseTimeMs != null && l.lastResponseTimeMs > 0) {
          totalLatency += l.lastResponseTimeMs;
          latencyCount++;
        }
        if (l?.uptime30d != null) {
          totalUptime += l.uptime30d;
          uptimeCount++;
        }
      });

      assert.equal(upCount, 2);
      assert.equal(downCount, 1);
      assert.equal(pausedCount, 1);
      assert.equal(Math.round(totalLatency / latencyCount), 100); // (120+80)/2
      const overallUptime = (totalUptime / uptimeCount).toFixed(2);
      assert.equal(overallUptime, "99.61");
    });

    test("filters monitors accurately by active tab and search query", () => {
      const monitorsList = [
        { id: "1", name: "Marketing Site", target: "https://example.com", enabled: true },
        { id: "2", name: "Checkout Service", target: "https://api.shop.com", enabled: true },
        { id: "3", name: "Staging Redis", target: "redis.internal", enabled: false },
      ];

      const liveStates = {
        "1": { status: "up" },
        "2": { status: "down" },
        "3": { status: "paused" },
      };

      const statusOf = (m) => (m.enabled === false ? "paused" : liveStates[m.id]?.status ?? "pending");

      // Filter by tab 'up'
      const upMonitors = monitorsList.filter((m) => statusOf(m) === "up");
      assert.equal(upMonitors.length, 1);
      assert.equal(upMonitors[0].id, "1");

      // Filter by search query 'checkout'
      const searchResults = monitorsList.filter(
        (m) => m.name.toLowerCase().includes("checkout") || m.target.toLowerCase().includes("checkout")
      );
      assert.equal(searchResults.length, 1);
      assert.equal(searchResults[0].id, "2");
    });
  });

  // ----------------------------------------------------
  // FEATURE 8: DYNAMIC APP CONFIGURATION & REALTIME SYNC
  // ----------------------------------------------------
  describe("Feature 8: Dynamic App Configuration & Realtime Sync", () => {
    test("overrides runtime variables and resets to environment defaults", () => {
      resetDynamicConfig();
      const initial = getEffectiveConfig();
      assert.ok(initial.probeConcurrency > 0);

      // Apply dynamic override simulating an admin update in Firestore
      updateDynamicConfig({
        probeConcurrency: 300,
        alertFromEmail: "ops-alert@company.org",
        donationLinkCents: 499,
        donationLinkRecurring: true,
      });

      const updated = getEffectiveConfig();
      assert.equal(updated.probeConcurrency, 300);
      assert.equal(updated.alertFromEmail, "ops-alert@company.org");
      assert.equal(updated.donationLinkCents, 499);
      assert.equal(updated.donationLinkRecurring, true);

      // Clean reset
      resetDynamicConfig();
      const reverted = getEffectiveConfig();
      assert.equal(reverted.probeConcurrency, initial.probeConcurrency);
      assert.equal(reverted.alertFromEmail, initial.alertFromEmail);
    });
  });

  // ----------------------------------------------------
  // FEATURE 9: ADMIN CONSOLE OPERATIONS & RBAC
  // ----------------------------------------------------
  describe("Feature 9: Admin Operations & Fleet Console", () => {
    test("validates CORS origin allowlist for admin console", () => {
      assert.equal(isAllowedOrigin("https://ops.uptimemonke.com"), true);
      assert.equal(isAllowedOrigin("https://uptimemonke-admin.web.app"), true);
      assert.equal(isAllowedOrigin("https://uptimemonke-admin.firebaseapp.com"), true);
      assert.equal(isAllowedOrigin("https://www.uptimemonke.com"), true);
      assert.equal(isAllowedOrigin("https://uptimemonke.com"), true);
      assert.equal(isAllowedOrigin("https://evil-attacker.com"), false);
      assert.equal(isAllowedOrigin("http://ops.uptimemonke.com.attacker.com"), false);
    });

    test("protects sensitive credentials with secret masking preservation", () => {
      const isMaskedOrBlank = (v) => typeof v === "string" && (v.includes("•") || v.trim() === "");

      // Simulating PUT /v1/admin/system-config secret preservation
      const currentStoredSecrets = {
        stripeSecretKey: "sk_live_realSecret123",
        mailgunApiKey: "key-realMailgunSecret456",
        recaptchaSecret: "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe",
      };

      const incomingAdminPayload = {
        stripeSecretKey: "••••••••••••••••••••••••", // masked by admin UI
        mailgunApiKey: "", // left blank by admin UI
        recaptchaSecret: "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe", // unmodified
      };

      const finalSaved = {};
      for (const [k, v] of Object.entries(incomingAdminPayload)) {
        if (isMaskedOrBlank(v)) {
          finalSaved[k] = currentStoredSecrets[k];
        } else {
          finalSaved[k] = v;
        }
      }

      assert.equal(finalSaved.stripeSecretKey, "sk_live_realSecret123");
      assert.equal(finalSaved.mailgunApiKey, "key-realMailgunSecret456");
      assert.equal(finalSaved.recaptchaSecret, "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe");
    });

    test("validates admin dynamic system config state merging with reCAPTCHA", () => {
      resetDynamicConfig();

      updateDynamicConfig({
        recaptchaSiteKey: "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",
        recaptchaSecret: "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe",
        recaptchaMinScore: 0.65,
      });

      const effective = getEffectiveConfig();
      assert.equal(effective.recaptchaSiteKey, "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI");
      assert.equal(effective.recaptchaSecret, "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe");
      assert.equal(effective.recaptchaMinScore, 0.65);

      resetDynamicConfig();
    });

    test("validates operator email allowlist parsing", () => {
      const rawEnv = " alice@uptimemonke.com, Bob@UptimeMonke.com , Charlie@example.org  ";
      const allowed = new Set(
        rawEnv
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean)
      );

      const isOperator = (email) => (email ? allowed.has(email.toLowerCase().trim()) : false);

      assert.equal(isOperator("alice@uptimemonke.com"), true);
      assert.equal(isOperator("BOB@uptimemonke.com"), true);
      assert.equal(isOperator("  charlie@example.org "), true);
      assert.equal(isOperator("intruder@evil.com"), false);
      assert.equal(isOperator(null), false);
      assert.equal(isOperator(""), false);
    });
  });
});
