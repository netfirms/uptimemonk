import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { checkHttp, describeNetworkError } from "./http.js";
import { checkTcp } from "./tcp.js";
import { checkDns } from "./dns.js";
import { checkSsl } from "./ssl.js";
import { runProbe } from "./index.js";
import type { Monitor, ProbeRegion } from "../types.js";

function makeMonitor(partial: Partial<Monitor> & { id: string; target: string; type: Monitor["type"] }): Monitor {
  return {
    name: "Test Monitor",
    orgId: "org-test",
    intervalSeconds: 60,
    timeoutSeconds: 5,
    confirmationThreshold: 2,
    regions: ["ap-southeast-1"],
    alertContactIds: [],
    enabled: true,
    status: "pending",
    inMaintenance: false,
    consecutiveFailures: 0,
    dueAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...partial,
  };
}

describe("Probe Checks Engine", () => {
  const region: ProbeRegion = "ap-southeast-1";

  describe("HTTP & Keyword Check", () => {
    test("describeNetworkError translates common error codes", () => {
      assert.equal(
        describeNetworkError({ cause: { code: "ECONNREFUSED" } }),
        "Connection refused"
      );
      assert.equal(
        describeNetworkError({ cause: { code: "ENOTFOUND" } }),
        "DNS lookup failed (host not found)"
      );
      assert.equal(
        describeNetworkError({ cause: { code: "CERT_HAS_EXPIRED" } }),
        "TLS certificate has expired"
      );
      assert.equal(
        describeNetworkError({ message: "Custom failure" }),
        "Custom failure"
      );
    });

    test("blocks SSRF target in checkHttp", async () => {
      const monitor = makeMonitor({
        id: "m-ssrf",
        type: "http",
        target: "http://127.0.0.1:8080",
      });

      const res = await checkHttp(monitor, region);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /private or link-local address|internal hostname/i);
    });

    test("blocks cloud metadata IP 169.254.169.254", async () => {
      const monitor = makeMonitor({
        id: "m-meta",
        type: "http",
        target: "http://169.254.169.254/latest/meta-data/",
      });

      const res = await checkHttp(monitor, region);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /private or link-local address|internal hostname/i);
    });

    test("handles keyword verification on public endpoint", async () => {
      const monitor = makeMonitor({
        id: "m-kw",
        type: "keyword",
        target: "https://example.com",
        keyword: "Example Domain",
        keywordInverted: false,
        timeoutSeconds: 10,
      });

      const res = await checkHttp(monitor, region);
      assert.equal(res.ok, true);
      assert.equal(res.statusCode, 200);
      assert.equal(res.error, undefined);
      assert.ok(res.responseTimeMs > 0);
    });

    test("detects missing keyword when expected", async () => {
      const monitor = makeMonitor({
        id: "m-kw-missing",
        type: "keyword",
        target: "https://example.com",
        keyword: "NonExistentKeywordShouldFail12345",
        keywordInverted: false,
        timeoutSeconds: 10,
      });

      const res = await checkHttp(monitor, region);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /not found/i);
    });

    test("handles inverted keyword check", async () => {
      const monitor = makeMonitor({
        id: "m-kw-inverted",
        type: "keyword",
        target: "https://example.com",
        keyword: "NonExistentKeywordShouldPass",
        keywordInverted: true,
        timeoutSeconds: 10,
      });

      const res = await checkHttp(monitor, region);
      assert.equal(res.ok, true);
      assert.equal(res.error, undefined);
    });
  });

  describe("TCP Check", () => {
    test("rejects private host target for TCP", async () => {
      const monitor = makeMonitor({
        id: "m-tcp-priv",
        type: "tcp",
        target: "10.0.0.1",
        port: 80,
      });

      const res = await checkTcp(monitor, region);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /private or link-local address|internal hostname/i);
    });

    test("successfully connects to public TCP service (1.1.1.1:53)", async () => {
      const monitor = makeMonitor({
        id: "m-tcp-pub",
        type: "tcp",
        target: "1.1.1.1",
        port: 53,
      });

      const res = await checkTcp(monitor, region);
      assert.equal(res.ok, true);
      assert.ok(res.responseTimeMs > 0);
    });
  });

  describe("DNS Check", () => {
    test("resolves public A record for example.com", async () => {
      const monitor = makeMonitor({
        id: "m-dns-a",
        type: "dns",
        target: "example.com",
        dnsRecordType: "A",
      });

      const res = await checkDns(monitor, region);
      assert.equal(res.ok, true);
      const values = (res.meta as { values?: string[] })?.values;
      assert.ok(values && values.length > 0);
    });

    test("fails when expected DNS value does not match", async () => {
      const monitor = makeMonitor({
        id: "m-dns-mismatch",
        type: "dns",
        target: "example.com",
        dnsRecordType: "A",
        dnsExpectedValue: "192.0.2.254",
      });

      const res = await checkDns(monitor, region);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /Expected A record to contain/i);
    });
  });

  describe("SSL Check", () => {
    test("rejects private target for SSL check", async () => {
      const monitor = makeMonitor({
        id: "m-ssl-priv",
        type: "ssl",
        target: "192.168.1.1",
      });

      const res = await checkSsl(monitor, region);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /private or link-local address|internal hostname/i);
    });

    test("successfully validates SSL certificate on public domain", async () => {
      const monitor = makeMonitor({
        id: "m-ssl-example",
        type: "ssl",
        target: "example.com",
        sslExpiryWarningDays: 7,
        timeoutSeconds: 10,
      });

      const res = await checkSsl(monitor, region);
      assert.equal(res.ok, true);
      assert.ok(typeof res.meta?.daysLeft === "number");
    });
  });

  describe("runProbe Dispatcher", () => {
    test("dispatches heartbeat monitors without throwing", async () => {
      const monitor = makeMonitor({
        id: "m-hb",
        type: "heartbeat",
        target: "",
      });

      const res = await runProbe(monitor, region);
      assert.equal(res.ok, true);
      assert.equal(res.responseTimeMs, 0);
    });

    test("handles unknown monitor types safely", async () => {
      const monitor = makeMonitor({
        id: "m-unknown",
        type: "unknown" as any,
        target: "https://example.com",
      });

      const res = await runProbe(monitor, region);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /Unsupported monitor type/i);
    });
  });
});
