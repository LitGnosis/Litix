-- AutoLikes subscription safety ledgers. Additive-only schema for Neon staging validation.
-- Does not enable collection, subscription creation, supplier orders, or any scheduler.
-- Apply only after 20261023-platform-foundation.sql and existing campaign table migration.
-- Review before deploying to production.

alter table litix_recurring_subscriptions add column if not exists campaign_id text;
alter table litix_recurring_subscriptions add column if not exists customer_id text;
alter table litix_profile_watchers add column if not exists campaign_id text;
alter table litix_profile_watchers add column if not exists customer_id text;
alter table litix_profile_events add column if not exists campaign_id text;

create unique index if not exists litix_recurring_campaign_active_unique
  on litix_recurring_subscriptions(campaign_id)
  where campaign_id is not null and status in ('PENDING','ACTIVE_PAID','PAST_DUE');

create index if not exists litix_recurring_owner_idx
  on litix_recurring_subscriptions(customer_id,created_at desc)
  where customer_id is not null;

create unique index if not exists litix_profile_events_unique_post
  on litix_profile_events(workspace_id,platform,post_url);

-- A unique post target for each campaign is allowed only one dispatch claim.
-- UNKNOWN_OUTCOME must be reconciled, never retried with an unrelated idempotency key.
create table if not exists litix_autolikes_delivery_claims(
  id text primary key,
  campaign_id text not null references litix_auto_boost_campaigns(id) on delete restrict,
  workspace_id text not null references litix_workspaces(id) on delete restrict,
  post_url text not null,
  service_id text not null,
  quantity integer not null check(quantity > 0),
  state text not null default 'QUEUED' check(state in ('QUEUED','CLAIMED','SUPPLIER_CONFIRMED','UNKNOWN_OUTCOME','FAILED','CANCELLED')),
  supplier_order_id text,
  request_fingerprint char(64) not null check(request_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id,post_url),
  unique(request_fingerprint),
  check(state <> 'SUPPLIER_CONFIRMED' or supplier_order_id is not null)
);
create index if not exists litix_autolikes_delivery_claims_review_idx
  on litix_autolikes_delivery_claims(state,created_at)
  where state in ('UNKNOWN_OUTCOME','FAILED');

-- Store only the verified-event fingerprint and nonsecret references, never card data.
create table if not exists litix_autolikes_billing_events(
  id text primary key,
  provider text not null check(provider in ('nmi')),
  provider_event_id text not null,
  provider_subscription_item_id text not null,
  event_type text not null check(event_type in ('PAYMENT_SUCCEEDED','PAYMENT_FAILED','SUBSCRIPTION_CANCELLED','SUBSCRIPTION_UPDATED')),
  signature_verified boolean not null default false,
  verified_at timestamptz,
  payload_sha256 char(64) not null check(payload_sha256 ~ '^[a-f0-9]{64}$'),
  received_at timestamptz not null default now(),
  unique(provider,provider_event_id),
  check(signature_verified=false or verified_at is not null)
);
create index if not exists litix_autolikes_billing_item_idx
  on litix_autolikes_billing_events(provider_subscription_item_id,received_at desc);

-- Private data: application API must check ownership; no direct browser table access.
alter table litix_recurring_subscriptions enable row level security;
alter table litix_profile_watchers enable row level security;
alter table litix_profile_events enable row level security;
alter table litix_autolikes_delivery_claims enable row level security;
alter table litix_autolikes_billing_events enable row level security;
