-- Owner wholesale purchasing ledger. Additive ONLY. No modifications to public checkout orders.
-- Do not apply to production until Auth0 owner identity, security review, and zero-charge tests pass.
create table if not exists public.litix_owner_wholesale_orders (
 id text primary key check (id ~ '^low_[0-9a-f-]{36}$'),
 owner_sub text not null,
 idempotency_key text not null,
 fingerprint text not null,
 provider text not null check(provider in('smmglob','boostero')),
 supplier_service_id text not null check(supplier_service_id ~ '^[0-9]{1,12}$'),
 service_name text not null,
 destination text not null,
 quantity integer not null check(quantity>0),
 wholesale_per_1000 numeric(16,6) not null check(wholesale_per_1000>0),
 refill_days integer,
 refill_eligible boolean not null default false,
 refill_method text not null default 'not advertised',
 supplier_cost_cents integer not null check(supplier_cost_cents>0),
 total_charge_cents integer not null check(total_charge_cents>0),
 payment_method text not null check(payment_method in('supplier_balance','paykings')),
 payment_state text not null check(payment_state in('not_required','processing','approved_pending_settlement','paid','review','declined')),
 payment_transaction_id text unique,
 state text not null default 'QUEUED' check(state in('QUEUED','DISPATCHING','SUBMITTED','COMPLETED','REJECTED','UNKNOWN_OUTCOME','FAILED')),
 supplier_order_id text,
 supplier_status jsonb not null default '{}'::jsonb,
 last_checked_at timestamptz,
 attempt_id text unique,
 baseline_followers integer check(baseline_followers>=0),
 notification_state text not null default 'PENDING',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_sub,idempotency_key),
 unique(provider,supplier_order_id)
);
create index if not exists litix_owner_wholesale_open_idx on public.litix_owner_wholesale_orders(state,last_checked_at);
create table if not exists public.litix_owner_wholesale_attempts (
 id text primary key,
 order_id text not null references public.litix_owner_wholesale_orders(id) on delete restrict,
 action text not null check(action in ('add')),
 state text not null check(state in ('STARTED','CONFIRMED','REJECTED','UNKNOWN_OUTCOME')),
 supplier_order_id text,
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 unique(order_id,action)
);

-- Prevent two parallel idempotency keys buying the same active owner intent.
create unique index if not exists litix_owner_wholesale_active_intent_unique
 on public.litix_owner_wholesale_orders(owner_sub,fingerprint)
 where state in ('QUEUED','DISPATCHING','SUBMITTED','UNKNOWN_OUTCOME');
