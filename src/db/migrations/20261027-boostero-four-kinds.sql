-- Additive only: existing Boostero #5461 remains active as Instagram followers.
-- Other services may be inserted only after fresh authenticated supplier read-only verification.
ALTER TABLE public.litix_boostero_services
 ADD COLUMN IF NOT EXISTS service_kind text NOT NULL DEFAULT 'followers'
 CHECK (service_kind IN ('followers','likes'));
-- No supplier order, payment, or historical order data is changed by this migration.
