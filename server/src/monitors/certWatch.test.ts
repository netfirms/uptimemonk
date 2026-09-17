import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ALERT_DAYS,
  MAX_ALERT_THRESHOLDS,
  alertDaysFor,
  certCause,
  decideCertAlerts,
  normaliseAlertDays,
} from "./certWatch.js";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 17);
const inDays = (n: number) => NOW + n * DAY;
const mon = (over: Record<string, unknown> = {}) => over as never;

describe("threshold configuration", () => {
  test("sorts highest first and removes duplicates", () => {
    assert.deepEqual(normaliseAlertDays([7, 30, 7, 14]), [30, 14, 7]);
  });

  test("drops values outside a sane range rather than clamping them", () => {
    // Clamping 0 to 1 would invent a threshold the customer did not ask for.
    assert.deepEqual(normaliseAlertDays([0, 5, 400, -3]), [5]);
  });

  test("caps the count, because each threshold is a page", () => {
    const many = normaliseAlertDays([60, 45, 30, 21, 14, 7, 3, 1]);
    assert.equal(many.length, MAX_ALERT_THRESHOLDS);
    assert.equal(many[0], 60, "keeps the earliest warnings");
  });

  test("an empty or junk list falls back to the default", () => {
    assert.deepEqual(normaliseAlertDays([]), DEFAULT_ALERT_DAYS);
    assert.deepEqual(normaliseAlertDays("nonsense"), DEFAULT_ALERT_DAYS);
  });

  test("a monitor created before this keeps its single threshold", () => {
    // sslExpiryWarningDays was the old field; it must not silently become the
    // four-threshold default and start paging three extra times.
    assert.deepEqual(alertDaysFor(mon({ sslExpiryWarningDays: 21 })), [21]);
  });

  test("the new field wins when both are present", () => {
    assert.deepEqual(
      alertDaysFor(mon({ sslExpiryAlertDays: [10, 2], sslExpiryWarningDays: 21 })),
      [10, 2]
    );
  });
});

describe("deciding what to say", () => {
  test("says nothing while expiry is beyond every threshold", () => {
    const d = decideCertAlerts(mon({}), inDays(90), NOW);
    assert.deepEqual(d.fire, []);
  });

  test("fires once when a threshold is reached", () => {
    const d = decideCertAlerts(mon({}), inDays(30), NOW);
    assert.deepEqual(d.fire, [30]);
  });

  test("does not repeat a threshold already announced", () => {
    const d = decideCertAlerts(
      mon({ certAlertedDays: [30], certAlertBasis: inDays(30) }),
      inDays(30),
      NOW
    );
    assert.deepEqual(d.fire, []);
  });

  test("a monitor first seen late says how long is actually left, once", () => {
    // Not 30, 14 and 7 in the same breath just because all three are behind.
    const d = decideCertAlerts(mon({}), inDays(4), NOW);
    assert.deepEqual(d.fire, [7], "the closest threshold, not all three behind it");
    assert.deepEqual(d.alertedDays, [30, 14, 7]);
  });

  test("passing a later threshold cannot re-announce an earlier one", () => {
    const first = decideCertAlerts(mon({}), inDays(20), NOW);
    const second = decideCertAlerts(
      mon({ certAlertedDays: first.alertedDays, certAlertBasis: inDays(20) }),
      inDays(6),
      NOW
    );
    assert.deepEqual(second.fire, [7]);
    assert.ok(!second.fire.includes(30), "30 was already spoken for");
  });

  test("a renewal resets the warnings", () => {
    // Detected by the expiry moving, so a re-issue with the same key counts.
    const d = decideCertAlerts(
      mon({ certAlertedDays: [30, 14, 7, 1], certAlertBasis: inDays(2) }),
      inDays(90),
      NOW
    );
    assert.equal(d.renewed, true);
    assert.deepEqual(d.alertedDays, []);
    assert.deepEqual(d.fire, []);
  });

  test("after a renewal the new certificate warns on its own schedule", () => {
    const renewed = decideCertAlerts(
      mon({ certAlertedDays: [30, 14], certAlertBasis: inDays(3) }),
      inDays(30),
      NOW
    );
    assert.equal(renewed.renewed, true);
    assert.deepEqual(renewed.fire, [30], "says 30 again for the new cert");
  });

  test("custom thresholds are honoured", () => {
    const d = decideCertAlerts(mon({ sslExpiryAlertDays: [60, 45] }), inDays(45), NOW);
    assert.deepEqual(d.fire, [45]);
  });
});

describe("wording", () => {
  test("reads as a renewal task, not an outage", () => {
    assert.match(certCause(9, "Let's Encrypt"), /expires in 9 days.*Let's Encrypt/);
    assert.match(certCause(1), /tomorrow/);
    assert.match(certCause(0), /today/);
  });
});
