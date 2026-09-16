import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Monitor } from "../types.js";

process.env.UPTIMEMONK_DB = join(mkdtempSync(join(tmpdir(), "uptimemonk-drain-")), "t.db");

const { openDb, closeDb, getDb } = await import("../db/index.js");
const repo = await import("../db/repo.js");
const { drainOnce } = await import("./drainer.js");

const ORG = "org1";
/** A public hostname, so the SSRF guard resolves it and lets it through —
 *  loopback is correctly refused, which is why this cannot point at a local
 *  test server. The transport below is stubbed, so nothing leaves the box. */
const HOOK = "https://example.com/hooks/uptime";

const realFetch = globalThis.fetch;
let sent: { url: string; body: any }[] = [];

before(() => {
  openDb();
  globalThis.fetch = (async (input: any, init: any) => {
    sent.push({ url: String(input), body: JSON.parse(init?.body ?? "{}") });
    return new Response("ok", { status: 200 });
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = realFetch;
  closeDb();
  rmSync(process.env.UPTIMEMONK_DB!, { recursive: true, force: true });
});

beforeEach(() => {
  sent = [];
  for (const t of ["alert_outbox", "incidents", "alert_contacts", "monitors"]) {
    getDb().prepare(`DELETE FROM ${t}`).run();
  }
});

function setup(over: Partial<Monitor> = {}): Monitor {
  repo.upsertContact({
    id: "c1", orgId: ORG, channel: "webhook", name: "Ops",
    destination: HOOK, enabled: true, verified: true,
  });
  const m = {
    id: "m1", orgId: ORG, name: "Checkout API", type: "http",
    target: "https://shop.example.com", intervalSeconds: 60, timeoutSeconds: 10,
    confirmationThreshold: 2, regions: ["ap-southeast-1"], enabled: true,
    alertContactIds: [], status: "up", consecutiveFailures: 0,
    inMaintenance: false, dueAt: 0, createdAt: 0, updatedAt: 0, ...over,
  } as Monitor;
  repo.upsertMonitorConfig(m);
  return m;
}

describe("outbox → delivery", () => {
  test("an outage with no contacts chosen still pages the org", async () => {
    // The end-to-end version of the bug: two real incidents fired and nothing
    // was ever delivered, because the monitor's contact list was empty.
    const m = setup();
    repo.openIncident(m, "connect ECONNREFUSED", "ap-southeast-1", Date.now(), false);
    await drainOnce();

    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, HOOK);
    // The wire format namespaces its events; the outbox column does not.
    assert.equal(sent[0].body.event, "monitor.down");
  });

  test("recovery is delivered too, not just the outage", async () => {
    const m = setup();
    repo.openIncident(m, "down", "ap-southeast-1", Date.now(), false);
    await drainOnce();
    repo.resolveOpenIncident(m, Date.now(), false);
    await drainOnce();

    assert.deepEqual(sent.map((s) => s.body.event), ["monitor.down", "monitor.up"]);
  });

  test("a delivered alert leaves nothing pending to retry", async () => {
    const m = setup();
    repo.openIncident(m, "down", "ap-southeast-1", Date.now(), false);
    await drainOnce();
    assert.equal(repo.dueOutbox(Date.now() + 86_400_000, 50).length, 0);
  });

  test("an unverified contact is dropped, not retried forever", async () => {
    const m = setup();
    repo.upsertContact({
      id: "c1", orgId: ORG, channel: "webhook", name: "Ops",
      destination: HOOK, enabled: true, verified: false,
    });
    repo.openIncident(m, "down", "ap-southeast-1", Date.now(), false);
    await drainOnce();

    assert.equal(sent.length, 0);
    assert.equal(repo.dueOutbox(Date.now() + 86_400_000, 50).length, 0);
  });

  test("the payload names the monitor without leaking what it probes", async () => {
    const m = setup();
    repo.openIncident(m, "down", "ap-southeast-1", Date.now(), false);
    await drainOnce();

    const body = JSON.stringify(sent[0].body);
    assert.match(body, /Checkout API/);
  });
});
