-- Owner portal only. Never modify retail prices, checkout, or existing order records.
CREATE TABLE IF NOT EXISTS public.litix_owner_portal_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_sub text NOT NULL,
 supplier text NOT NULL CHECK (supplier IN ('boostero','smmglob')),
 idempotency_key uuid NOT NULL,
 quote_nonce text NOT NULL,
 fingerprint text NOT NULL,
 service_id text NOT NULL,
 service_name text NOT NULL,
 quantity integer NOT NULL CHECK(quantity>=1 AND quantity<=1000000),
 destination text NOT NULL,
 wholesale_cents bigint NOT NULL CHECK(wholesale_cents>=1 AND wholesale_cents<=100000000),
 currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 balance_before_cents bigint CHECK(balance_before_cents>=0),
 supplier_order_id text,
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN
  ('reserved','sending','submitted','pending','in_progress','completed','partial','failed','canceled','rejected','blocked','unknown')),
 status_data jsonb NOT NULL DEFAULT '{}'::jsonb,
 error_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 checked_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT litix_owner_portal_unique_request UNIQUE(owner_sub,idempotency_key),
 CONSTRAINT litix_owner_portal_unique_quote UNIQUE(owner_sub,quote_nonce)
);
CREATE UNIQUE INDEX IF NOT EXISTS litix_owner_portal_one_pending_per_wallet
 ON public.litix_owner_portal_orders (supplier)
 WHERE state IN ('reserved','sending','unknown');
CREATE INDEX IF NOT EXISTS litix_owner_portal_history
 ON public.litix_owner_portal_orders (owner_sub,created_at DESC);
CREATE INDEX IF NOT EXISTS litix_owner_portal_recent_duplicate
 ON public.litix_owner_portal_orders (owner_sub,supplier,fingerprint,created_at DESC);
REVOKE ALL ON TABLE public.litix_owner_portal_orders FROM PUBLIC;
-- Grant only to the dedicated backend DB role configured for LITIX_OWNER_DATABASE_URL.
-- No RLS bypass is exposed to browsers, and no public API references this table.
