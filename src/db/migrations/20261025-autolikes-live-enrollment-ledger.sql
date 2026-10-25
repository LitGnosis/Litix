-- Live AutoLikes subscription request/audit state machines.
-- Additive only. Does NOT charge customers or enable recurring billing.
-- Subscription provider operations must be claimed ONCE before any network call.
-- Apply after 20261023-platform-foundation.sql and 20261025-autolikes-billing-guardrails.sql.
create table if not exists litix_autolikes_subscription_attempts (
  id text primary key,
  campaign_id text not null references litix_auto_boost_campaigns(id) on delete restrict,
  customer_id text not null,
  workspace_id text not null references litix_workspaces(id) on delete restrict,
  request_key uuid not null,
  provider text not null default 'nmi' check (provider='nmi'),
  quote_sha256 char(64) not null check (quote_sha256 ~ '^[a-f0-9]{64}$'),
  monthly_amount_cents integer not null check (monthly_amount_cents between 100 and 2000000),
  state text not null default 'INITIATING' check (state in ('INITIATING','AWAITING_VERIFICATION','DECLINED','UNKNOWN_OUTCOME','RECONCILED','CANCELLED')),
  provider_subscription_item_id text,
  last_gateway_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(customer_id,campaign_id,request_key),
  unique(provider_subscription_item_id)
);
create unique index if not exists litix_autolikes_one_unreconciled_attempt
 on litix_autolikes_subscription_attempts(campaign_id)
 where state in ('INITIATING','AWAITING_VERIFICATION','UNKNOWN_OUTCOME');
create index if not exists litix_autolikes_attempts_review
 on litix_autolikes_subscription_attempts(state,created_at)
 where state in ('INITIATING','UNKNOWN_OUTCOME');
create table if not exists litix_autolikes_cancellation_attempts (
 id text primary key,
 subscription_id text not null references litix_recurring_subscriptions(id) on delete restrict,
 customer_id text not null,
 state text not null default 'REQUESTED' check(state in ('REQUESTED','CANCELLED','UNKNOWN_OUTCOME','RECONCILED')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(subscription_id)
);
-- Do not expose these tables directly to browsers. The server authorizes every query.
alter table litix_autolikes_subscription_attempts enable row level security;
alter table litix_autolikes_cancellation_attempts enable row level security;
