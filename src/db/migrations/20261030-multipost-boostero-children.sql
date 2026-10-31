-- Staging-first, additive Litix Boostero child-order support.
-- Do NOT apply to production before an independent backup/restore and
-- confirming this is the database actually used by the current live deployment.
-- No existing order, payment, or supplier attempt rows are modified.

CREATE TABLE IF NOT EXISTS public.litix_boostero_multi_posts (
  parent_order_id text NOT NULL REFERENCES public.litix_v2_orders(id) ON DELETE RESTRICT,
  ordinal smallint NOT NULL CHECK (ordinal BETWEEN 1 AND 5),
  supplier_service_id text NOT NULL REFERENCES public.litix_boostero_services(supplier_service_id) ON DELETE RESTRICT,
  destination text NOT NULL CHECK (length(destination) BETWEEN 12 AND 500),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
  retail_cents integer NOT NULL CHECK (retail_cents BETWEEN 100 AND 100000000),
  state text NOT NULL DEFAULT 'PENDING_PAYMENT'
    CHECK (state IN ('PENDING_PAYMENT','QUEUED','DISPATCHING','SUBMITTED','COMPLETED','REJECTED','UNKNOWN_OUTCOME','MANUAL_REVIEW')),
  supplier_order_id text UNIQUE,
  attempt_id text UNIQUE,
  attempted_at timestamptz,
  supplier_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_order_id,ordinal),
  UNIQUE(parent_order_id,destination)
);
CREATE INDEX IF NOT EXISTS litix_boostero_multi_posts_status_idx
ON public.litix_boostero_multi_posts(state,updated_at);

-- Existing legacy rollout hard-coded $6/1000; today's product policy is 60%
-- supplier markup with a $1 minimum *order*, enforced by boosteroQuote.
-- This migration relaxes only that legacy storage constraint, not the pricing
-- verification, post minimum, wallet preflight, or charge idempotency gates.
ALTER TABLE public.litix_boostero_services
  DROP CONSTRAINT IF EXISTS litix_boostero_services_retail_per_1000_cents_check;
ALTER TABLE public.litix_boostero_services
  ADD CONSTRAINT litix_boostero_services_retail_per_1000_cents_check
  CHECK (retail_per_1000_cents >= 1);
