-- Litix additive Boostero-only bundle child ledger.
-- Existing paid orders, Bluevine links, PayKings transactions, manual packages and pricing untouched.
ALTER TABLE public.litix_growth_bundle_orders
 ADD COLUMN IF NOT EXISTS auto_fulfillment_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.litix_growth_bundle_auto_dispatch (
 order_id TEXT NOT NULL REFERENCES public.litix_growth_bundle_orders(id) ON DELETE RESTRICT,
 ordinal SMALLINT NOT NULL CHECK (ordinal BETWEEN 1 AND 31),
 kind TEXT NOT NULL CHECK (kind IN ('Likes','Views','Shares','Followers')),
 destination TEXT NOT NULL CHECK (length(destination) BETWEEN 12 AND 500),
 supplier_service_id TEXT NOT NULL CHECK (supplier_service_id ~ '^[0-9]{1,12}$'),
 quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
 quoted_wholesale_cents INTEGER NOT NULL CHECK (quoted_wholesale_cents > 0),
 state TEXT NOT NULL DEFAULT 'PENDING_PAYMENT'
  CHECK (state IN ('PENDING_PAYMENT','QUEUED','DISPATCHING','SUBMITTED','COMPLETED','MANUAL_REVIEW','UNKNOWN_OUTCOME')),
 attempt_id TEXT UNIQUE,
 supplier_order_id TEXT UNIQUE,
 supplier_status JSONB NOT NULL DEFAULT '{}'::jsonb,
 attempted_at TIMESTAMPTZ,
 checked_at TIMESTAMPTZ,
 error_code TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY (order_id,ordinal),
 UNIQUE (order_id,kind,destination)
);
CREATE INDEX IF NOT EXISTS litix_growth_bundle_auto_status_idx
 ON public.litix_growth_bundle_auto_dispatch(state,updated_at);
ALTER TABLE public.litix_growth_bundle_auto_dispatch ENABLE ROW LEVEL SECURITY;
