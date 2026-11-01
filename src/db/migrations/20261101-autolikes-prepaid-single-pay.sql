-- Additive isolated prepaid AutoLikes order ledger. No subscription billing.
-- Separate from Litix's existing one-time orders and payments.
CREATE TABLE IF NOT EXISTS public.litix_autolikes_prepaid_orders(
 id text PRIMARY KEY CHECK(id ~ '^alp_[a-f0-9-]{36}$'),
 idempotency_key uuid NOT NULL UNIQUE,
 email text NOT NULL,
 public_token_hash char(64) NOT NULL UNIQUE CHECK(public_token_hash ~ '^[a-f0-9]{64}$'),
 platform text NOT NULL CHECK(platform IN('instagram','tiktok')),
 target_profile_url text NOT NULL,
 target_handle text NOT NULL,
 tier_id text NOT NULL,
 service_id text NOT NULL CHECK(service_id ~ '^[0-9]{1,12}$'),
 likes_per_post integer NOT NULL CHECK(likes_per_post BETWEEN 1 AND 1000000),
 posts_limit integer NOT NULL CHECK(posts_limit BETWEEN 1 AND 10),
 amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 100 AND 2000000),
 wholesale_reserved_cents bigint NOT NULL CHECK(wholesale_reserved_cents >= 1),
 payment_status text NOT NULL DEFAULT 'PROCESSING' CHECK(payment_status IN('PROCESSING','PAID','DECLINED','REVIEW')),
 fulfillment_state text NOT NULL DEFAULT 'AWAITING_PAYMENT' CHECK(fulfillment_state IN('AWAITING_PAYMENT','QUEUED','CLAIMED','SUBMITTED','COMPLETED','MANUAL_REVIEW','UNKNOWN_OUTCOME','EXPIRED')),
 payment_transaction_id text UNIQUE,
 supplier_order_id text UNIQUE,
 claim_token uuid UNIQUE,
 paid_at timestamptz,
 period_end timestamptz,
 supplier_status text,
 error_code text,
 last_checked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((payment_status='PAID' AND paid_at IS NOT NULL AND payment_transaction_id IS NOT NULL)
        OR payment_status <> 'PAID'),
 CHECK (fulfillment_state IN('AWAITING_PAYMENT','MANUAL_REVIEW','UNKNOWN_OUTCOME')
   OR payment_status='PAID')
);
CREATE INDEX IF NOT EXISTS litix_autolikes_prepaid_pending
 ON public.litix_autolikes_prepaid_orders(fulfillment_state,created_at)
 WHERE fulfillment_state IN('QUEUED','SUBMITTED','MANUAL_REVIEW','UNKNOWN_OUTCOME');
ALTER TABLE public.litix_autolikes_prepaid_orders ENABLE ROW LEVEL SECURITY;
