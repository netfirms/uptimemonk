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
    assert.equal(monitor.intervalSeconds, 300, "an explicit 300 is kept as-is");
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

  test("a free workspace is held to the free floor", async () => {
    // Frequency is tiered again: free workspaces are held to a slower floor
    // than donors. The budget still applies on top — the floor says what you
    // may ask for, the budget says what you can afford.
    await assert.rejects(
      async () =>
        buildMonitor(
          { name: "Frequent check", type: "http", target: "https://example.com", intervalSeconds: 30 },
          orgId,
          "free"
        ),
      /free workspace is 60 seconds/
    );
  });

  test("the refusal says how to lift the floor, not just that it exists", async () => {
    // A limit with no way out reads as a broken feature.
    await assert.rejects(
      async () =>
        buildMonitor(
          { name: "Frequent check", type: "http", target: "https://example.com", intervalSeconds: 10 },
          orgId,
          "free"
        ),
      /Supporting the project lowers it to 5 seconds/
    );
  });

  test("a donor may ask for the fast floor", async () => {
    const monitor = await buildMonitor(
      { name: "Frequent check", type: "http", target: "https://example.com", intervalSeconds: 5 },
      orgId,
      "free",
      undefined,
      { credits: 500_000, donationUsdMonthly: 3, lastDonationAt: Date.now() } as never
    );
    assert.equal(monitor.intervalSeconds, 5);
  });

  test("nobody goes below the scheduler's own floor, donor included", async () => {
    await assert.rejects(
      async () =>
        buildMonitor(
          { name: "Too fast", type: "http", target: "https://example.com", intervalSeconds: 1 },
          orgId,
          "free",
          undefined,
          { credits: 500_000, donationUsdMonthly: 3, lastDonationAt: Date.now() } as never
        ),
      /fastest interval this fleet supports is 5 seconds/
    );
  });

  test("asking below the floor is refused, not quietly rounded up", async () => {
    // A silently raised interval means the monitor runs at a rate nobody
    // chose, and the customer has no way to tell.
    await assert.rejects(
      async () =>
        buildMonitor(
          { name: "x", type: "http", target: "https://example.com", intervalSeconds: 45 },
          orgId,
          "free"
        ),
      (err: Error) => err.name === "ValidationError" || /60 seconds/.test(err.message)
    );
  });

  test("allows 60-second interval for solo or team plan", async () => {
    const input: MonitorInput = {
      name: "Frequent check solo",
      type: "http",
      target: "https://example.com",
      intervalSeconds: 60,
    };

    const monitor = await buildMonitor(input, orgId, "solo");
    assert.equal(monitor.intervalSeconds, 60, "a paid plan keeps whatever it asks for above 5s");
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

/**
 * The edit path. `buildMonitor` takes an `existing` monitor so PATCH can carry
 * forward whatever the request did not mention — the behaviour the "edit
 * instead of delete and recreate" feature depends on.
 */
describe("editing an existing monitor", () => {
  const orgId = "org-test-123";

  const existing = {
    id: "m1",
    orgId,
    name: "Marketing site",
    type: "http" as const,
    target: "https://example.com",
    intervalSeconds: 300,
    timeoutSeconds: 10,
    confirmationThreshold: 2,
    regions: ["ap-southeast-1" as const],
    enabled: true,
    alertContactIds: ["c1"],
    status: "up" as const,
    consecutiveFailures: 0,
    inMaintenance: false,
    dueAt: 0,
    createdAt: 0,
    updatedAt: 0,
  };

  test("a partial edit keeps every field it did not mention", async () => {
    // This is the whole point of editing rather than recreating: renaming a
    // monitor must not silently reset its interval or drop its alert contacts.
    const monitor = await buildMonitor({ name: "Renamed" }, orgId, "team", existing as never);

    assert.equal(monitor.name, "Renamed");
    assert.equal(monitor.target, "https://example.com", "target preserved");
    assert.equal(monitor.intervalSeconds, 300, "interval preserved");
    assert.deepEqual(monitor.alertContactIds, ["c1"], "alert contacts preserved");
    assert.equal(monitor.confirmationThreshold, 2, "threshold preserved");
  });

  test("the SSRF guard still applies when editing the target", async () => {
    // The guard lives only in this function, so a write path that skipped it
    // would reopen the metadata-server hole. Editing is a write path.
    await assert.rejects(
      () =>
        buildMonitor(
          { target: "http://169.254.169.254/computeMetadata/v1/" },
          orgId,
          "team",
          existing as never
        ),
      ValidationError,
      "link-local target must be rejected on edit, not just on create"
    );

    await assert.rejects(
      () => buildMonitor({ target: "http://localhost:8080/" }, orgId, "team", existing as never),
      ValidationError
    );
  });

  test("the floor still holds when editing the interval", async () => {
    // Editing must not be a way around it. The budget gate is enforced by the
    // route, not here — see assertFitsBudget.
    await assert.rejects(
      async () => buildMonitor({ intervalSeconds: 1 }, orgId, "free", existing as never),
      /60 seconds/
    );
  });

  test("a heartbeat monitor keeps its token across an edit", async () => {
    // Regenerating it would silently break the customer's cron URL — their job
    // would keep posting to a dead endpoint and the monitor would go down for
    // a reason nobody could see.
    const heartbeat = {
      ...existing,
      type: "heartbeat" as const,
      target: "",
      heartbeatToken: "original-token-value",
      heartbeatGraceSeconds: 600,
    };

    const monitor = await buildMonitor({ name: "Nightly backup" }, orgId, "team", heartbeat as never);
    assert.equal(monitor.heartbeatToken, "original-token-value");
  });

  test("request headers are re-sanitised on edit", async () => {
    const monitor = await buildMonitor(
      { requestHeaders: { "Metadata-Flavor": "Google", "X-Trace": "keep" } },
      orgId,
      "team",
      existing as never
    );
    assert.deepEqual(monitor.requestHeaders, { "X-Trace": "keep" });
  });
});

/**
 * Firestore rejects `undefined` values outright, and it only surfaces at
 * write time — the type checker is perfectly happy. This broke every create
 * and edit in production with a generic 500.
 */
describe("no undefined values reach Firestore", () => {
  const orgId = "org-test-123";

  const cases: Array<[string, MonitorInput]> = [
    ["http", { type: "http", target: "https://example.com" }],
    ["keyword", { type: "keyword", target: "https://example.com", keyword: "ok" }],
    ["tcp", { type: "tcp", target: "example.com", port: 443 }],
    ["dns", { type: "dns", target: "example.com" }],
    ["ssl", { type: "ssl", target: "example.com" }],
    ["icmp", { type: "icmp", target: "example.com" }],
    ["heartbeat", { type: "heartbeat" }],
  ];

  for (const [label, input] of cases) {
    test(`a minimal ${label} monitor carries no undefined field`, async () => {
      const monitor = await buildMonitor(input, orgId, "team");
      const undef = Object.entries(monitor)
        .filter(([, v]) => v === undefined)
        .map(([k]) => k);
      assert.deepEqual(undef, [], `undefined fields would be rejected: ${undef.join(", ")}`);
    });
  }

  test("an edit that clears nothing carries no undefined field either", async () => {
    const existing = {
      id: "m1",
      orgId,
      name: "Site",
      type: "http" as const,
      target: "https://example.com",
      intervalSeconds: 300,
      timeoutSeconds: 10,
      confirmationThreshold: 2,
      regions: ["ap-southeast-1" as const],
      enabled: true,
      alertContactIds: [],
      status: "up" as const,
      consecutiveFailures: 0,
      inMaintenance: false,
      dueAt: 0,
      createdAt: 0,
      updatedAt: 0,
    };
    const monitor = await buildMonitor({ name: "Renamed" }, orgId, "team", existing as never);
    const undef = Object.entries(monitor).filter(([, v]) => v === undefined).map(([k]) => k);
    assert.deepEqual(undef, [], `undefined fields: ${undef.join(", ")}`);
  });
});

/**
 * A HEAD response carries no body, so a keyword monitor using HEAD can never
 * match — it reports a permanent, unexplained outage. The default was HEAD for
 * every HTTP-family monitor, which meant every keyword monitor ever created
 * through the API was broken from the start.
 */
describe("keyword monitors must request a body", () => {
  const orgId = "org-test-123";

  test("a new keyword monitor defaults to GET, not HEAD", async () => {
    const m = await buildMonitor(
      { type: "keyword", target: "https://example.com", keyword: "hello" },
      orgId,
      "team"
    );
    assert.equal(m.method, "GET");
  });

  test("a plain http monitor still defaults to HEAD", async () => {
    // HEAD is the right default there: cheaper, and no body is needed.
    const m = await buildMonitor({ type: "http", target: "https://example.com" }, orgId, "team");
    assert.equal(m.method, "HEAD");
  });

  test("a stored HEAD is repaired rather than carried forward", async () => {
    // The existing broken monitors have method HEAD in their config. Editing
    // one must fix it, because the form never offered the choice.
    const legacy = {
      id: "m1", orgId, name: "Site", type: "keyword" as const,
      target: "https://example.com", keyword: "hello", method: "HEAD" as const,
      intervalSeconds: 300, timeoutSeconds: 10, confirmationThreshold: 2,
      regions: ["ap-southeast-1" as const], enabled: true, alertContactIds: [],
      status: "down" as const, consecutiveFailures: 3, inMaintenance: false,
      dueAt: 0, createdAt: 0, updatedAt: 0,
    };
    const m = await buildMonitor({ name: "Renamed" }, orgId, "team", legacy as never);
    assert.equal(m.method, "GET", "editing repairs the impossible configuration");
  });

  test("POST is preserved — it also returns a body", async () => {
    const m = await buildMonitor(
      { type: "keyword", target: "https://example.com", keyword: "hi", method: "POST" },
      orgId,
      "team"
    );
    assert.equal(m.method, "POST");
  });

  test("explicitly asking for HEAD with a keyword is rejected, not silently changed", async () => {
    await assert.rejects(
      () =>
        buildMonitor(
          { type: "keyword", target: "https://example.com", keyword: "hi", method: "HEAD" },
          orgId,
          "team"
        ),
      ValidationError
    );
  });
});

/**
 * Interval is no longer a pricing lever.
 *
 * The floors were 300s/60s when checks ran on Firebase and every check cost
 * writes; then 60s free / 5s paid on a flat-rate box. Under donation credits
 * the interval is bought out of the daily check budget instead, so the only
 * floor left is the scheduler's own. `credits.test.ts` covers what the budget
 * refuses.
 */
describe("interval floors", () => {
  const orgId = "org-test-123";

  test("the floor follows standing, not the legacy plan name", async () => {
    // A grandfathered plan does not buy a faster floor; donating does.
    const donor = { credits: 500_000, donationUsdMonthly: 3, lastDonationAt: Date.now() } as never;
    for (const plan of ["free", "solo", "team", "scale"] as const) {
      await assert.rejects(
        async () =>
          buildMonitor(
            { type: "http", target: "https://example.com", intervalSeconds: 5 },
            orgId,
            plan
          ),
        /60 seconds/,
        `${plan} without credit`
      );

      const m = await buildMonitor(
        { type: "http", target: "https://example.com", intervalSeconds: 5 },
        orgId,
        plan,
        undefined,
        donor
      );
      assert.equal(m.intervalSeconds, 5, `${plan} with credit`);
    }
  });

  test("free can still choose a slower interval", async () => {
    const m = await buildMonitor(
      { type: "http", target: "https://example.com", intervalSeconds: 900 },
      orgId,
      "free"
    );
    assert.equal(m.intervalSeconds, 900);
  });

  test("nothing goes below five seconds, on any standing", async () => {
    // The scheduler floor is not policy — no standing and no operator setting
    // gets under it, so it is refused rather than clamped.
    for (const credit of [
      undefined,
      { credits: 500_000, donationUsdMonthly: 3, lastDonationAt: Date.now() } as never,
    ]) {
      await assert.rejects(
        async () =>
          buildMonitor(
            { type: "http", target: "https://example.com", intervalSeconds: 1 },
            orgId,
            "scale",
            undefined,
            credit
          ),
        /seconds/,
        credit ? "donor" : "free"
      );
    }
  });
});

describe("Advanced Monitor Configuration Validation", () => {
  const orgId = "org-test-123";

  test("rejects invalid regex pattern in keyword monitor", async () => {
    await assert.rejects(
      async () =>
        buildMonitor(
          {
            type: "keyword",
            target: "https://example.com",
            keyword: "[invalid(regex+",
            keywordRegex: true,
          },
          orgId,
          "free"
        ),
      (err: Error) => {
        assert.ok(err instanceof ValidationError);
        assert.match(err.message, /Invalid regular expression/i);
        return true;
      }
    );
  });

  test("stores valid regex and jsonPath options on keyword monitor", async () => {
    const m = await buildMonitor(
      {
        type: "keyword",
        target: "https://example.com",
        keyword: "ok[0-9]+",
        keywordRegex: true,
        jsonPath: "  data.status  ",
        jsonPathExpected: "active",
      },
      orgId,
      "free"
    );
    assert.equal(m.keywordRegex, true);
    assert.equal(m.jsonPath, "data.status");
    assert.equal(m.jsonPathExpected, "active");
  });

  test("validates and clamps maxResponseTimeMs on http monitor", async () => {
    const mTooLow = await buildMonitor(
      { type: "http", target: "https://example.com", maxResponseTimeMs: 10 },
      orgId,
      "free"
    );
    assert.equal(mTooLow.maxResponseTimeMs, 50, "clamped to min 50ms");

    const mTooHigh = await buildMonitor(
      { type: "http", target: "https://example.com", maxResponseTimeMs: 120000 },
      orgId,
      "free"
    );
    assert.equal(mTooHigh.maxResponseTimeMs, 60000, "clamped to max 60000ms");
  });

  test("rejects unsupported DNS record types", async () => {
    await assert.rejects(
      async () =>
        buildMonitor(
          { type: "dns", target: "example.com", dnsRecordType: "INVALID_REC" },
          orgId,
          "free"
        ),
      (err: Error) => {
        assert.ok(err instanceof ValidationError);
        assert.match(err.message, /Unsupported DNS record type/i);
        return true;
      }
    );
  });

  test("rejects private host as custom DNS server", async () => {
    await assert.rejects(
      async () =>
        buildMonitor(
          { type: "dns", target: "example.com", dnsServer: "192.168.1.1" },
          orgId,
          "free"
        ),
      (err: Error) => {
        assert.ok(err instanceof ValidationError);
        assert.match(err.message, /internal hostname|private or link-local/i);
        return true;
      }
    );
  });

  test("accepts public custom DNS server and validates record types", async () => {
    const m = await buildMonitor(
      { type: "dns", target: "example.com", dnsRecordType: "SOA", dnsServer: "1.1.1.1" },
      orgId,
      "free"
    );
    assert.equal(m.dnsRecordType, "SOA");
    assert.equal(m.dnsServer, "1.1.1.1");
  });

  test("clamps ICMP packet count and max loss percentage", async () => {
    const mClamped = await buildMonitor(
      { type: "icmp", target: "1.1.1.1", icmpPacketCount: 10, icmpMaxLossPercent: 150 },
      orgId,
      "free"
    );
    assert.equal(mClamped.icmpPacketCount, 5, "clamped to max 5 packets");
    assert.equal(mClamped.icmpMaxLossPercent, 100, "clamped to max 100%");

    const mMin = await buildMonitor(
      { type: "icmp", target: "1.1.1.1", icmpPacketCount: 0, icmpMaxLossPercent: 0 },
      orgId,
      "free"
    );
    assert.equal(mMin.icmpPacketCount, 1, "clamped to min 1 packet");
    assert.equal(mMin.icmpMaxLossPercent, 1, "clamped to min 1%");
  });

  test("validates SSL min version and normalizes expected fingerprint", async () => {
    const m = await buildMonitor(
      {
        type: "ssl",
        target: "example.com",
        sslExpectedFingerprint: "  aa:bb:cc:dd  ",
        sslMinVersion: "TLSv1.3",
      },
      orgId,
      "free"
    );
    assert.equal(m.sslExpectedFingerprint, "AA:BB:CC:DD");
    assert.equal(m.sslMinVersion, "TLSv1.3");
  });

  test("truncates TCP custom payload and expected response to 1024 chars", async () => {
    const longStr = "x".repeat(2000);
    const m = await buildMonitor(
      {
        type: "tcp",
        target: "1.1.1.1",
        port: 80,
        tcpPayload: longStr,
        tcpExpectedResponse: longStr,
      },
      orgId,
      "free"
    );
    assert.equal(m.tcpPayload?.length, 1024);
    assert.equal(m.tcpExpectedResponse?.length, 1024);
  });
});

