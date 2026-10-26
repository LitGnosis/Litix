-- Additive AutoLikes cancellation attempt ledger. Does not affect one-time orders.
CREATE TABLE IF NOT EXISTS litix_autolikes_live_cancellations (
 id text PRIMARY KEY,
 subscription_id text NOT NULL UNIQUE REFERENCES litix_autolikes_live_subscriptions(id) ON DELETE RESTRICT,
 subscriber_id text NOT NULL,
 gateway_subscription_id text NOT NULL,
 state text NOT NULL DEFAULT 'REQUESTED' CHECK(state IN ('REQUESTED','CONFIRMED','UNKNOWN_OUTCOME')),
 provider_response_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS litix_autolikes_live_cancellations_user_idx ON litix_autolikes_live_cancellations(subscriber_id,created_at DESC);
ALTER TABLE litix_autolikes_live_cancellations ENABLE ROW LEVEL SECURITY;
