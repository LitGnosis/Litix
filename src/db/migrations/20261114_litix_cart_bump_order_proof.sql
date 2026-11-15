BEGIN;

CREATE TABLE IF NOT EXISTS public.litix_cart_lines (
 order_id text NOT NULL REFERENCES public.litix_v2_orders(id) ON DELETE RESTRICT,
 ordinal smallint NOT NULL CHECK (ordinal BETWEEN 1 AND 2),
 supplier_service_id text NOT NULL REFERENCES public.litix_boostero_service_registry(supplier_service_id) ON DELETE RESTRICT,
 service_name text NOT NULL,
 service_kind text NOT NULL CHECK (service_kind IN ('followers','likes','views')),
 destination text NOT NULL,
 quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
 retail_cents integer NOT NULL CHECK (retail_cents >= 100),
 supplier_cost_cents integer NOT NULL CHECK (supplier_cost_cents >= 0),
 state text NOT NULL DEFAULT 'PENDING_PAYMENT'
  CHECK (state IN ('PENDING_PAYMENT','QUEUED','DISPATCHING','SUBMITTED','COMPLETED','FAILED','UNKNOWN_OUTCOME','MANUAL_REVIEW')),
 supplier_order_id text UNIQUE,
 supplier_status jsonb NOT NULL DEFAULT '{}'::jsonb,
 attempt_id uuid UNIQUE,
 attempted_at timestamptz,
 checked_at timestamptz,
 start_count integer CHECK (start_count IS NULL OR start_count >= 0),
 completed_at timestamptz,
 error_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (order_id,ordinal)
);

CREATE INDEX IF NOT EXISTS litix_cart_lines_active
 ON public.litix_cart_lines (state,checked_at)
 WHERE state IN ('SUBMITTED','QUEUED','MANUAL_REVIEW');

CREATE TABLE IF NOT EXISTS public.litix_order_proof (
 order_id text PRIMARY KEY REFERENCES public.litix_v2_orders(id) ON DELETE RESTRICT,
 buyer_ip inet,
 user_agent text NOT NULL DEFAULT '',
 checkout_source text NOT NULL DEFAULT 'Litix',
 captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.litix_order_proof_events (
 id uuid PRIMARY KEY,
 order_id text NOT NULL REFERENCES public.litix_v2_orders(id) ON DELETE RESTRICT,
 ordinal smallint,
 event_type text NOT NULL CHECK (event_type IN (
  'CHECKOUT_CREATED','PAYMENT_APPROVED','PAYMENT_DECLINED','PAYMENT_UNCERTAIN',
  'SUPPLIER_DISPATCH_STARTED','SUPPLIER_SUBMITTED','SUPPLIER_UNCERTAIN',
  'DELIVERY_STATUS_RECORDED','DELIVERY_COMPLETED','REVIEW_REQUIRED'
 )),
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT litix_order_proof_events_line CHECK (ordinal IS NULL OR ordinal BETWEEN 1 AND 2)
);

CREATE TABLE IF NOT EXISTS public.litix_cart_receipts (
 order_id text PRIMARY KEY REFERENCES public.litix_v2_orders(id) ON DELETE RESTRICT,
 state text NOT NULL DEFAULT 'PENDING_PAYMENT'
  CHECK (state IN ('PENDING_PAYMENT','queued','sending','sent','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
 leased_at timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS litix_cart_receipts_recovery
 ON public.litix_cart_receipts(state,next_attempt_at)
 WHERE state IN ('queued','sending');

CREATE INDEX IF NOT EXISTS litix_order_proof_events_history
 ON public.litix_order_proof_events (order_id,occurred_at,id);

CREATE OR REPLACE FUNCTION public.litix_proof_events_no_rewrite()
RETURNS trigger LANGUAGE plpgsql AS $
BEGIN
 RAISE EXCEPTION 'Litix order proof events are append-only';
END;
$;

DROP TRIGGER IF EXISTS litix_proof_events_append_only
 ON public.litix_order_proof_events;

CREATE TRIGGER litix_proof_events_append_only
 BEFORE UPDATE OR DELETE ON public.litix_order_proof_events
 FOR EACH ROW EXECUTE FUNCTION public.litix_proof_events_no_rewrite();

COMMIT;
