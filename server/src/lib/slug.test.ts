import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { InvalidSlugError, normaliseOrgName, normaliseSlug, suggestSlug } from "./slug.js";

const rejects = (v: unknown) => assert.throws(() => normaliseSlug(v), InvalidSlugError);

describe("status page slugs", () => {
  test("accepts a plain readable name", () => {
    assert.equal(normaliseSlug("acme-status"), "acme-status");
    assert.equal(normaliseSlug("  ACME-Status  "), "acme-status");
  });

  test("rejects anything outside lowercase, digits and hyphens", () => {
    // Narrow on purpose: a page named in a script that reads as someone
    // else's brand is a phishing page we would be hosting.
    for (const bad of ["acme status", "acme_status", "acme.status", "ACME/status", "аcme"]) {
      rejects(bad);
    }
  });

  test("rejects leading, trailing and doubled hyphens", () => {
    for (const bad of ["-acme", "acme-", "ac--me"]) rejects(bad);
  });

  test("enforces a sane length", () => {
    rejects("ab");
    rejects("a".repeat(41));
    assert.equal(normaliseSlug("abc"), "abc");
  });

  test("refuses names that would collide with a route", () => {
    for (const bad of ["status", "api", "dashboard", "_next", "healthz"]) rejects(bad);
  });

  test("refuses names that speak for us", () => {
    for (const bad of ["uptimemonke", "official", "security", "abuse"]) rejects(bad);
  });

  test("refuses a string shaped like a workspace id", () => {
    // `/status/<orgId>` already resolves, so claiming an id-shaped slug
    // invites confusion about whose page it is.
    rejects("xb2ypshfvcb9vbtzjlnr");
  });

  test("an empty slug says what to do, not what went wrong", () => {
    assert.throws(() => normaliseSlug(""), /Choose an address/);
  });
});

describe("suggesting one from a workspace name", () => {
  test("turns a name into something claimable", () => {
    assert.equal(suggestSlug("Acme Corp"), "acme-corp");
    assert.equal(suggestSlug("  Acme   Corp!!  "), "acme-corp");
  });

  test("survives a round trip through validation", () => {
    for (const name of ["Acme Corp", "My Team 2026", "Örebro Systems"]) {
      const s = suggestSlug(name);
      if (s) assert.equal(normaliseSlug(s), s, name);
    }
  });

  test("gives nothing rather than something invalid", () => {
    // A name with no usable characters must not become a broken suggestion.
    assert.equal(suggestSlug("!!!"), "");
    assert.equal(suggestSlug("ab"), "");
  });
});

describe("workspace names", () => {
  test("collapses whitespace and trims", () => {
    assert.equal(normaliseOrgName("  Acme   Corp  "), "Acme Corp");
  });

  test("rejects empty and overlong", () => {
    assert.throws(() => normaliseOrgName("   "), InvalidSlugError);
    assert.throws(() => normaliseOrgName("x".repeat(61)), InvalidSlugError);
  });

  test("allows any script — a name is not a URL", () => {
    assert.equal(normaliseOrgName("ดิ ออร่า ปราณบุรี"), "ดิ ออร่า ปราณบุรี");
  });
});
