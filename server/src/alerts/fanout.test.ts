import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AlertContact, Monitor } from "../types.js";

process.env.UPTIMEMONK_DB = join(mkdtempSync(join(tmpdir(), "uptimemonk-fanout-")), "t.db");

const { openDb, closeDb, getDb } = await import("../db/index.js");
const repo = await import("../db/repo.js");

const ORG = "org1";

before(() => openDb());
after(() => {
  closeDb();
  rmSync(process.env.UPTIMEMONK_DB!, { recursive: true, force: true });
});
beforeEach(() => {
  for (const t of ["alert_outbox", "incidents", "alert_contacts", "monitors"]) {
    getDb().prepare(`DELETE FROM ${t}`).run();
  }
});

function contact(over: Partial<AlertContact> & { id: string }): void {
  repo.upsertContact({
    orgId: ORG,
    channel: "email",
    name: over.id,
    destination: `${over.id}@example.com`,
    enabled: true,
    verified: true,
    ...over,
  } as AlertContact);
}

function monitor(over: Partial<Monitor> = {}): Monitor {
  const m = {
    id: "m1",
    orgId: ORG,
    name: "API",
    type: "http",
    target: "https://example.com",
    intervalSeconds: 60,
    timeoutSeconds: 10,
    confirmationThreshold: 2,
    regions: ["ap-southeast-1"],
    enabled: true,
    alertContactIds: [],
    status: "up",
    consecutiveFailures: 0,
    inMaintenance: false,
    dueAt: 0,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  } as Monitor;
  repo.upsertMonitorConfig(m);
  return m;
}

/** Who the outbox would actually page for this monitor going down. */
function paged(m: Monitor): string[] {
  repo.openIncident(m, "connect ECONNREFUSED", "ap-southeast-1", Date.now(), false);
  return (
    getDb().prepare("SELECT contact_id FROM alert_outbox").all() as any[]
  )
    .map((r) => r.contact_id)
    .sort();
}

describe("alert fan-out", () => {
  test("no configured contacts pages everyone verified in the org", () => {
    // The regression this feature exists for: every monitor was created with
    // an empty list, and two real incidents passed with nothing queued.
    contact({ id: "a" });
    contact({ id: "b" });
    assert.deepEqual(paged(monitor({ alertContactIds: [] })), ["a", "b"]);
  });

  test("an explicit list is honoured exactly", () => {
    contact({ id: "a" });
    contact({ id: "b" });
    assert.deepEqual(paged(monitor({ alertContactIds: ["b"] })), ["b"]);
  });

  test("unverified contacts are never paged by the default", () => {
    contact({ id: "a" });
    contact({ id: "unconfirmed", verified: false });
    assert.deepEqual(paged(monitor()), ["a"]);
  });

  test("disabled contacts are never paged by the default", () => {
    contact({ id: "a" });
    contact({ id: "off", enabled: false });
    assert.deepEqual(paged(monitor()), ["a"]);
  });

  test("another org's contacts are never paged", () => {
    contact({ id: "mine" });
    contact({ id: "theirs", orgId: "org2" });
    assert.deepEqual(paged(monitor()), ["mine"]);
  });

  test("muteAlerts silences a monitor deliberately", () => {
    contact({ id: "a" });
    assert.deepEqual(paged(monitor({ muteAlerts: true })), []);
  });

  test("mute wins over an explicit contact list", () => {
    contact({ id: "a" });
    assert.deepEqual(paged(monitor({ muteAlerts: true, alertContactIds: ["a"] })), []);
  });

  test("a maintenance window records the incident but pages no one", () => {
    contact({ id: "a" });
    const m = monitor();
    repo.openIncident(m, "down", "ap-southeast-1", Date.now(), true);
    assert.equal(
      (getDb().prepare("SELECT count(*) n FROM alert_outbox").get() as any).n,
      0
    );
    assert.equal(
      (getDb().prepare("SELECT count(*) n FROM incidents").get() as any).n,
      1
    );
  });

  test("two contact rows for one destination page only once", () => {
    // The device-registration race created two fcm rows with the same token.
    // Both are enabled and verified, so both used to queue an alert and the
    // device got two pushes for one outage. The destination is the identity
    // that matters for "was this person told"; it is the dedupe key.
    contact({ id: "device-a", channel: "fcm", destination: "same-token" });
    contact({ id: "device-b", channel: "fcm", destination: "same-token" });
    assert.deepEqual(paged(monitor()), ["device-a"]);
  });

  test("an explicit list naming both duplicates still pages both", () => {
    // An explicit list is a deliberate instruction, honoured exactly — the
    // dedupe only governs the "page everyone" default. If someone really did
    // name the same destination twice, that is their call, not a bug to paper
    // over silently.
    contact({ id: "device-a", channel: "fcm", destination: "same-token" });
    contact({ id: "device-b", channel: "fcm", destination: "same-token" });
    assert.deepEqual(
      paged(monitor({ alertContactIds: ["device-a", "device-b"] })),
      ["device-a", "device-b"]
    );
  });

  test("dedupe is per destination, not per channel", () => {
    // Different channels reaching the same address are still two destinations
    // to the person who configured them, and both are intended to fire.
    contact({ id: "mail", channel: "email", destination: "ops@example.com" });
    contact({ id: "hook", channel: "webhook", destination: "https://example.com/h" });
    assert.deepEqual(paged(monitor()), ["hook", "mail"]);
  });

  test("recovery is queued the same way as the outage", () => {
    contact({ id: "a" });
    const m = monitor();
    const id = repo.openIncident(m, "down", "ap-southeast-1", Date.now(), false);
    getDb().prepare("DELETE FROM alert_outbox").run();
    repo.resolveOpenIncident(m, Date.now(), false);
    const events = (
      getDb().prepare("SELECT event, contact_id FROM alert_outbox").all() as any[]
    ).map((r) => `${r.event}:${r.contact_id}`);
    assert.deepEqual(events, ["up:a"]);
    assert.ok(id);
  });
});
