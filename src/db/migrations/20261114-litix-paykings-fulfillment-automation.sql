-- Litix supplemental automation ledger. Run on the Neon database that owns
-- public.litix_v2_orders and public.litix_boostero_fulfillment.
-- Designed to coexist with existing paid-order dispatch; no data is deleted.
BEGIN;
CREATE TABLE IF NOT EXISTS public.litix_paykings_webhook_events (
 event_id text PRIMARY KEY,
 transaction_id text NOT NULL,
 order_id text NOT NULL REFERENCES public.litix_v2_orders(id),
 event_type text NOT NULL,
 body_sha256 text NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz,
 state text NOT NULL DEFAULT 'verified'
   CHECK (state IN ('verified','processed','review')),
 error_code text
);
CREATE INDEX IF NOT EXISTS litix_paykings_events_order_idx ON public.litix_paykings_webhook_events(order_id);
-- One captured transaction can only belong to one existing Litix order.
CREATE UNIQUE INDEX IF NOT EXISTS litix_paid_transaction_unique
 ON public.litix_v2_orders(payment_transaction_id)
 WHERE payment_transaction_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.litix_automation_retries (
 litix_order_id text PRIMARY KEY REFERENCES public.litix_v2_orders(id),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','dispatching','sent','review','exhausted')),
 last_error text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS litix_automation_due_idx
 ON public.litix_automation_retries(state,next_attempt_at);
CREATE TABLE IF NOT EXISTS public.litix_automation_reviews (
 litix_order_id text NOT NULL REFERENCES public.litix_v2_orders(id),
 reason text NOT NULL,
 supplier_order_id text,
 supplier_status text,
 remains integer,
 supplier_charge_usd numeric(14,5),
 -- The provider must confirm actual refund credit. This is a calculation, not a refund.
 estimated_supplier_credit_usd numeric(14,5),
 credited_amount_usd numeric(14,5),
 credit_confirmed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (litix_order_id,reason)
);
CREATE TABLE IF NOT EXISTS public.litix_refill_requests (
 litix_order_id text PRIMARY KEY REFERENCES public.litix_v2_orders(id),
 request_id uuid NOT NULL DEFAULT gen_random_uuid(),
 state text NOT NULL DEFAULT 'requested' CHECK (state IN ('requested','submitted','review','rejected')),
 supplier_refill_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.litix_automation_confirmations (
 litix_order_id text PRIMARY KEY REFERENCES public.litix_v2_orders(id),
 state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','sending','sent','review')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 last_error text
);
CREATE TABLE IF NOT EXISTS public.litix_supplier_balance_alerts (
 alert_day date PRIMARY KEY,
 balance_usd numeric(14,5) NOT NULL,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN('queued','sent','review')),
 created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
