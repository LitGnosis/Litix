-- Litix AutoLikes: additive, opt-in ledger for ONE supplier-native subscription
-- per independently verified NMI paid monthly billing period.
-- No API call, payment, cron, or existing order changes when applying.
CREATE TABLE IF NOT EXISTS public.litix_autolikes_native_cycles (
 id text PRIMARY KEY,
 subscription_id text NOT NULL REFERENCES public.litix_autolikes_live_subscriptions(id) ON DELETE RESTRICT,
 provider_transaction_id text NOT NULL UNIQUE,
 period_key text NOT NULL CHECK (period_key ~ '^20[0-9]{2}-[0-9]{2}$'),
 paid_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 100 AND 2000000),
 state text NOT NULL DEFAULT 'QUEUED'
  CHECK (state IN ('QUEUED','DISPATCHING','SUBMITTED','MANUAL_REVIEW','UNKNOWN_OUTCOME','COMPLETED')),
 attempt_id uuid,
 claimed_at timestamptz,
 supplier_order_id text UNIQUE,
 error_code text,
 last_checked_at timestamptz,
 supplier_status text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(subscription_id,period_key),
 CHECK (expires_at > paid_at)
);
CREATE INDEX IF NOT EXISTS litix_autolikes_native_cycles_queue
 ON public.litix_autolikes_native_cycles(state,created_at)
 WHERE state IN ('QUEUED','SUBMITTED','UNKNOWN_OUTCOME','MANUAL_REVIEW');
ALTER TABLE public.litix_autolikes_native_cycles ENABLE ROW LEVEL SECURITY;

-- Separate bearer-secret portal. No public lookup by email or supplier order ID.
CREATE TABLE IF NOT EXISTS public.litix_autolikes_native_portal (
 subscription_id text PRIMARY KEY REFERENCES public.litix_autolikes_live_subscriptions(id) ON DELETE RESTRICT,
 email text NOT NULL,
 token_sha256 char(64) NOT NULL UNIQUE CHECK (token_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.litix_autolikes_native_portal ENABLE ROW LEVEL SECURITY;
