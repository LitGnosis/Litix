-- BOOSTERO-ONLY inventory expansion. ADDITIVE and reviewable.
-- This is an inventory table, NOT a new-order approval table.
-- Existing public.litix_boostero_services remains authoritative for checkout.
-- Apply only to approved Neon environment after preview verification.
CREATE TABLE IF NOT EXISTS public.litix_boostero_inventory (
 supplier_service_id text PRIMARY KEY CHECK (supplier_service_id ~ '^[0-9]{1,12}$'),
 service_name text NOT NULL,
 supplier_category text NOT NULL,
 platform text NOT NULL,
 service_kind text NOT NULL,
 order_type text NOT NULL,
 wholesale_per_1000 numeric(16,6) NOT NULL CHECK (wholesale_per_1000 > 0),
 minimum_quantity integer NOT NULL CHECK (minimum_quantity > 0),
 maximum_quantity integer NOT NULL CHECK (maximum_quantity >= minimum_quantity),
 refill_eligible boolean NOT NULL DEFAULT false,
 cancel_eligible boolean NOT NULL DEFAULT false,
 dripfeed_eligible boolean NOT NULL DEFAULT false,
 refill_days integer,
 standard_input_compatible boolean NOT NULL DEFAULT false,
 active boolean NOT NULL DEFAULT true,
 -- Inventory is never customer-facing or enabled for checkout by import.
 public_enabled boolean NOT NULL DEFAULT false CHECK (public_enabled = false),
 first_seen_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 refreshed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS litix_boostero_inventory_platform_idx
 ON public.litix_boostero_inventory(platform,service_kind,active);
CREATE INDEX IF NOT EXISTS litix_boostero_inventory_review_idx
 ON public.litix_boostero_inventory(active,standard_input_compatible);
CREATE TABLE IF NOT EXISTS public.litix_boostero_inventory_syncs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 executed_at timestamptz NOT NULL DEFAULT now(),
 source text NOT NULL DEFAULT 'boostero_api_v2_services',
 retrieved_count integer NOT NULL CHECK (retrieved_count >= 0),
 valid_count integer NOT NULL CHECK (valid_count >= 0),
 invalid_count integer NOT NULL CHECK (invalid_count >= 0),
 enabled_count integer NOT NULL DEFAULT 0,
 result text NOT NULL DEFAULT 'success',
 -- Do not put API responses, private tokens or raw supplier key here.
 notes text
);
-- No DELETE, DROP, TRUNCATE, payment updates or existing-order migration.

-- Candidate retail values are private and always require separate purchase approval.
-- Never exposes wholesale prices or enables previously unapproved products.
ALTER TABLE public.litix_boostero_inventory
 ADD COLUMN IF NOT EXISTS retail_per_1000_cents bigint
 CHECK (retail_per_1000_cents IS NULL OR retail_per_1000_cents >= 500);
ALTER TABLE public.litix_boostero_inventory
 ADD COLUMN IF NOT EXISTS pricing_review_reason text;
ALTER TABLE public.litix_boostero_inventory
 ADD COLUMN IF NOT EXISTS supplier_identifier text NOT NULL DEFAULT 'BOOSTERO';
CREATE INDEX IF NOT EXISTS litix_boostero_inventory_price_review_idx
 ON public.litix_boostero_inventory(pricing_review_reason)
 WHERE active=true;
-- Intentionally no public_activation or payment writes in this migration.
