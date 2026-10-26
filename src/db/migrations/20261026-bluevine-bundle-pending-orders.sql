-- Additive: the existing PayKings checkout, orders, and payment-state constraints are unchanged.
-- Apply to the *existing* production bundles DB only after a verified database backup.
ALTER TABLE litix_growth_bundle_orders
 ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'paykings';
ALTER TABLE litix_growth_bundle_orders
 ADD COLUMN IF NOT EXISTS customer_whatsapp text;
ALTER TABLE litix_growth_bundle_orders
 ADD COLUMN IF NOT EXISTS bluevine_payment_reference text;
-- Existing "awaiting_payment" represents a Bluevine checkout *pending manual verification*.
-- Never infer "settled" from a redirect, return URL, or customer-provided receipt.
CREATE INDEX IF NOT EXISTS litix_growth_bundle_pending_bluevine_idx
 ON litix_growth_bundle_orders(payment_state,created_at DESC)
 WHERE payment_provider='bluevine';
