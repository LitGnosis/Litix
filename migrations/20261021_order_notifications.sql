CREATE TABLE IF NOT EXISTS public.litix_order_notifications (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.litix_supplier_orders(id),
  event_type text NOT NULL CHECK (event_type IN ('created','paid','submitted','completed','attention')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','retry','sent','dead')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  leased_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (order_id,event_type)
);
