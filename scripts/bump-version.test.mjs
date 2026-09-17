import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { bumpPatch } from "./bump-version.mjs";

describe("version bumping", () => {
  test("increments standard semantic patch versions", () => {
    assert.equal(bumpPatch("0.5.1"), "0.5.2");
    assert.equal(bumpPatch("0.5.9"), "0.5.10");
    assert.equal(bumpPatch("1.0.0"), "1.0.1");
    assert.equal(bumpPatch("2.14.99"), "2.14.100");
  });

  test("preserves prerelease tags if present", () => {
    assert.equal(bumpPatch("1.0.0-beta.1"), "1.0.1-beta.1");
  });

  test("rejects non-semver strings", () => {
    assert.throws(() => bumpPatch("invalid"), /Invalid semver/);
    assert.throws(() => bumpPatch("v1.0"), /Invalid semver/);
  });
});
