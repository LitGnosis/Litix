-- Additive and isolated ZoraSMM supplier ledger. Run BEFORE enabling its worker.
-- This neither modifies old Boostero orders nor changes checkout/payments.
CREATE TABLE IF NOT EXISTS public.litix_zora_autolikes_subscriptions(
 litix_order_id text PRIMARY KEY REFERENCES public.litix_autolikes_prepaid_orders(id),
 platform text NOT NULL CHECK(platform IN ('instagram','tiktok')),
 service_id text NOT NULL CHECK(service_id ~ '^[0-9]{1,12}$'),
 wholesale_reserved_cents bigint NOT NULL CHECK(wholesale_reserved_cents>0),
 state text NOT NULL DEFAULT 'QUEUED' CHECK(state IN('QUEUED','CLAIMED','SUBMITTED','COMPLETED','MANUAL_REVIEW','UNKNOWN_OUTCOME')),
 claim_token uuid UNIQUE,
 supplier_order_id text UNIQUE,
 supplier_status text,
 last_checked_at timestamptz,
 error_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS litix_zora_autolikes_pending_idx
 ON public.litix_zora_autolikes_subscriptions(state,last_checked_at,created_at);
ALTER TABLE public.litix_zora_autolikes_subscriptions ENABLE ROW LEVEL SECURITY;
-- No public grants; service-only direct database access.
