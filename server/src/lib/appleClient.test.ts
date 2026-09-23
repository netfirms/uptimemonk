import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isAppleClient, botGateApplies } from "./recaptcha.js";

/**
 * The iOS build must never be shown a way to pay outside In-App Purchase —
 * App Store Guideline 3.1.1, and what the submission was rejected for.
 *
 * These pin the header contract that decision rests on, and in particular pin
 * the trap: platform detection is a *separate* header from the one the bot
 * gate reads.
 */
describe("isAppleClient", () => {
  test("recognises the iOS build", () => {
    assert.equal(isAppleClient("ios"), true);
  });

  test("Android, web and an absent header are not Apple", () => {
    assert.equal(isAppleClient("android"), false);
    assert.equal(isAppleClient("web"), false);
    assert.equal(isAppleClient(undefined), false);
  });

  test("a repeated header does not qualify", () => {
    // Arrives as an array, which no honest client sends. Treated as not-iOS,
    // which fails toward showing more rather than less — the safe direction
    // for a header that protects nothing.
    assert.equal(isAppleClient(["ios", "ios"]), false);
  });

  test("matching is exact", () => {
    assert.equal(isAppleClient("iOS"), false);
    assert.equal(isAppleClient("ios-app"), false);
  });
});

describe("platform detection must not disturb the bot gate", () => {
  test("the mobile exemption still keys on X-Client alone", () => {
    // The trap this test exists for: narrowing X-Client from "mobile" to "ios"
    // to identify the platform would re-arm the captcha for iOS sign-ups and
    // break them, because the app has no way to mint a reCAPTCHA token. The
    // platform lives in its own header precisely so this stays true.
    assert.equal(botGateApplies("mobile"), false, "the app is still exempt");
    assert.equal(botGateApplies("ios"), true, "…and 'ios' is not a magic value here");
    assert.equal(botGateApplies(undefined), true);
  });

  test("the two headers are read independently", () => {
    // What the iOS app actually sends: X-Client: mobile, X-Platform: ios.
    // Exempt from the captcha, and withheld the payment path.
    assert.equal(botGateApplies("mobile"), false);
    assert.equal(isAppleClient("ios"), true);
  });
});
