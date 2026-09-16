"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Billing } from "@/lib/api";
import { events } from "@/lib/analytics";

/**
 * Capacity, and how to add to it.
 *
 * Not a pricing page. Nothing is locked behind a payment — every check type,
 * sub-minute intervals, status pages and the API all work on a free
 * workspace. What a donation buys is the one thing that genuinely costs money
 * to provide: checks. So this panel leads with what the workspace is using and
 * what it has, and only then asks.
 */

const fmt = (n: number) => n.toLocaleString();

/** Does this donation URL carry the workspace it should credit? */
function hasWorkspaceTag(url: string): boolean {
  try {
    return Boolean(new URL(url).searchParams.get("client_reference_id"));
  } catch {
    return false;
  }
}

/** A budget in checks means little on its own; monitors-at-an-interval does. */
function asMonitors(checksPerDay: number, intervalSeconds: number): number {
  return Math.floor(checksPerDay / (86_400 / intervalSeconds));
}

export default function Support({
  isOpen,
  onClose,
  usedChecksPerDay,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** What the workspace's current monitors cost, computed by the caller. */
  usedChecksPerDay: number;
}) {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(5);

  const load = useCallback(async () => {
    try {
      setBilling(await api.billing());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your capacity.");
    }
  }, []);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && isOpen && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function donate() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.donate(amount);
      void events.donateStarted(amount);
      // Stripe hosts the payment page; no card details ever reach this app.
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the donation.");
      setBusy(false);
    }
  }

  const pct = billing
    ? Math.min(100, Math.round((usedChecksPerDay / Math.max(1, billing.checksPerDayBudget)) * 100))
    : 0;
  const over = billing ? usedChecksPerDay > billing.checksPerDayBudget : false;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" role="dialog" aria-modal="true" aria-label="Capacity">
        <div className="modal-header">
          <h2>Capacity</h2>
          <button className="btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="banner err" role="alert">
              {error}
            </div>
          )}

          {!billing ? (
            <p className="dim">Loading…</p>
          ) : (
            <>
              {billing.standing === "grace" && (
                <div className="banner warn">
                  Your support has lapsed. Everything keeps running until{" "}
                  {new Date(billing.graceUntil ?? Date.now()).toLocaleDateString()}, then this
                  workspace returns to the free allowance. Nothing is deleted.
                </div>
              )}
              {billing.standing === "lapsed" && (
                <div className="banner warn">
                  Running on the free allowance. Your monitors are all still
                  checking — there is just less room to add or speed them up.
                </div>
              )}

              <div className="capacity">
                <div className="row-between">
                  <strong>{fmt(usedChecksPerDay)}</strong>
                  <span className="dim">of {fmt(billing.checksPerDayBudget)} checks a day</span>
                </div>
                <div className="capacity-bar">
                  <span style={{ width: `${pct}%` }} data-over={over || undefined} />
                </div>
                <p className="dim" style={{ marginTop: 6 }}>
                  That is about{" "}
                  {Math.min(billing.maxMonitors, asMonitors(billing.checksPerDayBudget, 60))}{" "}
                  monitors at one minute, or{" "}
                  {Math.min(billing.maxMonitors, asMonitors(billing.checksPerDayBudget, 300))} at
                  five — up to {billing.maxMonitors} in total.
                </p>
              </div>

              <p className="dim" style={{ margin: "18px 0" }}>
                Every feature works on a free workspace — this is not a paywall.
                What a donation pays for is capacity: each check is a real
                request from a real machine.
                {billing.donationUsdMonthly > 0 && (
                  <>
                    {" "}
                    You are supporting at <strong>${billing.donationUsdMonthly}/month</strong>.
                    Thank you.
                  </>
                )}
              </p>

              {/* Belt and braces: never render a donate button whose URL has
                  lost its workspace tag. The API builds it from the verified
                  token, so this should be impossible — but an untagged
                  donation is money taken and nothing credited, which is worth
                  one cheap check rather than trusting the invariant. */}
              {billing.link && hasWorkspaceTag(billing.link.url) && (
                <div className="donate">
                  {!billing.link.credited && (
                    <div className="banner warn">
                      Donations can be taken but not yet credited — the server
                      has no Stripe webhook secret, so capacity would not be
                      added. Worth fixing before sharing this.
                    </div>
                  )}
                  <a
                    className="coffee-btn"
                    href={billing.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => void events.donateStarted(billing.link!.cents / 100)}
                  >
                    <span aria-hidden>☕</span>
                    Buy me a coffee — ${(billing.link.cents / 100).toFixed(2)}
                  </a>
                  <p className="dim" style={{ marginTop: 8 }}>
                    Adds {fmt(billing.link.checks)} checks{" "}
                    {billing.link.recurring
                      ? "every month, for as long as you keep it. Cancel any time — credit already given stays yours."
                      : "— about a month at your current rate. One-off, no subscription."}
                  </p>
                </div>
              )}

              {billing.enabled ? (
                <div className="donate" style={{ marginTop: 18 }}>
                  <p className="dim" style={{ marginBottom: 10 }}>
                    Or choose your own amount:
                  </p>
                  <div className="amounts">
                    {billing.suggestedUsd.map((usd) => (
                      <button
                        key={usd}
                        type="button"
                        className={`interval-chip ${amount === usd ? "selected" : ""}`}
                        onClick={() => setAmount(usd)}
                      >
                        ${usd}
                      </button>
                    ))}
                  </div>
                  <p className="dim">
                    ${amount} a month adds{" "}
                    {fmt(billing.preview.find((p) => p.usd === amount)?.checks ?? 0)} checks of
                    capacity each month. Unused capacity rolls over.
                  </p>
                  <button className="primary" onClick={donate} disabled={busy}>
                    {busy ? "Opening Stripe…" : `Support with $${amount}/month`}
                  </button>
                  <p className="dim" style={{ marginTop: 8, fontSize: "0.75rem" }}>
                    Stripe handles the payment. Cancel any time — credit you have
                    already given is kept.
                  </p>
                </div>
              ) : null}

              {billing.link && !hasWorkspaceTag(billing.link.url) && (
                <div className="banner err" role="alert">
                  The donation link is missing its workspace tag, so a payment
                  could not be credited. Not showing it rather than taking
                  money for nothing.
                </div>
              )}

              {!billing.link && !billing.enabled && (
                <div className="banner warn">
                  Donations are not set up on this server yet.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
