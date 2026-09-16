-- Every credit movement, append-only.
--
-- The first cut mutated `orgs.credits` directly, which had three faults that
-- only show up with money: a read-modify-write races two concurrent webhooks
-- into a lost grant, there was no way to reconstruct how a balance got where
-- it is, and a duplicate Stripe delivery was guarded by a check-then-act
-- across a network hop rather than by anything atomic.
--
-- `UNIQUE (reason, ref)` is what replaces that guard. Re-applying an event is
-- not "detected and skipped" — it is impossible, enforced by the database.
-- `orgs.credits` stays as a derived cache so the hot read is still one row.

CREATE TABLE credit_ledger (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id        TEXT    NOT NULL,
  at            INTEGER NOT NULL,
  -- Positive grants, negative burns and claw-backs.
  delta         INTEGER NOT NULL,
  -- grant | burn | refund | dispute | adjust
  reason        TEXT    NOT NULL,
  -- Stripe event id for a grant, day key for a burn. The natural key of the
  -- thing that caused the movement.
  ref           TEXT    NOT NULL,
  balance_after INTEGER NOT NULL,
  note          TEXT
);

CREATE UNIQUE INDEX idx_ledger_once ON credit_ledger (reason, ref);
CREATE INDEX idx_ledger_org ON credit_ledger (org_id, at DESC);
