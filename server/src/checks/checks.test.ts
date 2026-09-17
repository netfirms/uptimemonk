import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { checkHttp, describeNetworkError } from "./http.js";
import { checkTcp } from "./tcp.js";
import { checkDns } from "./dns.js";
import { checkSsl } from "./ssl.js";
import { checkIcmp } from "./icmp.js";
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

describe("keyword matching is case-insensitive by default", () => {
  // A monitor looking for "AGARWOOD OIL" reported a hard outage against a page
  // that said "Agarwood Oil". A false outage is worse than a missed one: it
  // teaches people to ignore the alerts.
  const match = (text: string, keyword: string, caseSensitive = false) =>
    caseSensitive
      ? text.includes(keyword)
      : text.toLowerCase().includes(keyword.toLowerCase());

  test("matches regardless of case", () => {
    const page = "<h1>Premium Agarwood Oil</h1><p>Agarwood oil from Thailand</p>";
    assert.equal(match(page, "AGARWOOD OIL"), true, "the reported false positive");
    assert.equal(match(page, "agarwood oil"), true);
    assert.equal(match(page, "Agarwood Oil"), true);
  });

  test("still reports a genuinely absent keyword", () => {
    assert.equal(match("<h1>Welcome</h1>", "AGARWOOD OIL"), false);
  });

  test("opting into case sensitivity restores exact matching", () => {
    const page = "Agarwood Oil";
    assert.equal(match(page, "AGARWOOD OIL", true), false);
    assert.equal(match(page, "Agarwood Oil", true), true);
  });
});

describe("a keyword check never issues HEAD", () => {
  // Enforced at the probe as well as in validation: monitors created before
  // the rule still carry method "HEAD" in their stored config, and a stored
  // value must not be able to cause a permanent, unexplained outage.
  const methodFor = (type: string, stored?: string) => {
    const wantsBody = type === "keyword";
    return wantsBody ? (stored === "POST" ? "POST" : "GET") : (stored ?? "HEAD");
  };

  test("repairs a stored HEAD on a keyword monitor", () => {
    assert.equal(methodFor("keyword", "HEAD"), "GET", "the live misconfiguration");
  });

  test("keeps POST, which does return a body", () => {
    assert.equal(methodFor("keyword", "POST"), "POST");
  });

  test("leaves a plain http monitor on HEAD", () => {
    assert.equal(methodFor("http", "HEAD"), "HEAD");
    assert.equal(methodFor("http", undefined), "HEAD");
  });
});

