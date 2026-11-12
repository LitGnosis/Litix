-- Additive, isolated Boostero rollout. Initial allowlist is EMPTY and all routes are disabled by env gates.
-- Apply to staging first. Do not delete or change any existing SMMGLOB records.
create table if not exists public.litix_boostero_services (
 supplier_service_id text primary key check(supplier_service_id ~ '^[0-9]{1,12}$'),
 platform text not null check(platform in ('instagram','tiktok')),
 retail_per_1000_cents integer not null check(retail_per_1000_cents>=600),
 wholesale_ceiling_per_1000 numeric(16,6) not null check(wholesale_ceiling_per_1000>0),
 enabled boolean not null default false,
 approved_by text,
 approved_at timestamptz
);
create table if not exists public.litix_boostero_fulfillment (
 litix_order_id text primary key references public.litix_v2_orders(id) on delete restrict,
 supplier_service_id text not null references public.litix_boostero_services(supplier_service_id) on delete restrict,
 payment_mode text not null check(payment_mode in('card','admin')),
 state text not null default 'PENDING_PAYMENT' check(state in('PENDING_PAYMENT','QUEUED','DISPATCHING','SUBMITTED','COMPLETED','REJECTED','UNKNOWN_OUTCOME','FAILED','MANUAL_REVIEW')),
 supplier_order_id text unique,
 purchase_attempt_id text unique,
 attempted_at timestamptz,
 supplier_status jsonb not null default '{}'::jsonb,
 checked_at timestamptz,
 error_code text,
 approved_admin_id text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists litix_boostero_fulfillment_states_idx on public.litix_boostero_fulfillment(state,updated_at);
create table if not exists public.litix_boostero_attempts (
 id text primary key,
 litix_order_id text not null references public.litix_boostero_fulfillment(litix_order_id) on delete restrict,
 kind text not null check(kind in('add','refill')),
 state text not null check(state in('STARTED','CONFIRMED','REJECTED','UNKNOWN_OUTCOME')),
 supplier_order_id text,
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 error_code text,
 unique(litix_order_id,kind)
);
-- At most ONE real add attempt for each paid/admin-approved order.
-- No automated retry on timeout or unknown responses.
