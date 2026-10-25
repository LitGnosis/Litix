-- Additive; isolated monthly database only. Never email-match legacy orders.
alter table litix_monthly_subscriptions add column if not exists customer_subject text;
create index if not exists litix_monthly_customer_idx on litix_monthly_subscriptions(customer_subject);
create table if not exists litix_customers (
 subject text primary key,
 verified_email text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists litix_customer_order_links (
 order_id text primary key,
 customer_subject text not null references litix_customers(subject),
 created_at timestamptz not null default now()
);
-- Only a verified checkout/ownership migration may create an order link.
