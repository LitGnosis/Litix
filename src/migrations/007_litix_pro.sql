alter table litix_supplier_orders add column if not exists payment_provider text;
alter table litix_supplier_orders add column if not exists payment_reference text;
alter table litix_supplier_orders add column if not exists start_count bigint;
alter table litix_supplier_orders add column if not exists refill_eligible boolean not null default false;
alter table litix_supplier_orders add column if not exists cancel_eligible boolean not null default false;

create table if not exists litix_api_keys (
  id text primary key,
  customer_id text not null,
  key_hash text not null unique,
  key_prefix text not null,
  label text not null default 'Default',
  active boolean not null default true,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists litix_api_keys_customer_idx on litix_api_keys(customer_id,created_at desc);

create table if not exists litix_wallets (
  customer_id text primary key,
  currency text not null default 'USD',
  balance_cents bigint not null default 0 check(balance_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists litix_wallet_transactions (
  id text primary key,
  customer_id text not null,
  type text not null,
  amount_cents bigint not null,
  currency text not null default 'USD',
  status text not null default 'completed',
  payment_provider text,
  payment_reference text,
  order_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists litix_wallet_transactions_customer_idx on litix_wallet_transactions(customer_id,created_at desc);

create table if not exists litix_service_catalog (
  id text primary key,
  provider text not null,
  provider_service_id text not null,
  platform text not null,
  kind text not null,
  tier text not null,
  public_name text not null,
  description text,
  min_quantity bigint not null,
  max_quantity bigint not null,
  provider_rate numeric not null,
  provider_currency text not null,
  provider_rate_usd numeric not null,
  refill_eligible boolean not null default false,
  cancel_eligible boolean not null default false,
  drip_feed_eligible boolean not null default false,
  subscription_eligible boolean not null default false,
  input_type text not null default 'url',
  is_active boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,provider_service_id)
);
create index if not exists litix_service_catalog_lookup_idx on litix_service_catalog(platform,kind,tier,is_active,priority);

create table if not exists litix_bulk_batches (
  id text primary key,
  customer_id text not null,
  email text not null,
  status text not null,
  total_orders integer not null default 0,
  completed_orders integer not null default 0,
  failed_orders integer not null default 0,
  total_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists litix_bulk_batches_customer_idx on litix_bulk_batches(customer_id,created_at desc);

create table if not exists litix_campaigns (
  id text primary key,
  customer_id text not null,
  email text not null,
  mode text not null default 'drip_feed',
  service_catalog_id text not null,
  target text not null,
  quantity_per_run bigint not null,
  runs integer not null,
  interval_minutes integer not null,
  status text not null default 'active',
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists litix_campaigns_due_idx on litix_campaigns(status,next_run_at);
create index if not exists litix_campaigns_customer_idx on litix_campaigns(customer_id,created_at desc);

create table if not exists litix_refills (
  id text primary key,
  order_id text not null,
  customer_id text not null,
  provider text not null,
  provider_refill_id text,
  status text not null default 'Pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists litix_refills_order_idx on litix_refills(order_id,created_at desc);

create table if not exists litix_cancellations (
  id text primary key,
  order_id text not null,
  customer_id text not null,
  provider text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists litix_cancellations_order_idx on litix_cancellations(order_id,created_at desc);
