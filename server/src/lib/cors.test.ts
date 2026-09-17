import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin, ALLOWED_ORIGINS } from "./cors.js";

describe("CORS allowed origins", () => {
  test("allows internal ops dashboard (ops.uptimemonke.com)", () => {
    assert.equal(isAllowedOrigin("https://ops.uptimemonke.com"), true);
  });

  test("allows customer web app (uptimemonke.com & www.uptimemonke.com)", () => {
    assert.equal(isAllowedOrigin("https://uptimemonke.com"), true);
    assert.equal(isAllowedOrigin("https://www.uptimemonke.com"), true);
  });

  test("allows Firebase hosting preview domains", () => {
    assert.equal(isAllowedOrigin("https://uptimemonke-admin.web.app"), true);
    assert.equal(isAllowedOrigin("https://uptimemonk.firebaseapp.com"), true);
  });

  test("allows localhost development ports", () => {
    assert.equal(isAllowedOrigin("http://localhost:3000"), true);
    assert.equal(isAllowedOrigin("http://localhost:3001"), true);
  });

  test("allows subdomains on uptimemonke.com and uptimemonk.com", () => {
    assert.equal(isAllowedOrigin("https://status.uptimemonke.com"), true);
    assert.equal(isAllowedOrigin("https://admin.uptimemonke.com"), true);
    assert.equal(isAllowedOrigin("https://ops.uptimemonk.com"), true);
  });

  test("rejects unauthorized external origins", () => {
    assert.equal(isAllowedOrigin("https://evil-uptimemonke.com"), false);
    assert.equal(isAllowedOrigin("https://fakeuptimemonke.com"), false);
    assert.equal(isAllowedOrigin("https://example.com"), false);
    assert.equal(isAllowedOrigin(""), false);
    assert.equal(isAllowedOrigin(undefined), false);
  });
});
