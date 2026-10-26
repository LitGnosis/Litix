-- ADDITIVE isolated Growth Bundle tables. Existing orders, pricing and supplier dispatch untouched.
create table if not exists litix_growth_bundle_orders (
 id text primary key, email text not null, customer_id text,
 package_id text not null, platform text not null, package_name text not null,
 price_cents integer not null check(price_cents>0), package_items jsonb not null,
 max_posts integer not null default 10 check(max_posts=10),
 payment_state text not null default 'awaiting_payment' check(payment_state in
 ('awaiting_payment','processing','approved_pending_settlement','settled','declined','review','refunded')),
 order_state text not null default 'Awaiting Payment' check(order_state in
 ('Awaiting Payment','Awaiting WhatsApp Submission','Under Review','Approved','Processing','Partially Completed','Completed','Needs Attention')),
 gateway_transaction_id text unique, idempotency_key text not null unique,
 approved_at timestamptz, settled_at timestamptz, terms_accepted_at timestamptz not null,
 profile_ref text, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists litix_growth_bundle_posts (
 id text primary key,
 order_id text not null references litix_growth_bundle_orders(id),
 post_url text not null, proof_ref text,
 status text not null default 'Under Review' check(status in ('Under Review','Approved','Rejected','Processing','Completed','Needs Attention')),
 allocations jsonb not null default '{}'::jsonb,
 approved_at timestamptz, created_at timestamptz not null default now(),
 unique(order_id,post_url)
);
create index if not exists litix_growth_bundle_posts_order on litix_growth_bundle_posts(order_id);
create table if not exists litix_growth_bundle_supplier_mappings(
 platform text not null check(platform in ('Instagram','TikTok')),
 kind text not null check(kind in ('Likes','Views','Impressions','Shares','Saves','Reposts')),
 service_id text not null, min_qty integer not null check(min_qty>0),
 max_qty integer not null check(max_qty>=min_qty),
 refill_days integer check(refill_days>=0),verified_at timestamptz not null,
 primary key(platform,kind)
);
create table if not exists litix_growth_bundle_dispatch (
 id text primary key, post_id text not null references litix_growth_bundle_posts(id),
 kind text not null, quantity integer not null check(quantity>0),
 supplier_order_id text unique,
 status text not null default 'reserved' check(status in ('reserved','submitted','unknown','declined','completed','partial','needs_attention')),
 attempted_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(post_id,kind)
);
create table if not exists litix_growth_bundle_audit (
 id text primary key, order_id text not null references litix_growth_bundle_orders(id),
 admin_action text not null, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists litix_growth_bundle_audit_order on litix_growth_bundle_audit(order_id,created_at desc);
alter table litix_growth_bundle_orders enable row level security;
alter table litix_growth_bundle_posts enable row level security;
alter table litix_growth_bundle_supplier_mappings enable row level security;
alter table litix_growth_bundle_dispatch enable row level security;
alter table litix_growth_bundle_audit enable row level security;
