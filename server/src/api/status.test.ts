import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Monitor } from "../types.js";

process.env.UPTIMEMONK_DB = join(mkdtempSync(join(tmpdir(), "uptimemonk-status-")), "t.db");

const { openDb, closeDb, getDb } = await import("../db/index.js");
const repo = await import("../db/repo.js");
const { buildPublicStatus, resolvePage, isPlausibleSlug } = await import("./status.js");

const ORG = "org1";

before(() => openDb());
after(() => {
  closeDb();
  rmSync(process.env.UPTIMEMONK_DB!, { recursive: true, force: true });
});
beforeEach(() => {
  for (const t of ["day_rollups", "monitors"]) getDb().prepare(`DELETE FROM ${t}`).run();
});

function seed(over: Partial<Monitor> & { id: string }): void {
  repo.upsertMonitorConfig({
    orgId: ORG,
    name: "Service",
    type: "http",
    target: "https://internal.example.com/_health?token=s3cret",
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
  } as Monitor);
}

describe("public status projection", () => {
  test("only monitors explicitly opted in are published", () => {
    seed({ id: "a", name: "Public API", publicOnStatusPage: true });
    seed({ id: "b", name: "Internal billing", publicOnStatusPage: false });
    seed({ id: "c", name: "Legacy monitor" }); // predates the flag

    const page = buildPublicStatus(ORG, "Acme");
    assert.deepEqual(page?.monitors.map((m) => m.name), ["Public API"]);
  });

  test("never exposes the probe target or any request detail", () => {
    seed({
      id: "a",
      publicOnStatusPage: true,
      keyword: "secret-canary",
      lastError: "connect ECONNREFUSED 10.0.0.5:8080",
    });

    const json = JSON.stringify(buildPublicStatus(ORG, "Acme"));
    for (const secret of ["internal.example.com", "s3cret", "secret-canary", "10.0.0.5"]) {
      assert.ok(!json.includes(secret), `leaked ${secret}`);
    }
  });

  test("a paused monitor reads as paused, not as its stale status", () => {
    seed({ id: "a", publicOnStatusPage: true, enabled: false, status: "down" });
    assert.equal(buildPublicStatus(ORG, "Acme")?.monitors[0].status, "paused");
  });

  test("an org with nothing opted in has no page at all", () => {
    seed({ id: "a", publicOnStatusPage: false });
    assert.equal(buildPublicStatus(ORG, "Acme"), null);
  });

  test("another org's monitors never appear", () => {
    seed({ id: "a", publicOnStatusPage: true, name: "Mine" });
    seed({ id: "b", publicOnStatusPage: true, name: "Theirs", orgId: "org2" });
    assert.deepEqual(buildPublicStatus(ORG, "Acme")?.monitors.map((m) => m.name), ["Mine"]);
  });

  test("history is oldest-first so bars render left to right", () => {
    seed({ id: "a", publicOnStatusPage: true });
    for (const day of ["20260901", "20260902", "20260903"]) {
      repo.writeDayRollup({
        monitorId: "a", orgId: ORG, day, up: 10, down: 0,
        avgMs: 100, uptimeRatio: 1, downtimeSeconds: 0,
      });
    }
    const buckets = buildPublicStatus(ORG, "Acme")!.monitors[0].buckets;
    assert.deepEqual(
      buckets.map((b) => new Date(b.t).toISOString().slice(0, 10)),
      ["2026-09-01", "2026-09-02", "2026-09-03"]
    );
  });
});

describe("slug resolution", () => {
  test("the org-id fallback publishes no title", () => {
    // The org's name is the local-part of the owner's email address.
    assert.deepEqual(resolvePage(null, true, ORG), { orgId: ORG });
  });

  test("a custom page carries its own title and description", () => {
    assert.deepEqual(
      resolvePage({ orgId: "o1", title: "Acme", description: "hi" }, false, "acme"),
      { orgId: "o1", title: "Acme", description: "hi" }
    );
  });

  test("a custom page with no orgId resolves to nothing", () => {
    assert.equal(resolvePage({ title: "Acme" }, true, "acme"), null);
  });

  test("an unknown slug resolves to nothing", () => {
    assert.equal(resolvePage(null, false, "nobody"), null);
  });

  test("slugs that could not be an org id are rejected before any lookup", () => {
    for (const bad of ["", "ab", "../../etc/passwd", "has space", "x".repeat(65)]) {
      assert.equal(isPlausibleSlug(bad), false, bad);
    }
    assert.equal(isPlausibleSlug(ORG.padEnd(8, "x")), true);
  });
});
