import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  ALERT_FROM_EMAIL,
  DONATION_LINK_CENTS,
  DONATION_LINK_RECURRING,
  MAILGUN_API_KEY,
  MAILGUN_DOMAIN,
  PROBE_CONCURRENCY,
  RETENTION_DAYS,
  STRIPE_SECRET_KEY,
  RECAPTCHA_SITE_KEY,
  RECAPTCHA_SECRET,
  RECAPTCHA_MIN_SCORE,
  USER_AGENT,
  MIN_INTERVAL_SECONDS_FREE,
  MIN_INTERVAL_SECONDS_DONOR,
  MAX_MONITORS_FREE,
  MAX_MONITORS_DONOR,
  getEffectiveConfig,
  getConfigMetadata,
  resetDynamicConfig,
  updateDynamicConfig,
} from "./config.js";

describe("dynamic app configuration", () => {
  beforeEach(() => {
    resetDynamicConfig();
  });

  test("returns default configuration initially", () => {
    const config = getEffectiveConfig();
    assert.equal(typeof config.probeConcurrency, "number");
    assert.equal(typeof config.retentionDays, "number");
    assert.equal(typeof config.userAgent, "string");
    assert.equal(typeof config.alertFromEmail, "string");
  });

  test("overrides runtime values when dynamic Firestore snapshot arrives", () => {
    updateDynamicConfig({
      alertFromEmail: "custom-alerts@mycompany.org",
      mailgunApiKey: "key-live-123456",
      mailgunDomain: "mg.mycompany.org",
      probeConcurrency: 350,
      retentionDays: 60,
      donationLinkCents: 500,
      donationLinkRecurring: true,
      stripeSecretKey: "sk_live_custom99",
      recaptchaSiteKey: "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",
      recaptchaSecret: "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe",
      recaptchaMinScore: 0.7,
      userAgent: "CustomUptimeBot/2.0",
    });

    const config = getEffectiveConfig();
    assert.equal(config.alertFromEmail, "custom-alerts@mycompany.org");
    assert.equal(config.mailgunApiKey, "key-live-123456");
    assert.equal(config.mailgunDomain, "mg.mycompany.org");
    assert.equal(config.probeConcurrency, 350);
    assert.equal(config.retentionDays, 60);
    assert.equal(config.donationLinkCents, 500);
    assert.equal(config.donationLinkRecurring, true);
    assert.equal(config.stripeSecretKey, "sk_live_custom99");
    assert.equal(config.recaptchaSiteKey, "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI");
    assert.equal(config.recaptchaSecret, "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe");
    assert.equal(config.recaptchaMinScore, 0.7);
    assert.equal(config.userAgent, "CustomUptimeBot/2.0");

    // Check live exported ESM bindings
    assert.equal(ALERT_FROM_EMAIL, "custom-alerts@mycompany.org");
    assert.equal(MAILGUN_API_KEY, "key-live-123456");
    assert.equal(MAILGUN_DOMAIN, "mg.mycompany.org");
    assert.equal(PROBE_CONCURRENCY, 350);
    assert.equal(RETENTION_DAYS, 60);
    assert.equal(DONATION_LINK_CENTS, 500);
    assert.equal(DONATION_LINK_RECURRING, true);
    assert.equal(STRIPE_SECRET_KEY, "sk_live_custom99");
    assert.equal(RECAPTCHA_SITE_KEY, "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI");
    assert.equal(RECAPTCHA_SECRET, "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe");
    assert.equal(RECAPTCHA_MIN_SCORE, 0.7);
    assert.equal(USER_AGENT, "CustomUptimeBot/2.0");
  });

  test("tracks origin in metadata", () => {
    updateDynamicConfig({
      mailgunApiKey: "key-custom-override",
    });

    const meta = getConfigMetadata();
    const mailgunMeta = meta.find((m) => m.key === "mailgunApiKey");
    const domainMeta = meta.find((m) => m.key === "mailgunDomain");

    assert.ok(mailgunMeta);
    assert.equal(mailgunMeta.source, "firestore");
    assert.equal(mailgunMeta.value, "key-custom-override");

    assert.ok(domainMeta);
    assert.equal(domainMeta.source, "env_fallback");
  });

  test("resetDynamicConfig restores environment fallbacks", () => {
    updateDynamicConfig({
      probeConcurrency: 999,
      alertFromEmail: "temp@temp.com",
    });

    assert.equal(PROBE_CONCURRENCY, 999);
    assert.equal(ALERT_FROM_EMAIL, "temp@temp.com");

    resetDynamicConfig();

    assert.notEqual(PROBE_CONCURRENCY, 999);
    assert.notEqual(ALERT_FROM_EMAIL, "temp@temp.com");
  });
});

