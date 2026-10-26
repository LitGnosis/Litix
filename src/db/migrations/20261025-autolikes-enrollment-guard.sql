-- New AutoLikes enrollment ledger. Review before applying.
-- Does not enable the gateway, post watchers, recurring charges or supplier dispatch.
-- Stores NO payment tokens, card details, checkout secret keys or personally identifying emails.
CREATE TABLE IF NOT EXISTS litix_autolikes_enrollment_attempts (
  id text primary key,
  customer_id text not null,
  campaign_id text not null references litix_auto_boost_campaigns(id) on delete restrict,
  request_key text not null,
  quoted_amount_cents bigint not null check (quoted_amount_cents between 100 and 2000000),
  price_fingerprint char(64) not null,
  consent_at timestamptz not null,
  consent_version text not null,
  status text not null default 'REQUESTED'
    check (status in ('REQUESTED','GATEWAY_APPROVED_PENDING_VERIFICATION','DECLINED','UNKNOWN_OUTCOME')),
  gateway_subscription_id text unique,
  response_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id,campaign_id,request_key)
);
-- Prevent independent request keys from triggering multiple subscriptions for a single campaign.
-- Ambiguous outcomes remain locked until reviewed and reconciled.
CREATE UNIQUE INDEX IF NOT EXISTS litix_autolikes_one_active_enrollment_per_campaign
  ON litix_autolikes_enrollment_attempts(campaign_id)
  WHERE status IN ('REQUESTED','UNKNOWN_OUTCOME','GATEWAY_APPROVED_PENDING_VERIFICATION');
CREATE INDEX IF NOT EXISTS litix_autolikes_enrollment_review_idx
  ON litix_autolikes_enrollment_attempts(status,created_at)
  WHERE status in ('REQUESTED','UNKNOWN_OUTCOME');
ALTER TABLE litix_autolikes_enrollment_attempts ENABLE ROW LEVEL SECURITY;
