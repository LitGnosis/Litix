-- Additive creator lead and agency referral attribution only.
-- Must be applied to the verified STAGING DB first, with an approved production backup.
-- No payments, existing orders, supplier dispatch or AutoLikes data are modified.
create table if not exists public.litix_affiliate_partners (
 code varchar(24) primary key check (code ~ '^[a-f0-9]{24}$'),
 label varchar(100) not null,
 active boolean not null default false,
 click_count bigint not null default 0 check (click_count >= 0),
 created_at timestamptz not null default now(),
 approved_at timestamptz
);
create table if not exists public.litix_creator_signups (
 id uuid primary key default gen_random_uuid(),
 email varchar(254) not null unique,
 status varchar(16) not null default 'pending' check (status in ('pending','confirmed','unsubscribed')),
 request_consent_at timestamptz not null default now(),
 confirmed_at timestamptz,
 confirm_hash char(64),
 confirm_expires_at timestamptz,
 last_email_sent_at timestamptz not null default now(),
 utm_source varchar(64),
 utm_medium varchar(64),
 utm_campaign varchar(64),
 utm_content varchar(64),
 affiliate_code varchar(24) references public.litix_affiliate_partners(code) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check ((status <> 'pending') or (confirm_hash is not null and confirm_expires_at is not null))
);
create index if not exists litix_creator_signups_source_idx
 on public.litix_creator_signups(utm_source,utm_campaign,created_at desc);
create index if not exists litix_creator_signups_affiliate_idx
 on public.litix_creator_signups(affiliate_code,status,created_at desc)
 where affiliate_code is not null;
-- Server-only SQL credentials required. Never expose these tables through public APIs.
revoke all on public.litix_creator_signups from public;
revoke all on public.litix_affiliate_partners from public;
