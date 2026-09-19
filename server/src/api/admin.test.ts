import { test, describe } from "node:test";
import assert from "node:assert/strict";

/**
 * Who counts as a platform operator.
 *
 * The rule is small and the consequence is not: these routes expose every
 * account on the system. `requireOwner` could not be reused, because
 * `bootstrap` gives `role: "owner"` to everyone who signs up.
 */
const isAdmin = (allowed: string[], email?: string) =>
  Boolean(allowed.length && email && allowed.includes(email.toLowerCase()));

describe("admin access", () => {
  test("an allowlisted address is admitted", () => {
    assert.equal(isAdmin(["ops@example.com"], "ops@example.com"), true);
  });

  test("matching ignores case, because addresses do", () => {
    assert.equal(isAdmin(["ops@example.com"], "Ops@Example.com"), true);
  });

  test("an ordinary customer is refused", () => {
    // They hold role: "owner" — of their own workspace, which is not this.
    assert.equal(isAdmin(["ops@example.com"], "customer@example.com"), false);
  });

  test("an empty allowlist admits nobody", () => {
    // Fails closed. An unset variable must not open a view of every account.
    assert.equal(isAdmin([], "ops@example.com"), false);
    assert.equal(isAdmin([], undefined), false);
  });

  test("a token with no email is refused", () => {
    assert.equal(isAdmin(["ops@example.com"], undefined), false);
  });
});

/**
 * Saving the config document.
 *
 * The console renders secrets masked, so a naive save writes the bullets back
 * over the real key and silently breaks email or payments. And an open merge
 * would let anything that reaches this route put arbitrary fields into a
 * document the workers read.
 */
const KNOWN = new Set(["appUrl", "probeConcurrency", "mailgunApiKey", "stripeSecretKey"]);
const SECRETS = ["mailgunApiKey", "stripeSecretKey"];

function buildPatch(incoming: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  const ignored: string[] = [];
  for (const [k, v] of Object.entries(incoming)) {
    if (!KNOWN.has(k)) { ignored.push(k); continue; }
    if (SECRETS.includes(k) && typeof v === "string" && (v.includes("•") || v === "")) continue;
    patch[k] = v;
  }
  return { patch, ignored };
}

describe("saving system config", () => {
  test("an ordinary field is written", () => {
    assert.deepEqual(buildPatch({ appUrl: "https://x" }).patch, { appUrl: "https://x" });
  });

  test("a masked secret is left alone, not written back as bullets", () => {
    const { patch } = buildPatch({ mailgunApiKey: "e80b••••••••7550" });
    assert.deepEqual(patch, {}, "would have overwritten the real key with its mask");
  });

  test("a blank secret is left alone too", () => {
    // An operator clearing a field by accident must not silently disable email.
    assert.deepEqual(buildPatch({ stripeSecretKey: "" }).patch, {});
  });

  test("a genuinely new secret IS written", () => {
    const { patch } = buildPatch({ mailgunApiKey: "key-abcdef123456" });
    assert.deepEqual(patch, { mailgunApiKey: "key-abcdef123456" });
  });

  test("unknown keys are refused, not merged in", () => {
    const { patch, ignored } = buildPatch({ appUrl: "https://x", isAdmin: true, __proto__: {} });
    assert.deepEqual(patch, { appUrl: "https://x" });
    assert.ok(ignored.includes("isAdmin"));
  });
});

/**
 * Deleting an account.
 *
 * Irreversible and it stops other people's monitoring, so the guard around it
 * matters more than the delete itself.
 */
const { isProtectedAccount } = await import("./admin.js");

describe("who cannot be deleted", () => {
  const ADMINS = ["ops@uptimemonke.com", "second@uptimemonke.com"];

  test("an operator is shielded, including the one clicking", () => {
    // Deleting the last administrator empties the allowlist, and requireAdmin
    // fails closed on an empty list — there would be no way back in.
    assert.equal(isProtectedAccount("ops@uptimemonke.com", ADMINS), true);
    assert.equal(isProtectedAccount("second@uptimemonke.com", ADMINS), true);
  });

  test("matching ignores case, because addresses do", () => {
    assert.equal(isProtectedAccount("Ops@UptimeMonke.com", ADMINS), true);
    assert.equal(isProtectedAccount("ops@uptimemonke.com", ["OPS@UPTIMEMONKE.COM"]), true);
  });

  test("an ordinary customer is not shielded", () => {
    assert.equal(isProtectedAccount("customer@example.com", ADMINS), false);
  });

  test("an account with no address is not shielded by that alone", () => {
    // It is still deletable; the allowlist simply cannot match it.
    assert.equal(isProtectedAccount(null, ADMINS), false);
    assert.equal(isProtectedAccount(undefined, ADMINS), false);
  });

  test("an empty allowlist shields nobody", () => {
    assert.equal(isProtectedAccount("ops@uptimemonke.com", []), false);
  });
});
