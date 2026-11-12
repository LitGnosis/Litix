-- Litix transactional customer delivery updates, 2026-10-29.
-- Additive, non-destructive. No payment or supplier-order tables are changed.
CREATE TABLE IF NOT EXISTS public.litix_customer_delivery_updates (
 id text PRIMARY KEY,
 order_id text NOT NULL REFERENCES public.litix_v2_orders(id) ON DELETE CASCADE,
 fingerprint text NOT NULL,
 send_state text NOT NULL DEFAULT 'queued'
   CHECK (send_state IN ('queued','sending','sent','failed')),
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 leased_at timestamptz,
 provider_message_id text,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 CONSTRAINT litix_customer_delivery_updates_event_unique UNIQUE (order_id,fingerprint)
);
CREATE INDEX IF NOT EXISTS litix_customer_delivery_updates_queue_idx
 ON public.litix_customer_delivery_updates(send_state,next_attempt_at,created_at)
 WHERE send_state IN ('queued','sending');
