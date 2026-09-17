-- Certificate expiry becomes a warning with several thresholds, not an outage.
--
-- Before this, a cert inside `sslExpiryWarningDays` made the check *fail*, so
-- the monitor went DOWN and paged people as though the site were offline. It
-- was not: the site serves fine on a cert with nine days left. The renewal is
-- urgent, the outage is fictional, and the two want different words.

-- Which thresholds have already been announced for the certificate currently
-- installed. Cleared when a renewal pushes the expiry date out, so the next
-- cert announces its own thresholds from scratch.
ALTER TABLE monitors ADD COLUMN cert_alerted_days TEXT NOT NULL DEFAULT '[]';
-- The expiry the alerts above were computed against, so a renewal is detected.
ALTER TABLE monitors ADD COLUMN cert_alert_basis INTEGER;

-- Distinguishes a certificate warning from a real outage. Existing rows are
-- outages, which is what they were.
ALTER TABLE incidents ADD COLUMN kind TEXT NOT NULL DEFAULT 'outage';

-- The rest of the validity window, so the UI can show "valid 3 Sep – 2 Dec"
-- rather than an expiry with no context. `cert_expires_at` already existed.
ALTER TABLE monitors ADD COLUMN cert_issued_at INTEGER;
ALTER TABLE monitors ADD COLUMN cert_issuer TEXT;