describe("seeding the dynamic config", () => {
  test("no secret is ever copied into the seed", async () => {
    // The document is replicated, backed up, and readable by anything with
    // project access, while the original lives at 0600 root. A secret belongs
    // in exactly one of those and it is not this one.
    const { getSeedableConfig, SECRET_CONFIG_KEYS } = await import("./config.js");
    const seed = getSeedableConfig();
    for (const key of SECRET_CONFIG_KEYS) {
      assert.ok(!(key in seed), `${key} must not be seeded`);
    }
  });

  test("the seed still carries the tunables worth having", async () => {
    const { getSeedableConfig } = await import("./config.js");
    const seed = getSeedableConfig();
    for (const key of ["appUrl", "apiUrl", "probeConcurrency", "retentionDays"]) {
      assert.ok(key in seed, `${key} should be seeded`);
    }
  });

  test("every secret-shaped field is on the exclusion list", async () => {
    // A new credential added to AppConfig must be excluded deliberately, not
    // by being forgotten.
    const { getEffectiveConfig, SECRET_CONFIG_KEYS } = await import("./config.js");
    // recaptchaSiteKey is a public frontend site key, not a backend secret
    const suspicious = Object.keys(getEffectiveConfig()).filter(
      (k) => /key|secret|token|password/i.test(k) && k !== "recaptchaSiteKey"
    );
    for (const key of suspicious) {
      assert.ok(
        (SECRET_CONFIG_KEYS as readonly string[]).includes(key),
        `${key} looks secret but is not excluded from the seed`
      );
    }
  });
});

/**
 * The capacity knobs.
 *
 * Unlike the rest of the config, a typo here changes how much work the fleet
 * accepts — a 1-second floor is five times the probe rate and five times the
 * Firestore writes. So the bounds are the feature, and these tests pin them.
 */
describe("the capacity limits an operator can change", () => {
  beforeEach(() => {
    resetDynamicConfig();
  });

  test("a sane change is taken as given", () => {
    updateDynamicConfig({
      minIntervalSecondsFree: 30,
      minIntervalSecondsDonor: 10,
      maxMonitorsFree: 25,
      maxMonitorsDonor: 400,
    });
    assert.equal(MIN_INTERVAL_SECONDS_FREE, 30);
    assert.equal(MIN_INTERVAL_SECONDS_DONOR, 10);
    assert.equal(MAX_MONITORS_FREE, 25);
    assert.equal(MAX_MONITORS_DONOR, 400);
  });

  test("neither floor can be lowered past the scheduler's own limit", () => {
    // Raising a floor sheds load and is allowed. Going below 5s is a capacity
    // decision the console does not get to make, on either standing.
    for (const v of [1, 0, -60]) {
      updateDynamicConfig({ minIntervalSecondsFree: v, minIntervalSecondsDonor: v });
      assert.equal(MIN_INTERVAL_SECONDS_FREE, 5, `free at ${v}`);
      assert.equal(MIN_INTERVAL_SECONDS_DONOR, 5, `donor at ${v}`);
    }
  });

  test("an absurd interval is clamped rather than accepted", () => {
    updateDynamicConfig({ minIntervalSecondsFree: 999_999 });
    assert.equal(MIN_INTERVAL_SECONDS_FREE, 3_600);
  });

  test("a donor floor slower than the free floor is lowered to meet it", () => {
    // The opposite direction to the monitor caps: here the donor number is
    // the smaller one, because donating buys a faster check, and donating
    // must never be a downgrade.
    updateDynamicConfig({ minIntervalSecondsFree: 30, minIntervalSecondsDonor: 120 });
    assert.equal(MIN_INTERVAL_SECONDS_FREE, 30);
    assert.equal(MIN_INTERVAL_SECONDS_DONOR, 30);
  });

  test("the shipped defaults are one minute free, five seconds donor", () => {
    assert.equal(MIN_INTERVAL_SECONDS_FREE, 60);
    assert.equal(MIN_INTERVAL_SECONDS_DONOR, 5);
  });

  test("monitor caps are clamped at both ends", () => {
    updateDynamicConfig({ maxMonitorsFree: 0, maxMonitorsDonor: 50_000 });
    assert.equal(MAX_MONITORS_FREE, 1);
    assert.equal(MAX_MONITORS_DONOR, 5_000);
  });

  test("a donor cap below the free cap is raised to meet it", () => {
    // Otherwise supporting the project would be a downgrade.
    updateDynamicConfig({ maxMonitorsFree: 120, maxMonitorsDonor: 40 });
    assert.equal(MAX_MONITORS_FREE, 120);
    assert.equal(MAX_MONITORS_DONOR, 120);
  });

  test("a fractional value becomes a whole number, not a fraction of a check", () => {
    updateDynamicConfig({ minIntervalSecondsFree: 30.7, maxMonitorsFree: 10.2 });
    assert.equal(MIN_INTERVAL_SECONDS_FREE, 31);
    assert.equal(MAX_MONITORS_FREE, 10);
  });

  test("garbage leaves the previous value alone", () => {
    updateDynamicConfig({ minIntervalSecondsFree: 45 });
    assert.equal(MIN_INTERVAL_SECONDS_FREE, 45);
    updateDynamicConfig({ minIntervalSecondsFree: "not a number" });
    assert.equal(MIN_INTERVAL_SECONDS_FREE, 60, "falls back to the env default, not NaN");
  });

  test("they are exposed to the console, so it can render them", () => {
    const config = getEffectiveConfig();
    assert.equal(typeof config.minIntervalSecondsFree, "number");
    assert.equal(typeof config.minIntervalSecondsDonor, "number");
    assert.equal(typeof config.maxMonitorsFree, "number");
    assert.equal(typeof config.maxMonitorsDonor, "number");
  });
});
