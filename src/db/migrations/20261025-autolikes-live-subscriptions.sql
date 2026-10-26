-- AutoLikes only. PostgreSQL/Neon, not Prisma. Additive migration.
-- An Auth0 user is referenced by the stable campaign.customer_id.
CREATE TABLE IF NOT EXISTS litix_autolikes_live_subscriptions (
  id text PRIMARY KEY,
  campaign_id text NOT NULL UNIQUE REFERENCES litix_auto_boost_campaigns(id) ON DELETE RESTRICT,
  subscriber_id text NOT NULL,
  provider_subscription_id text NOT NULL UNIQUE,
  target_profile_url text NOT NULL,
  target_handle text NOT NULL,
  platform text NOT NULL CHECK(platform IN ('instagram','tiktok')),
  service_id text NOT NULL CHECK(service_id ~ '^[0-9]+$'),
  max_likes_per_post integer NOT NULL CHECK(max_likes_per_post > 0),
  monthly_post_limit integer NOT NULL CHECK(monthly_post_limit BETWEEN 1 AND 60),
  posts_remaining integer NOT NULL DEFAULT 0 CHECK(posts_remaining BETWEEN 0 AND 60),
  amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 100 AND 2000000),
  status text NOT NULL DEFAULT 'PAUSED' CHECK(status IN ('ACTIVE','PAUSED','CANCELLED')),
  payment_status text NOT NULL DEFAULT 'PENDING' CHECK(payment_status IN ('PENDING','PAID','FAILED','REFUNDED')),
  billing_cycle_end timestamptz,
  last_paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (posts_remaining <= monthly_post_limit)
);
CREATE INDEX IF NOT EXISTS litix_autolikes_live_owner_idx ON litix_autolikes_live_subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS litix_autolikes_live_profile_idx ON litix_autolikes_live_subscriptions(platform,target_handle,status);
CREATE TABLE IF NOT EXISTS litix_autolikes_live_gateway_events (
  event_id text PRIMARY KEY,
  provider_subscription_id text NOT NULL REFERENCES litix_autolikes_live_subscriptions(provider_subscription_id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  transaction_id text UNIQUE,
  payload_sha256 char(64) NOT NULL CHECK(payload_sha256 ~ '^[a-f0-9]{64}$'),
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS litix_autolikes_live_posts (
  id text PRIMARY KEY,
  subscription_id text NOT NULL REFERENCES litix_autolikes_live_subscriptions(id) ON DELETE RESTRICT,
  platform text NOT NULL,
  media_id text NOT NULL,
  post_url text NOT NULL,
  state text NOT NULL DEFAULT 'QUEUED' CHECK(state IN ('QUEUED','CLAIMED','SUBMITTED','UNKNOWN_OUTCOME','DECLINED')),
  supplier_name text,
  supplier_order_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  finished_at timestamptz,
  UNIQUE(subscription_id,media_id),
  UNIQUE(subscription_id,post_url)
);
CREATE INDEX IF NOT EXISTS litix_autolikes_live_posts_queue_idx
 ON litix_autolikes_live_posts(state,created_at) WHERE state='QUEUED';
-- Atomic database-side reservation. Prevents duplicate orders and overspending quota.
CREATE OR REPLACE FUNCTION litix_claim_autolikes_live_post(p_post_id text)
RETURNS TABLE(post_id text, post_url text, service_id text, likes integer, platform text)
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE p record; s record;
BEGIN
 SELECT * INTO p FROM litix_autolikes_live_posts WHERE id=p_post_id FOR UPDATE;
 IF NOT FOUND OR p.state <> 'QUEUED' THEN RETURN; END IF;
 SELECT * INTO s FROM litix_autolikes_live_subscriptions WHERE id=p.subscription_id FOR UPDATE;
 IF NOT FOUND OR s.status <> 'ACTIVE' OR s.payment_status <> 'PAID'
   OR s.billing_cycle_end IS NULL OR s.billing_cycle_end <= now()
   OR s.posts_remaining <= 0 THEN RETURN; END IF;
 UPDATE litix_autolikes_live_subscriptions SET posts_remaining=posts_remaining-1, updated_at=now()
 WHERE id=s.id;
 UPDATE litix_autolikes_live_posts SET state='CLAIMED',claimed_at=now() WHERE id=p.id;
 RETURN QUERY SELECT p.id::text,p.post_url::text,s.service_id::text,s.max_likes_per_post::integer,s.platform::text;
END $$;
-- Server connections use the Neon database role; browser must have no table access.
ALTER TABLE litix_autolikes_live_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE litix_autolikes_live_gateway_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE litix_autolikes_live_posts ENABLE ROW LEVEL SECURITY;
