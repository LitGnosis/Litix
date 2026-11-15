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

CREATE INDEX IF NOT EXISTS litix_order_proof_events_history
 ON public.litix_order_proof_events (order_id,occurred_at,id);

COMMIT;
