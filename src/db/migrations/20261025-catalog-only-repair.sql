-- Standalone additive catalog repair. No checkout/order/customer tables touched.
-- Apply to isolated DB first; production requires separate explicit approval.
create table if not exists litix_catalog_prices (
 service_id integer primary key,
 service_name text not null,
 base_rate numeric(18,6) not null check (base_rate>=0),
 retail_rate numeric(18,6) not null check (retail_rate>=base_rate),
 updated_at timestamptz not null default now()
);
-- Rollback: do not drop catalog data. Revert application change; retain table.
