import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * The public status page, end to end against the Firestore emulator.
 *
 * The unit tests cover the projection, which is the security boundary. This
 * covers the part they cannot: slug resolution actually reading Firestore.
 * That gap mattered because a broken lookup is invisible from outside — an
 * unknown slug and a working-but-empty page both answer 404 by design, so a
 * status page that could never resolve would look exactly like one nobody has
 * published to yet.
 *
 * Lives under `server/` rather than the repo's `scripts/` so that `fastify`
 * and `firebase-admin` resolve: they are the server's dependencies, not the
 * root's.
 *
 * Run with: npm run test:status
 */

const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;
const ORG = "orgAAAAAAAAAAAAAAAAA";

if (!EMULATOR) {
  describe("public status page (integration)", { skip: "needs the Firestore emulator" }, () => {
    test("skipped", () => {});
  });
} else {
  process.env.GOOGLE_CLOUD_PROJECT ??= "demo-uptimemonk";
  process.env.UPTIMEMONK_DB = join(mkdtempSync(join(tmpdir(), "uptimemonk-sp-")), "t.db");

  // Initialise the admin app first: the server's `ensureApp()` reuses an
  // existing one, which is how this avoids needing real credentials.
  const { initializeApp } = await import("firebase-admin/app");
  initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
  const { getFirestore } = await import("firebase-admin/firestore");
  const fs = getFirestore();

  const dist = (p) => pathToFileURL(join(import.meta.dirname, "..", "dist", p)).href;
  const { openDb, closeDb } = await import(dist("db/index.js"));
  const repo = await import(dist("db/repo.js"));
  const { statusRoutes } = await import(dist("api/status.js"));
  const Fastify = (await import("fastify")).default;

  let app;

  before(async () => {
    openDb();
    repo.upsertMonitorConfig({
      id: "pub", orgId: ORG, name: "Public API", type: "http",
      target: "https://internal.example.com/_health", intervalSeconds: 60,
      timeoutSeconds: 10, confirmationThreshold: 2, regions: ["ap-southeast-1"],
      enabled: true, alertContactIds: [], status: "up", consecutiveFailures: 0,
      inMaintenance: false, dueAt: 0, createdAt: 0, updatedAt: 0,
      publicOnStatusPage: true,
    });
    // Uptime is worker-owned state, and `upsertMonitorConfig` excludes those
    // columns on purpose so a config sync cannot reset them. Seeding it
    // through the config path silently does nothing.
    repo.setUptimes("pub", 100, 99.99, 99.95);
    repo.upsertMonitorConfig({
      id: "priv", orgId: ORG, name: "Internal billing", type: "http",
      target: "https://billing.internal", intervalSeconds: 60, timeoutSeconds: 10,
      confirmationThreshold: 2, regions: ["ap-southeast-1"], enabled: true,
      alertContactIds: [], status: "down", consecutiveFailures: 3,
      inMaintenance: false, dueAt: 0, createdAt: 0, updatedAt: 0,
      publicOnStatusPage: false,
    });

    await fs.collection("orgs").doc(ORG).set({ name: "m.taweechai", plan: "free" });
    await fs.collection("statusPages").doc("sp1").set({
      orgId: ORG, slug: "acme-status", published: true,
      title: "Acme Services", description: "How we are doing.",
    });
    await fs.collection("statusPages").doc("sp2").set({
      orgId: ORG, slug: "draft-status", published: false, title: "Draft",
    });

    app = Fastify();
    await app.register(statusRoutes);
    await app.ready();
  });

  after(async () => {
    await app?.close();
    closeDb();
    rmSync(process.env.UPTIMEMONK_DB, { recursive: true, force: true });
  });

  const get = (slug) => app.inject({ method: "GET", url: `/v1/status/${slug}` });

  describe("public status page (integration)", () => {
    test("an org id resolves to that org's page", async () => {
      const res = await get(ORG);
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.deepEqual(body.monitors.map((m) => m.name), ["Public API"]);
      assert.equal(body.monitors[0].uptime30d, 99.95);
    });

    test("the org id fallback does not publish the org's name", async () => {
      // It is derived from the owner's email address.
      const body = (await get(ORG)).json();
      assert.equal(body.title, "Service status");
      assert.ok(!JSON.stringify(body).includes("m.taweechai"));
    });

    test("a published custom slug resolves, with its own title", async () => {
      const body = (await get("acme-status")).json();
      assert.equal(body.title, "Acme Services");
      assert.equal(body.description, "How we are doing.");
      assert.deepEqual(body.monitors.map((m) => m.name), ["Public API"]);
    });

    test("an unpublished page is not reachable", async () => {
      assert.equal((await get("draft-status")).statusCode, 404);
    });

    test("a short customer-chosen slug resolves", async () => {
    // Slugs may be three characters; the resolver's shape check used to
    // require six and made those silently unreachable.
    await fs.collection("statusPages").doc("sp3").set({
      orgId: ORG, slug: "ops", published: true, title: "Ops",
    });
    const res = await get("ops");
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().title, "Ops");
  });

  test("an unknown slug is a plain 404, with no hint that others exist", async () => {
      const res = await get("nosuchpagehere");
      assert.equal(res.statusCode, 404);
      assert.deepEqual(res.json(), { error: "No status page here" });
    });

    test("a response is cacheable, so an incident does not melt the box", async () => {
      const res = await get("acme-status");
      assert.match(res.headers["cache-control"], /max-age=60/);
    });
  });
}
