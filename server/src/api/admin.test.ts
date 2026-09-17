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
