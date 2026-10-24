-- Review/apply separately to an isolated database first. Does not activate billing.
create table if not exists litix_monthly_subscriptions (
 id uuid primary key,
 management_token_hash char(64) not null unique,
 management_token_expires_at timestamptz not null,
 provider_subscription_id text unique,
 email text not null,
 likes_per_post integer not null check (likes_per_post in (100,150,250,1000,2000)),
 amount_cents integer not null check (amount_cents > 0),
 currency text not null default 'USD' check (currency='USD'),
 daily_post_limit integer not null default 3 check (daily_post_limit=3),
 consent_version text not null,
 consent_at timestamptz not null,
 billing_state text not null default 'pending' check (billing_state in ('pending','active','past_due','review','expired')),
 cancellation_state text not null default 'none' check (cancellation_state in ('none','requested','dispatching','review','confirmed')),
 cancellation_requested_at timestamptz,
 cancellation_attempted_at timestamptz,
 cancellation_confirmed_at timestamptz,
 cancellation_result_code text,
 paid_through timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists litix_monthly_settlements (
 transaction_id text primary key,
 subscription_id uuid not null references litix_monthly_subscriptions(id),
 amount_cents integer not null check(amount_cents>0),
 currency text not null check(currency='USD'),
 period_start timestamptz not null,
 period_end timestamptz not null check(period_end>period_start),
 verified_at timestamptz not null,
 unique(subscription_id,period_start)
);
-- Future workers must claim a UTC day allowance atomically, not count in browser state.
create table if not exists litix_monthly_post_claims (
 subscription_id uuid not null references litix_monthly_subscriptions(id),
 post_id text not null,
 utc_day date not null,
 daily_slot integer not null check(daily_slot between 1 and 3),
 state text not null default 'pending' check(state in ('pending','submitted','review','rejected')),
 supplier_order_id text,
 primary key(subscription_id,post_id),
 unique(subscription_id,utc_day,daily_slot)
);
