import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildMonitor, ValidationError } from "./validate.js";
import type { MonitorInput } from "./validate.js";

describe("Monitor Input Validation & Plan Limits", () => {
  const orgId = "org-test-123";

  test("validates and builds a standard HTTP monitor", async () => {
    const input: MonitorInput = {
      name: "My Website",
      type: "http",
      target: "https://example.com",
      intervalSeconds: 300,
      timeoutSeconds: 10,
    };

    const monitor = await buildMonitor(input, orgId, "free");
    assert.equal(monitor.name, "My Website");
    assert.equal(monitor.type, "http");
    assert.equal(monitor.target, "https://example.com");
    assert.equal(monitor.intervalSeconds, 300);
    assert.equal(monitor.timeoutSeconds, 10);
    assert.equal(monitor.orgId, orgId);
  });

  test("rejects unknown monitor types", async () => {
    const input: MonitorInput = {
      name: "Bad type",
      type: "invalid_type",
      target: "https://example.com",
    };

    await assert.rejects(
      async () => buildMonitor(input, orgId, "free"),
      (err: Error) => {
        assert.ok(err instanceof ValidationError);
        assert.match(err.message, /Unknown monitor type/i);
        return true;
      }
    );
  });

  test("requires target for non-heartbeat monitors", async () => {
    const input: MonitorInput = {
      name: "Empty target",
      type: "http",
      target: "",
    };

    await assert.rejects(
      async () => buildMonitor(input, orgId, "free"),
      (err: Error) => {
        assert.ok(err instanceof ValidationError);
        assert.match(err.message, /target is required/i);
        return true;
      }
    );
  });

  test("rejects private / loopback addresses as targets", async () => {
    const input: MonitorInput = {
      name: "Localhost probe",
      type: "http",
      target: "http://localhost:8080",
    };

    await assert.rejects(
      async () => buildMonitor(input, orgId, "free"),
      (err: Error) => {
        assert.ok(err instanceof ValidationError);
        assert.match(err.message, /internal hostname|not a public address/i);
        return true;
      }
    );
  });

  test("enforces minimum interval for free plan (300 seconds)", async () => {
    const input: MonitorInput = {
      name: "Frequent check",
      type: "http",
      target: "https://example.com",
      intervalSeconds: 30, // free plan minimum is 300
    };

    const monitor = await buildMonitor(input, orgId, "free");
    assert.equal(monitor.intervalSeconds, 300);
  });

  test("allows 60-second interval for solo or team plan", async () => {
    const input: MonitorInput = {
      name: "Frequent check solo",
      type: "http",
      target: "https://example.com",
      intervalSeconds: 60,
    };

    const monitor = await buildMonitor(input, orgId, "solo");
    assert.equal(monitor.intervalSeconds, 60);
  });

  test("builds heartbeat monitor with generated token", async () => {
    const input: MonitorInput = {
      name: "Cron Job Heartbeat",
      type: "heartbeat",
      heartbeatGraceSeconds: 300,
    };

    const monitor = await buildMonitor(input, orgId, "free");
    assert.equal(monitor.type, "heartbeat");
    assert.ok(monitor.heartbeatToken);
    assert.ok(monitor.heartbeatToken.length >= 16);
    assert.equal(monitor.heartbeatGraceSeconds, 300);
  });

  test("sanitizes headers by trimming keys and stripping hop-by-hop headers", async () => {
    const input: MonitorInput = {
      name: "Header test",
      type: "http",
      target: "https://example.com",
      requestHeaders: {
        "X-Custom-Auth": "Secret123",
        "Host": "spoofed.com",
        "Connection": "keep-alive",
      },
    };

    const monitor = await buildMonitor(input, orgId, "free");
    assert.equal(monitor.requestHeaders?.["X-Custom-Auth"], "Secret123");
    assert.equal(monitor.requestHeaders?.["Host"], undefined);
    assert.equal(monitor.requestHeaders?.["Connection"], undefined);
  });

  test("validates SSL monitor expiry warning days", async () => {
    const input: MonitorInput = {
      name: "SSL Check",
      type: "ssl",
      target: "example.com",
      sslExpiryWarningDays: 30,
    };

    const monitor = await buildMonitor(input, orgId, "free");
    assert.equal(monitor.type, "ssl");
    assert.equal(monitor.sslExpiryWarningDays, 30);
  });
});
