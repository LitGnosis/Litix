-- Litix Native partner trial ledger, additive and isolated from paid customer orders.
-- Execute only after a separately reviewed database change/backup.
-- No NMI/PayKings payment data, card tokens, or customer passwords are stored.
create table if not exists public.litix_native_partner_orders (
 id uuid primary key,
 partner_id text not null check(length(partner_id) between 2 and 40),
 request_id text not null check(length(request_id) between 8 and 64),
 service_id text not null check(service_id in ('litix-native-caption-kit','litix-native-link-page','litix-native-campaign-plan')),
 request_hash char(64) not null,
 filename text not null check(length(filename) between 5 and 110),
 mime_type text not null check(length(mime_type) between 5 and 80),
 sha256 char(64) not null,
 content text not null check(octet_length(content)<=50000),
 status text not null default 'COMPLETED' check(status='COMPLETED'),
 created_at timestamptz not null default now(),
 unique (partner_id,request_id)
);
create index if not exists litix_native_partner_orders_partner_date
  on public.litix_native_partner_orders(partner_id,created_at desc);
comment on table public.litix_native_partner_orders is
  'Isolated, original digital-file free-trial deliveries for authorized reseller agencies. Not paid orders or artificial engagement.';
-- Do NOT grant anonymous/public read or write on this table.
-- Activate only after enabling LITIX_NATIVE_PARTNER_ORDERS_ENABLED=true
-- and separately setting LITIX_NATIVE_PARTNER_API_CONFIG with hashed API keys.