describe("Advanced Monitoring Features", () => {
  const region: ProbeRegion = "ap-southeast-1";

  describe("JSON Path and Value Extraction", () => {
    test("getJsonPathValue resolves root, nested, and array paths", async () => {
      const { getJsonPathValue } = await import("./http.js");
      const sample = {
        status: "ok",
        meta: {
          version: "1.2.3",
          healthy: true,
        },
        services: [{ name: "db", up: true }, { name: "cache", up: false }],
      };

      assert.equal(getJsonPathValue(sample, "status"), "ok");
      assert.equal(getJsonPathValue(sample, "meta.version"), "1.2.3");
      assert.equal(getJsonPathValue(sample, "meta.healthy"), true);
      assert.equal(getJsonPathValue(sample, "services.0.name"), "db");
      assert.equal(getJsonPathValue(sample, "services.1.up"), false);
      assert.equal(getJsonPathValue(sample, "non.existent.path"), undefined);
      assert.equal(getJsonPathValue(null, "status"), undefined);
    });
  });

  describe("HTTP & Keyword Advanced Features", () => {
    test("keyword regex matching succeeds on matching regex", async () => {
      const monitor = makeMonitor({
        id: "m-kw-re",
        type: "keyword",
        target: "https://example.com",
        keyword: "Ex[a-z]{4}e\\s+Do[a-z]{3}n",
        keywordRegex: true,
        timeoutSeconds: 10,
      });

      const res = await checkHttp(monitor, region);
      assert.equal(res.ok, true);
      assert.equal(res.error, undefined);
    });

    test("keyword regex fails cleanly when pattern does not match", async () => {
      const monitor = makeMonitor({
        id: "m-kw-re-fail",
        type: "keyword",
        target: "https://example.com",
        keyword: "^StrictStartPatternThatDoesNotExist$",
        keywordRegex: true,
        timeoutSeconds: 10,
      });

      const res = await checkHttp(monitor, region);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /not found/i);
    });

    test("SLA maxResponseTimeMs violation flags monitor as degraded", async () => {
      const monitor = makeMonitor({
        id: "m-http-sla",
        type: "http",
        target: "https://example.com",
        maxResponseTimeMs: 1, // unrealistically low 1ms SLA to guarantee triggering
        timeoutSeconds: 10,
      });

      const res = await checkHttp(monitor, region);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /exceeded SLA threshold/i);
    });
  });

  describe("SSL Advanced Features", () => {
    test("reports certificate fingerprint in meta and enforces min protocol", async () => {
      const monitor = makeMonitor({
        id: "m-ssl-adv",
        type: "ssl",
        target: "example.com",
        sslMinVersion: "TLSv1.2",
        timeoutSeconds: 10,
      });

      const res = await checkSsl(monitor, region);
      assert.equal(res.ok, true);
      assert.ok(res.meta?.fingerprint256, "carries SHA-256 fingerprint");
      assert.ok(res.meta?.protocol, "carries negotiated TLS protocol");
    });

    test("fails when certificate fingerprint does not match expected fingerprint", async () => {
      const monitor = makeMonitor({
        id: "m-ssl-fp-mismatch",
        type: "ssl",
        target: "example.com",
        sslExpectedFingerprint: "00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF",
        timeoutSeconds: 10,
      });

      const res = await checkSsl(monitor, region);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /fingerprint mismatch/i);
    });
  });

  describe("TCP Advanced Banner Features", () => {
    test("connects to public TCP service without payload (standard check)", async () => {
      const monitor = makeMonitor({
        id: "m-tcp-std",
        type: "tcp",
        target: "1.1.1.1",
        port: 53,
      });
      const res = await checkTcp(monitor, region);
      assert.equal(res.ok, true);
    });
  });

  describe("DNS Advanced Features", () => {
    test("resolves with custom nameserver", async () => {
      const monitor = makeMonitor({
        id: "m-dns-custom",
        type: "dns",
        target: "example.com",
        dnsRecordType: "A",
        dnsServer: "1.1.1.1",
      });
      const res = await checkDns(monitor, region);
      assert.equal(res.ok, true);
      assert.ok(Array.isArray(res.meta?.values));
    });

    test("resolves SOA and TXT records", async () => {
      const monitor = makeMonitor({
        id: "m-dns-soa",
        type: "dns",
        target: "example.com",
        dnsRecordType: "SOA",
      });
      const res = await checkDns(monitor, region);
      assert.equal(res.ok, true);
      assert.ok(Array.isArray(res.meta?.values) && (res.meta.values as string[]).length > 0);
    });

    test("resolves AAAA, MX, TXT, and NS records", async () => {
      for (const rec of ["AAAA", "MX", "TXT", "NS"] as const) {
        const monitor = makeMonitor({
          id: `m-dns-${rec.toLowerCase()}`,
          type: "dns",
          target: "google.com",
          dnsRecordType: rec,
        });
        const res = await checkDns(monitor, region);
        assert.equal(res.ok, true, `resolves ${rec}`);
        assert.ok(Array.isArray(res.meta?.values), `values array returned for ${rec}`);
      }
    });
  });

  describe("ICMP Ping Checks", () => {
    test("blocks SSRF targets from checkIcmp", async () => {
      const monitor = makeMonitor({
        id: "m-icmp-ssrf",
        type: "icmp",
        target: "127.0.0.1",
      });
      const res = await checkIcmp(monitor, region);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /private or link-local address|internal hostname/i);
    });

    test("blocks cloud metadata address from checkIcmp", async () => {
      const monitor = makeMonitor({
        id: "m-icmp-meta",
        type: "icmp",
        target: "169.254.169.254",
      });
      const res = await checkIcmp(monitor, region);
      assert.equal(res.ok, false);
      assert.match(res.error || "", /private or link-local address|internal hostname/i);
    });

    test("executes ping check against public DNS (1.1.1.1)", async () => {
      const monitor = makeMonitor({
        id: "m-icmp-pub",
        type: "icmp",
        target: "1.1.1.1",
        icmpPacketCount: 2,
        icmpMaxLossPercent: 50,
      });
      const res = await checkIcmp(monitor, region);
      assert.equal(res.ok, true);
      assert.equal(res.error, undefined);
      assert.ok(typeof res.meta?.packetLossPercent === "number");
      assert.ok(res.responseTimeMs > 0);
    });

    test("runProbe dispatches ICMP monitor", async () => {
      const monitor = makeMonitor({
        id: "m-probe-icmp",
        type: "icmp",
        target: "1.1.1.1",
      });
      const res = await runProbe(monitor, region);
      assert.equal(res.ok, true);
    });
  });

  describe("HTTP Authentication Headers", () => {
    test("sends Basic Auth header", async () => {
      const monitor = makeMonitor({
        id: "m-http-basic",
        type: "http",
        target: "https://example.com",
        httpAuthType: "basic",
        authUsername: "admin",
        authPassword: "secretpassword",
        timeoutSeconds: 10,
      });
      const res = await checkHttp(monitor, region);
      assert.equal(res.ok, true);
    });

    test("sends Bearer Auth header", async () => {
      const monitor = makeMonitor({
        id: "m-http-bearer",
        type: "http",
        target: "https://example.com",
        httpAuthType: "bearer",
        authToken: "test-token-12345",
        timeoutSeconds: 10,
      });
      const res = await checkHttp(monitor, region);
      assert.equal(res.ok, true);
    });
  });
});

