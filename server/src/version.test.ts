import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { VERSION, API_VERSION, WORKER_VERSION } from "./version.js";

describe("version", () => {
  test("exports valid semantic versions", () => {
    const semverRegex = /^\d+\.\d+\.\d+/;
    assert.match(VERSION, semverRegex);
    assert.match(API_VERSION, semverRegex);
    assert.match(WORKER_VERSION, semverRegex);
  });
});
