-- Staging-first, additive, no changes to existing orders, supplier routing or prices.
-- New listings are never eligible for paid checkout merely because they were imported.
create table if not exists public.litix_boostero_premium_catalog (
  supplier_service_id text primary key check (supplier_service_id ~ '^[0-9]{1,12}$'),
  platform text not null,
  kind text not null,
  service_name text not null,
  category text not null,
  wholesale_per_1000 numeric(18,6) not null check (wholesale_per_1000 > 0),
  retail_per_1000 numeric(20,8) not null check (retail_per_1000 > 0),
  supplier_min integer not null check (supplier_min > 0),
  supplier_max integer not null check (supplier_max >= supplier_min),
  storefront_min integer not null check (storefront_min >= supplier_min and storefront_min <= supplier_max),
  quantity_step integer not null default 1 check (quantity_step > 0),
  api_refill boolean not null default false,
  refill_days integer check (refill_days between 1 and 365),
  supplier_claim_non_drop boolean not null default false,
  verified_at timestamptz not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists litix_boostero_premium_platform_kind_price
  on public.litix_boostero_premium_catalog(platform,kind,retail_per_1000,supplier_service_id);
-- Only Default-type services verified via authenticated read-only supplier
-- inventory may be stored. No account or supplier credentials are stored here.
