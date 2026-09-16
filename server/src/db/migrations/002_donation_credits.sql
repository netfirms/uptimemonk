-- Donation credits replace the plan paywall.
--
-- `plan` is deliberately left in place: it still distinguishes an org that has
-- never donated from one on a legacy paid plan, and dropping a column that
-- `getOrgPlan` reads would break the running worker mid-deploy.

ALTER TABLE orgs ADD COLUMN credits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orgs ADD COLUMN donation_usd_monthly INTEGER NOT NULL DEFAULT 0;
-- Set when the balance first empties; NULL while in credit.
ALTER TABLE orgs ADD COLUMN grace_until INTEGER;
-- The last day already charged, so a restart cannot double-burn.
ALTER TABLE orgs ADD COLUMN credits_burned_day TEXT;
