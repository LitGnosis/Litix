create table if not exists litix_package_purchases (
  id text primary key,
  customer_id text not null,
  email text not null,
  package_id text not null,
  package_name text not null,
  platform text not null,
  price_cents integer not null check(price_cents >= 0),
  reference_price_cents integer not null check(reference_price_cents >= 0),
  markup_percent numeric(8,2) not null default 50,
  payment_provider text not null,
  payment_reference text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists litix_package_purchases_customer_idx on litix_package_purchases(customer_id,created_at desc);
create table if not exists litix_package_balances (
  purchase_id text not null references litix_package_purchases(id) on delete cascade,
  kind text not null,
  total_quantity bigint not null check(total_quantity >= 0),
  remaining_quantity bigint not null check(remaining_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(purchase_id,kind)
);
create table if not exists litix_package_redemptions (
  id text primary key,
  purchase_id text not null references litix_package_purchases(id) on delete cascade,
  customer_id text not null,
  kind text not null,
  quantity bigint not null check(quantity > 0),
  target text not null,
  order_id text not null,
  provider_order_id text,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists litix_package_redemptions_purchase_idx on litix_package_redemptions(purchase_id,created_at desc);
