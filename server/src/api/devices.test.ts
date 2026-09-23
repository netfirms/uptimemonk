import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { deviceDocId, pickDuplicateFcmRows, pickSupersededFcmRows } from "./contacts.js";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { contactRoutes } from "./contacts.js";

/**
 * Duplicate push registrations.
 *
 * The app called `syncDeviceToken()` from two places at once on startup, so
 * two requests raced. The handler read for an existing token and inserted if it
 * found none — not atomic — so both requests found nothing and both created a
 * row. Every alert fans out over all deliverable contacts and does not dedupe,
 * so one device received two pushes per incident.
 *
 * The fix is a deterministic document id, which makes the second write an
 * overwrite of the same document rather than a second document.
 */
describe("device registration idempotency", () => {
  test("the same token in the same org always maps to one document id", () => {
    // This is what makes the write idempotent: two concurrent registrations
    // compute the same id and converge instead of duplicating.
    assert.equal(deviceDocId("org1", "token-abc"), deviceDocId("org1", "token-abc"));
  });

  test("the same token in two orgs maps to different ids", () => {
    // A token is not a person. Two orgs may legitimately see the same one, and
    // sharing an id would let one org's registration overwrite another's.
    assert.notEqual(deviceDocId("org1", "token-abc"), deviceDocId("org2", "token-abc"));
  });

  test("a different token maps to a different id", () => {
    assert.notEqual(deviceDocId("org1", "token-abc"), deviceDocId("org1", "token-xyz"));
  });

  test("the document id carries no token, and no slash", () => {
    // Firestore document ids may not contain "/", and a raw push token in the
    // path would surface in every console URL and error message.
    const id = deviceDocId("org1", "cXN-yT0:APA91b/slash+in+token");
    assert.ok(!id.includes("/"), "id must not contain a slash");
    assert.ok(!id.includes("APA91b"), "id must not leak the token");
    assert.match(id, /^fcm_[a-f0-9]{40}$/);
  });
});

describe("duplicate cleanup", () => {
  const row = (id: string, token: string, createdAt: number | null) => ({ id, token, createdAt });

  test("keeps the newest row per token and removes the rest", () => {
    const removed = pickDuplicateFcmRows([
      row("old", "tok-a", 1000),
      row("new", "tok-a", 2000),
      row("mid", "tok-a", 1500),
    ]);
    assert.deepEqual(removed.sort(), ["mid", "old"]);
  });

  test("distinct tokens are all kept", () => {
    const removed = pickDuplicateFcmRows([
      row("a", "tok-a", 1000),
      row("b", "tok-b", 1000),
    ]);
    assert.deepEqual(removed, []);
  });

  test("a row with no timestamp loses to one that has a date", () => {
    const removed = pickDuplicateFcmRows([
      row("undated", "tok-a", null),
      row("dated", "tok-a", 1),
    ]);
    assert.deepEqual(removed, ["undated"]);
  });

  test("the newest by timestamp wins regardless of order in the list", () => {
    const removed = pickDuplicateFcmRows([
      row("new", "tok-a", 5000),
      row("old", "tok-a", 1000),
    ]);
    assert.deepEqual(removed, ["old"]);
  });

  test("nothing to remove when there are no rows", () => {
    assert.deepEqual(pickDuplicateFcmRows([]), []);
  });
});

describe("retiring a device's rotated token", () => {
  const reg = (
    id: string,
    uid: string,
    platform: string,
    token: string,
    channel = "fcm"
  ) => ({ id, uid, platform, token, channel });

  test("an older token for the same device is retired", () => {
    const removed = pickSupersededFcmRows(
      [reg("old-iphone", "u1", "ios", "old-tok")],
      { id: "new", token: "new-tok", uid: "u1", platform: "ios" }
    );
    assert.deepEqual(removed, ["old-iphone"]);
  });

  test("the other platform's token is kept", () => {
    // The regression this guards: an account signed in on both an iPhone and
    // an Android. Registering on one must not unregister the other, or a
    // device the user still expects to be paged goes silent until it next
    // launches. Rotation replaces a token for a platform, never across them.
    const removed = pickSupersededFcmRows(
      [reg("android", "u1", "android", "android-tok")],
      { id: "iphone", token: "ios-tok", uid: "u1", platform: "ios" }
    );
    assert.deepEqual(removed, []);
  });

  test("another user's token is kept", () => {
    const removed = pickSupersededFcmRows(
      [reg("other", "u2", "ios", "their-tok")],
      { id: "new", token: "new-tok", uid: "u1", platform: "ios" }
    );
    assert.deepEqual(removed, []);
  });

  test("non-push contacts are never retired", () => {
    // An email or webhook contact is not a device and must survive a
    // re-registration untouched.
    const removed = pickSupersededFcmRows(
      [reg("mail", "u1", "ios", "old-tok", "email")],
      { id: "new", token: "new-tok", uid: "u1", platform: "ios" }
    );
    assert.deepEqual(removed, []);
  });

  test("the row being written is never retired, even if it already exists", () => {
    const removed = pickSupersededFcmRows(
      [reg("self", "u1", "ios", "new-tok")],
      { id: "self", token: "new-tok", uid: "u1", platform: "ios" }
    );
    assert.deepEqual(removed, []);
  });
});

/**
 * Where the token is allowed to travel.
 *
 * `DELETE /v1/devices/:token` answered 414 `FST_ERR_MAX_PARAM_LENGTH` for
 * every token this product has ever issued: Fastify's `maxParamLength`
 * defaults to 100 characters and an FCM registration token is around 163. So
 * unregistering a device had never once succeeded — push rows accumulated on
 * every sign-out, and the thrown error surfaced during account deletion.
 *
 * Every test above this one passed throughout, because they all exercise pure
 * helpers and the failure was in routing. These inject the real route instead.
 *
 * No credentials are sent on purpose: `requireAuth` answers 401 before it
 * reaches Firebase, so 401 means "routed", and that is exactly the distinction
 * that was broken. A 414 here is the regression.
 */
describe("unregistering a device", () => {
  // Representative of what FCM actually issues: an APNs-backed token, well
  // past the 100-character routing limit.
  const realisticToken = "cXN-yT0kS0uHqRr2Vw9bZq:APA91b" + "H".repeat(134);

  // Each case gets its own instance: registering the real route is the whole
  // point, and a shared app would let one test's state reach another.
  const withApp = async <T>(fn: (app: FastifyInstance) => Promise<T>): Promise<T> => {
    const app = Fastify();
    await app.register(contactRoutes);
    await app.ready();
    try {
      return await fn(app);
    } finally {
      await app.close();
    }
  };

  test("a real token in the body routes through to authentication", async () => {
    // The contract the mobile client depends on.
    const res = await withApp((app) =>
      app.inject({
        method: "DELETE",
        url: "/v1/devices",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ token: realisticToken }),
      })
    );
    assert.notEqual(res.statusCode, 414, "a body-carried token must not hit the URI limit");
    assert.equal(res.statusCode, 401);
  });

  test("a real token in the path is still refused by routing", async () => {
    // Pinned so nobody moves the token back into the path believing it works:
    // it does not, and the failure is invisible from the pure helpers above.
    const res = await withApp((app) =>
      app.inject({
        method: "DELETE",
        url: `/v1/devices/${encodeURIComponent(realisticToken)}`,
      })
    );
    assert.equal(res.statusCode, 414);
  });

  test("the token is longer than the limit that broke it", () => {
    // If this ever stops being true the test above stops meaning anything.
    assert.ok(realisticToken.length > 100, `token was only ${realisticToken.length} chars`);
  });
});
