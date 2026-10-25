-- Isolated Preview database only. Jobs must be inserted by an authorized operator
-- from verified merchant transaction history and the approved billing schedule.
-- Never accept transaction IDs or coverage dates from a customer/browser.
create table if not exists litix_monthly_settlement_jobs (
 id bigint generated always as identity primary key,
 subscription_id uuid not null references litix_monthly_subscriptions(id),
 transaction_id text not null unique check(transaction_id ~ '^[1-9][0-9]{0,19}$'),
 period_start timestamptz not null,
 period_end timestamptz not null check(period_end>period_start),
 state text not null default 'pending' check(state in ('pending','processing','applied','duplicate','review')),
 claimed_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default now()
);
