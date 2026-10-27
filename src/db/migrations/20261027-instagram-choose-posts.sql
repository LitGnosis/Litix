-- Isolated Choose Your Posts ledger. Preview-only until tested and promoted.
-- Never update existing gateway, subscription, AutoLikes, bundle or standard order tables.
create table if not exists public.litix_choose_posts_orders (
 id text primary key check (id ~ '^ltx2_[a-f0-9-]{36}$'),
 email text not null,
 username text not null,
 service_id text not null,
 service_name text not null,
 quantity_each integer not null check(quantity_each>0),
 per1000 numeric(14,5) not null,
 total_cents integer not null check(total_cents>=500),
 payment_state text not null default 'created' check(payment_state in('created','processing','paid','review','declined','simulated')),
 fulfillment_state text not null default 'pending',
 payment_transaction_id text unique,
 idempotency_key text not null unique,
 request_hash text not null,
 tracking_token_hash text not null,
 payment_attempted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.litix_choose_posts_items (
 id text primary key,
 order_id text not null references public.litix_choose_posts_orders(id) on delete restrict,
 ordinal integer not null check (ordinal between 1 and 8),
 post_url text not null,
 quantity integer not null check(quantity>0),
 amount_cents integer not null check(amount_cents>0),
 state text not null default 'PENDING_PAYMENT' check (state in ('PENDING_PAYMENT','QUEUED','DISPATCHING','SUBMITTED','COMPLETED','RETRYABLE','UNKNOWN_OUTCOME','MANUAL_REVIEW')),
 supplier_order_id text unique,
 attempt_count integer not null default 0,
 attempt_started_at timestamptz,
 last_error text,
 supplier_status jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(order_id,ordinal),
 unique(order_id,post_url)
);
create index if not exists litix_choose_posts_pending_idx on public.litix_choose_posts_items(state,updated_at);
create index if not exists litix_choose_posts_order_idx on public.litix_choose_posts_items(order_id);
create table if not exists public.litix_choose_posts_attempts (
 id text primary key,
 item_id text not null references public.litix_choose_posts_items(id) on delete restrict,
 attempt_number integer not null,
 state text not null check(state in('STARTED','CONFIRMED','REJECTED','UNKNOWN_OUTCOME')),
 supplier_order_id text,
 error_code text,
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 unique(item_id,attempt_number)
);
