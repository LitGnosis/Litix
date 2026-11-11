-- Reviews are independent of existing payments, orders and supplier dispatch.
-- Publish only after moderation; no new public reviews are fabricated.
create table if not exists public.litix_premium_reviews (
 id uuid primary key,
 display_name text not null check(char_length(display_name) between 2 and 60),
 service_category text not null check(char_length(service_category) between 3 and 100),
 stars integer not null check(stars between 1 and 5),
 body text not null check(char_length(body) between 20 and 1200),
 image_url text,
 purchase_order_id text,
 verified_purchase boolean not null default false,
 fingerprint text not null,
 submission_day date not null default current_date,
 status text not null default 'pending' check(status in('pending','approved','rejected')),
 submitted_at timestamptz not null default now(),
 moderated_at timestamptz
);
create unique index if not exists litix_premium_reviews_daily_abuse
 on public.litix_premium_reviews(fingerprint,submission_day);
create index if not exists litix_premium_reviews_public
 on public.litix_premium_reviews(status,submitted_at desc) where status='approved';
