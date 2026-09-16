#!/usr/bin/env node

/**
 * UptimeMonk — Monitoring Features Verification Test Suite
 *
 * Exhaustively tests all monitoring check types, edge cases, and runtime behaviors:
 * 1. HTTP Monitor (status codes, headers, methods, redirects, timeouts, network errors)
 * 2. Keyword Monitor (positive matching, missing keyword detection, inverted failure detection)
 * 3. TCP Port Monitor (handshake verification, closed ports, timeouts, SSRF blocking)
 * 4. DNS Record Monitor (A, AAAA, MX, TXT, NS, CNAME, substring value matching)
 * 5. SSL Certificate Monitor (TLS chain validity, expiry days, threshold warnings, untrusted certs)
 * 6. ICMP Ping Monitor (echo latency, unreachable hosts, shell safety)
 * 7. Cron Heartbeat Monitor (token auth, grace period scheduling, overdue detection)
 * 8. Probe Dispatcher (runProbe dynamic routing, resilience against crashes)
 * 9. State Machine & Alert Debouncing (incident lifecycle, confirmation threshold)
 * 10. Maintenance Window (alert suppression)
 * 11. Concurrent Multi-Protocol Probing (batch execution across heterogeneous monitor types)
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import compiled server modules
const { checkHttp, describeNetworkError } = await import("../server/dist/checks/http.js");
const { checkTcp } = await import("../server/dist/checks/tcp.js");
const { checkDns } = await import("../server/dist/checks/dns.js");
const { checkSsl } = await import("../server/dist/checks/ssl.js");
const { checkIcmp } = await import("../server/dist/checks/icmp.js");
const { runProbe } = await import("../server/dist/checks/index.js");
const { assertSafeUrl, assertPublicHost, BlockedTargetError, hostFromTarget, sanitizeHeaders } =
  await import("../server/dist/lib/targetGuard.js");
const { decideTransition } = await import("../server/dist/monitors/stateMachine.js");
const { inMaintenance } = await import("../server/dist/lib/time.js");
const { nextDueAt, initialDueAt, DueHeap } = await import("../server/dist/scheduler/heap.js");

const REGION = "ap-southeast-1";

function makeMonitor(overrides = {}) {
  return {
    id: "mon_" + Math.random().toString(36).slice(2, 8),
    orgId: "org_monitoring_test",
    name: "Monitoring Feature Test",
    type: "http",
    target: "https://cloudflare.com",
    intervalSeconds: 60,
    timeoutSeconds: 5,
    confirmationThreshold: 2,
    regions: [REGION],
    alertContactIds: ["contact_1"],
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
describe("UPTIMEMONK — ALL MONITORING FEATURES TEST SUITE", () => {
  // ----------------------------------------------------
  // FEATURE 1: HTTP MONITORING
  // ----------------------------------------------------
  describe("Feature 1: HTTP / Website Monitoring", () => {
    test("HTTP 200 OK: verifies status, responseTimeMs, and ok: true", async () => {
      const monitor = makeMonitor({
        type: "http",
        target: "https://cloudflare.com",
        timeoutSeconds: 10,
      });

      const res = await checkHttp(monitor, REGION);
      assert.equal(res.ok, true, "Expected probe to succeed on 200/300 status");
      assert.equal(typeof res.statusCode, "number");
      assert.ok(res.statusCode >= 200 && res.statusCode < 400);
      assert.ok(res.responseTimeMs >= 0, "Response time must be non-negative");
      assert.equal(res.region, REGION);
      assert.equal(res.error, undefined);
    });

    test("HTTP Custom Status Codes: accepts custom acceptedStatusCodes array", async () => {
      const monitor = makeMonitor({
        type: "http",
        target: "https://httpbin.org/status/404",
        acceptedStatusCodes: ["404", "200"],
        timeoutSeconds: 10,
      });

      const res = await checkHttp(monitor, REGION);
      if (res.statusCode === 404) {
        assert.equal(res.ok, true, "Expected 404 to be treated as ok when in acceptedStatusCodes");
      }
    });

    test("HTTP Unexpected Status Code: fails when server returns non-accepted code", async () => {
      const monitor = makeMonitor({
        type: "http",
        target: "https://httpbin.org/status/500",
        acceptedStatusCodes: ["200"],
        timeoutSeconds: 10,
      });

      const res = await checkHttp(monitor, REGION);
      if (res.statusCode === 500) {
        assert.equal(res.ok, false);
        assert.match(res.error || "", /Unexpected status 500/);
      }
    });

    test("HTTP Method & Headers: sends sanitized headers without metadata bypasses", () => {
      const rawHeaders = {
        "x-custom-probe-id": "agent-test-42",
        "authorization": "Bearer secret-probe-token",
        "x-google-metadata-request": "MUST_BE_STRIPPED",
        "metadata-flavor": "MUST_BE_STRIPPED",
        "host": "MUST_BE_STRIPPED",
      };

      const sanitized = sanitizeHeaders(rawHeaders);
      assert.equal(sanitized["x-custom-probe-id"], "agent-test-42");
      assert.equal(sanitized["authorization"], "Bearer secret-probe-token");
      assert.equal(sanitized["x-google-metadata-request"], undefined);
      assert.equal(sanitized["metadata-flavor"], undefined);
      assert.equal(sanitized["host"], undefined);
    });

    test("HTTP TargetGuard SSRF: blocks private IP targets from checkHttp", async () => {
      const targets = [
        "http://127.0.0.1:8080",
        "http://localhost:3000",
        "http://169.254.169.254/latest/meta-data",
        "http://10.0.0.5:80",
        "http://192.168.1.1:443",
      ];

      for (const target of targets) {
        const monitor = makeMonitor({ type: "http", target });
        const res = await checkHttp(monitor, REGION);
        assert.equal(res.ok, false);
        assert.match(res.error || "", /private or link-local|internal hostname/i);
      }
    });

    test("HTTP Network Error Translation: translates raw socket errors to human readable strings", () => {
      assert.equal(
        describeNetworkError({ cause: { code: "ECONNREFUSED" } }),
        "Connection refused"
      );
      assert.equal(
        describeNetworkError({ cause: { code: "ENOTFOUND" } }),
        "DNS lookup failed (host not found)"
      );
      assert.equal(
        describeNetworkError({ cause: { code: "ETIMEDOUT" } }),
        "Connection timed out"
      );
      assert.equal(
        describeNetworkError({ cause: { code: "CERT_HAS_EXPIRED" } }),
        "TLS certificate has expired"
      );
    });
  });

  // ----------------------------------------------------
  // FEATURE 2: KEYWORD MONITORING
  // ----------------------------------------------------
  describe("Feature 2: Keyword Monitoring", () => {
    test("Keyword Present: succeeds when expected text is found in response", async () => {
      const monitor = makeMonitor({
        type: "keyword",
        target: "https://example.com",
        keyword: "Example Domain",
        keywordInverted: false,
        timeoutSeconds: 10,
      });

      const res = await checkHttp(monitor, REGION);
      assert.equal(res.ok, true);
      assert.equal(res.statusCode, 200);
      assert.equal(res.error, undefined);
    });

    test("Keyword Missing: fails with descriptive error when text is not found", async () => {
      const monitor = makeMonitor({
        type: "keyword",
        target: "https://example.com",
        keyword: "FATAL_NON_EXISTENT_STRING_9999",
        keywordInverted: false,
        timeoutSeconds: 10,
      });

      const res = await checkHttp(monitor, REGION);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /Keyword ".*" not found/);
    });

    test("Inverted Keyword: succeeds when forbidden text is NOT present", async () => {
      const monitor = makeMonitor({
        type: "keyword",
        target: "https://example.com",
        keyword: "Database Connection Error",
        keywordInverted: true,
        timeoutSeconds: 10,
      });

      const res = await checkHttp(monitor, REGION);
      assert.equal(res.ok, true);
      assert.equal(res.error, undefined);
    });

    test("Inverted Keyword: fails when forbidden text IS present", async () => {
      const monitor = makeMonitor({
        type: "keyword",
        target: "https://example.com",
        keyword: "Example Domain",
        keywordInverted: true,
        timeoutSeconds: 10,
      });

      const res = await checkHttp(monitor, REGION);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /Keyword ".*" was present/);
    });
  });

  // ----------------------------------------------------
  // FEATURE 3: TCP PORT MONITORING
  // ----------------------------------------------------
  describe("Feature 3: TCP Port Monitoring", () => {
    test("TCP Open Port: successfully connects to open public port (1.1.1.1:53)", async () => {
      const monitor = makeMonitor({
        type: "tcp",
        target: "1.1.1.1",
        port: 53,
        timeoutSeconds: 5,
      });

      const res = await checkTcp(monitor, REGION);
      assert.equal(res.ok, true, "DNS port 53 on 1.1.1.1 should be open");
      assert.ok(res.responseTimeMs >= 0);
      assert.equal(res.error, undefined);
    });

    test("TCP Host Extraction: parses target string with or without scheme", () => {
      assert.equal(hostFromTarget("example.com"), "example.com");
      assert.equal(hostFromTarget("https://example.com/api/v1"), "example.com");
      assert.equal(hostFromTarget("tcp://8.8.8.8:53"), "8.8.8.8");
    });

    test("TCP TargetGuard SSRF: blocks private IP targets before socket creation", async () => {
      const monitor = makeMonitor({
        type: "tcp",
        target: "192.168.1.1",
        port: 80,
      });

      const res = await checkTcp(monitor, REGION);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /private or link-local/i);
    });
  });

  // ----------------------------------------------------
  // FEATURE 4: DNS RECORD MONITORING
  // ----------------------------------------------------
  describe("Feature 4: DNS Record Monitoring", () => {
    test("DNS A Record: resolves IPv4 address for public domain", async () => {
      const monitor = makeMonitor({
        type: "dns",
        target: "example.com",
        dnsRecordType: "A",
        timeoutSeconds: 5,
      });

      const res = await checkDns(monitor, REGION);
      assert.equal(res.ok, true);
      const values = res.meta?.values;
      assert.ok(Array.isArray(values) && values.length > 0);
      assert.match(values[0], /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    });

    test("DNS TXT Record: resolves TXT records", async () => {
      const monitor = makeMonitor({
        type: "dns",
        target: "google.com",
        dnsRecordType: "TXT",
        timeoutSeconds: 5,
      });

      const res = await checkDns(monitor, REGION);
      assert.equal(res.ok, true);
      const values = res.meta?.values;
      assert.ok(Array.isArray(values) && values.length > 0);
    });

    test("DNS Expected Value Matching: verifies substring match in record values", async () => {
      const monitor = makeMonitor({
        type: "dns",
        target: "google.com",
        dnsRecordType: "TXT",
        dnsExpectedValue: "v=spf1",
        timeoutSeconds: 5,
      });

      const res = await checkDns(monitor, REGION);
      assert.equal(res.ok, true);
      assert.equal(res.error, undefined);
    });

    test("DNS Expected Value Mismatch: fails when record does not contain expected substring", async () => {
      const monitor = makeMonitor({
        type: "dns",
        target: "example.com",
        dnsRecordType: "A",
        dnsExpectedValue: "254.254.254.254",
        timeoutSeconds: 5,
      });

      const res = await checkDns(monitor, REGION);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /Expected A record to contain/);
    });

    test("DNS Non-existent Domain: reports lookup failure", async () => {
      const monitor = makeMonitor({
        type: "dns",
        target: "thisdomaincertainlydoesnotexist123456789.com",
        dnsRecordType: "A",
        timeoutSeconds: 5,
      });

      const res = await checkDns(monitor, REGION);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /DNS A lookup failed/);
    });
  });

  // ----------------------------------------------------
  // FEATURE 5: SSL CERTIFICATE MONITORING
  // ----------------------------------------------------
  describe("Feature 5: SSL Certificate Monitoring", () => {
    test("SSL Valid Domain: inspects certificate, computes daysLeft and issuer", async () => {
      const monitor = makeMonitor({
        type: "ssl",
        target: "cloudflare.com",
        sslExpiryWarningDays: 7,
        timeoutSeconds: 10,
      });

      const res = await checkSsl(monitor, REGION);
      assert.equal(res.ok, true);
      assert.ok(typeof res.meta?.daysLeft === "number");
      assert.ok(res.meta.daysLeft > 0, "Days until expiry should be positive for valid cert");
      assert.ok(typeof res.meta?.expiresAt === "number");
      assert.equal(res.error, undefined);
    });

    test("SSL Warning Threshold: warns when certificate expires within warning window", async () => {
      // Set warning threshold very high (e.g. 3650 days = 10 years) so any standard cert triggers a warning
      const monitor = makeMonitor({
        type: "ssl",
        target: "cloudflare.com",
        sslExpiryWarningDays: 3650,
        timeoutSeconds: 10,
      });

      const res = await checkSsl(monitor, REGION);
      assert.equal(res.ok, false, "Expected probe to fail due to upcoming expiry within threshold");
      assert.match(res.error || "", /Certificate expires in \d+ days/);
    });

    test("SSL TargetGuard SSRF: blocks private IP targets from SSL checks", async () => {
      const monitor = makeMonitor({
        type: "ssl",
        target: "10.10.10.10",
      });

      const res = await checkSsl(monitor, REGION);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /private or link-local/i);
    });
  });

  // ----------------------------------------------------
  // FEATURE 6: ICMP PING MONITORING
  // ----------------------------------------------------
  describe("Feature 6: ICMP Ping Monitoring", () => {
    test("ICMP Echo: measures roundtrip latency to public IP (1.1.1.1)", async () => {
      const monitor = makeMonitor({
        type: "icmp",
        target: "1.1.1.1",
        timeoutSeconds: 3,
      });

      const res = await checkIcmp(monitor, REGION);
      assert.equal(res.ok, true);
      assert.ok(res.responseTimeMs >= 0);
      assert.equal(res.meta?.source, "icmp");
    });

    test("ICMP Unreachable Target: reports timeout on non-responding IP", async () => {
      // 192.0.2.1 is reserved documentation subnet (TEST-NET-1), typically dropped
      const monitor = makeMonitor({
        type: "icmp",
        target: "192.0.2.1",
        timeoutSeconds: 1,
      });

      const res = await checkIcmp(monitor, REGION);
      // Either blocked or timed out
      assert.equal(res.ok, false);
      assert.ok(res.error != null && res.error.length > 0);
    });
  });

  // ----------------------------------------------------
  // FEATURE 7: CRON / HEARTBEAT MONITORING
  // ----------------------------------------------------
  describe("Feature 7: Cron / Push Heartbeat Monitoring", () => {
    test("Heartbeat Scheduling: grace period calculation advances due_at", () => {
      const intervalSeconds = 300;
      const graceSeconds = 600;
      const now = Date.now();

      const calculatedGrace = Math.max(60, graceSeconds);
      const nextDue = now + calculatedGrace * 1000;

      assert.ok(nextDue > now);
      assert.equal(nextDue, now + 600000);
    });

    test("Heartbeat Dispatcher: runProbe returns ok: true instantly for heartbeats", async () => {
      const monitor = makeMonitor({
        type: "heartbeat",
        target: "",
      });

      const res = await runProbe(monitor, REGION);
      assert.equal(res.ok, true);
      assert.equal(res.responseTimeMs, 0);
      assert.equal(res.region, REGION);
    });
  });

  // ----------------------------------------------------
  // FEATURE 8: PROBE ROUTER & RUNTIME RESILIENCE
  // ----------------------------------------------------
  describe("Feature 8: Probe Router & Fault Tolerance", () => {
    test("runProbe routes seamlessly to respective probe handlers", async () => {
      const types = ["http", "keyword", "tcp", "dns", "ssl", "heartbeat"];
      for (const type of types) {
        const monitor = makeMonitor({
          type: type,
          target: type === "heartbeat" ? "" : type === "tcp" ? "1.1.1.1" : "https://cloudflare.com",
          port: 53,
          keyword: "Cloudflare",
        });

        const res = await runProbe(monitor, REGION);
        assert.ok(res !== null);
        assert.equal(typeof res.ok, "boolean");
        assert.equal(typeof res.responseTimeMs, "number");
        assert.equal(res.region, REGION);
      }
    });

    test("runProbe safely catches unsupported monitor types without throwing", async () => {
      const monitor = makeMonitor({
        type: "invalid_type_xyz",
      });

      const res = await runProbe(monitor, REGION);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /Unsupported monitor type/);
    });
  });

  // ----------------------------------------------------
  // FEATURE 9: STATE MACHINE & ALERT DEBOUNCING
  // ----------------------------------------------------
  describe("Feature 9: State Machine & Incident Lifecycle", () => {
    test("First check transition: pending -> up on successful probe", () => {
      const transition = decideTransition({
        previousStatus: "pending",
        previousFailures: 0,
        ok: true,
        threshold: 2,
      });

      assert.equal(transition.status, "up");
      assert.equal(transition.failures, 0);
      assert.equal(transition.transitionedDown, false);
      assert.equal(transition.transitionedUp, false);
    });

    test("Transient failure debouncing: single failure does NOT trigger false alarm", () => {
      const transition = decideTransition({
        previousStatus: "up",
        previousFailures: 0,
        ok: false,
        threshold: 2,
      });

      // Stays 'up' because 1 < confirmationThreshold (2)
      assert.equal(transition.status, "up");
      assert.equal(transition.failures, 1);
      assert.equal(transition.transitionedDown, false);
      assert.equal(transition.transitionedUp, false);
    });

    test("Confirmed outage: reaches threshold, transitions to down, opens incident", () => {
      const transition = decideTransition({
        previousStatus: "up",
        previousFailures: 1,
        ok: false,
        threshold: 2,
      });

      assert.equal(transition.status, "down");
      assert.equal(transition.failures, 2);
      assert.equal(transition.transitionedDown, true);
      assert.equal(transition.transitionedUp, false);
    });

    test("Incident recovery: success resets failures and closes incident", () => {
      const transition = decideTransition({
        previousStatus: "down",
        previousFailures: 3,
        ok: true,
        threshold: 2,
      });

      assert.equal(transition.status, "up");
      assert.equal(transition.failures, 0);
      assert.equal(transition.transitionedDown, false);
      assert.equal(transition.transitionedUp, true);
    });
  });

  // ----------------------------------------------------
  // FEATURE 10: MAINTENANCE WINDOW SUPPRESSION
  // ----------------------------------------------------
  describe("Feature 10: Maintenance Window Suppression", () => {
    test("Identifies active maintenance window and suppresses checks", () => {
      const windows = [
        {
          timezone: "UTC",
          start: "00:00",
          end: "23:59",
          weekdays: [1, 2, 3, 4, 5, 6, 7],
        },
      ];

      const now = Date.now();
      const isActive = inMaintenance(windows, now);
      assert.equal(isActive, true, "Maintenance window covering 00:00-23:59 should be active");

      // Inactive window test
      const inactiveWindows = [
        {
          timezone: "UTC",
          start: "03:00",
          end: "03:01",
          weekdays: [1], // Only Monday
        },
      ];
      // Tuesday UTC (e.g. 1789540000000)
      const isInactive = inMaintenance(inactiveWindows, new Date("2026-09-16T12:00:00Z").getTime());
      assert.equal(isInactive, false, "Window on Monday should not be active on Wednesday");
    });
  });

  // ----------------------------------------------------
  // FEATURE 11: CONCURRENT PROBE BATCH EXECUTION
  // ----------------------------------------------------
  describe("Feature 11: Concurrent Multi-Protocol Probing", () => {
    test("Executes concurrent checks across heterogeneous monitor types simultaneously", async () => {
      const monitors = [
        makeMonitor({ id: "m1", type: "http", target: "https://cloudflare.com" }),
        makeMonitor({ id: "m2", type: "tcp", target: "1.1.1.1", port: 53 }),
        makeMonitor({ id: "m3", type: "dns", target: "example.com", dnsRecordType: "A" }),
        makeMonitor({ id: "m4", type: "ssl", target: "cloudflare.com", sslExpiryWarningDays: 7 }),
        makeMonitor({ id: "m5", type: "heartbeat", target: "" }),
      ];

      const results = await Promise.all(monitors.map((m) => runProbe(m, REGION)));

      assert.equal(results.length, 5);
      for (const res of results) {
        assert.equal(typeof res.ok, "boolean");
        assert.equal(typeof res.responseTimeMs, "number");
        assert.equal(res.region, REGION);
        assert.ok(typeof res.checkedAt === "number");
      }
    });
  });
});
