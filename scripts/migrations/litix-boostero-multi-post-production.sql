-- Litix: additive multi-post ledger for one verified PayKings payment -> 2–5
-- independent, idempotently claimed supplier fulfillment orders.
-- Production migration is non-destructive: never updates or deletes existing data.
-- References the previously approved main-branch service and payment tables.
CREATE TABLE IF NOT EXISTS public.litix_boostero_multi_posts (
 parent_order_id TEXT NOT NULL REFERENCES public.litix_v2_orders(id) ON DELETE RESTRICT,
 ordinal SMALLINT NOT NULL CHECK (ordinal BETWEEN 1 AND 5),
 supplier_service_id TEXT NOT NULL REFERENCES public.litix_boostero_services(supplier_service_id) ON DELETE RESTRICT,
 destination TEXT NOT NULL CHECK (length(destination) BETWEEN 12 AND 500),
 quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
 retail_cents INTEGER NOT NULL CHECK (retail_cents BETWEEN 100 AND 100000000),
 state TEXT NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (state IN
  ('PENDING_PAYMENT','QUEUED','DISPATCHING','SUBMITTED','COMPLETED','REJECTED','UNKNOWN_OUTCOME','MANUAL_REVIEW')),
 supplier_order_id TEXT UNIQUE,
 attempt_id TEXT UNIQUE,
 attempted_at TIMESTAMPTZ,
 checked_at TIMESTAMPTZ,
 supplier_status JSONB NOT NULL DEFAULT '{}'::jsonb,
 error_code TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY (parent_order_id, ordinal),
 UNIQUE (parent_order_id, destination)
);
CREATE INDEX IF NOT EXISTS litix_boostero_multi_posts_status_idx
 ON public.litix_boostero_multi_posts(state,updated_at);
