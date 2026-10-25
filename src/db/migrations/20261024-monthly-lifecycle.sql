-- Depends on 20261024-monthly-subscriptions.sql. Not applied automatically.
alter table litix_monthly_subscriptions add column if not exists idempotency_key uuid unique;
alter table litix_monthly_subscriptions add column if not exists creation_state text not null default 'reserved' check (creation_state in ('reserved','dispatching','created','review'));
alter table litix_monthly_subscriptions add column if not exists link_delivery_state text not null default 'pending' check (link_delivery_state in ('pending','delivered','review'));
-- Atomic renewal application: callers must first verify a gateway transaction,
-- not merely authenticate a webhook. Run all mutations in one transaction.
create or replace function litix_monthly_apply_settlement(
 p_subscription uuid,p_transaction text,p_amount integer,p_currency text,
 p_start timestamptz,p_end timestamptz
) returns boolean language plpgsql as $$
declare s litix_monthly_subscriptions%rowtype; inserted integer;
begin
 select * into s from litix_monthly_subscriptions where id=p_subscription for update;
 if not found or s.provider_subscription_id is null or p_amount<>s.amount_cents or p_currency<>'USD' or p_end<=p_start or p_start>now() then
 raise exception 'Settlement mismatch'; end if;
 insert into litix_monthly_settlements(transaction_id,subscription_id,amount_cents,currency,period_start,period_end,verified_at)
 values(p_transaction,p_subscription,p_amount,p_currency,p_start,p_end,now()) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then return false; end if;
 update litix_monthly_subscriptions set paid_through=greatest(coalesce(paid_through,p_end),p_end),billing_state=case when p_end>now() then 'active' else billing_state end,updated_at=now() where id=p_subscription;
 return true;
end $$;
