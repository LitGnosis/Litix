-- Internal worker function only. A trusted platform adapter must verify post ownership first.
create or replace function litix_monthly_claim_post(p_subscription uuid,p_subject text,p_post text,p_published timestamptz)
returns text language plpgsql as $$
declare s litix_monthly_subscriptions%rowtype; slot integer; day date;
begin
 if p_post is null or length(p_post)<1 or length(p_post)>200 or p_published>now() then return 'invalid'; end if;
 select * into s from litix_monthly_subscriptions where id=p_subscription and customer_subject=p_subject for update;
 if not found then return 'not_found'; end if;
 if exists(select 1 from litix_monthly_post_claims where subscription_id=s.id and post_id=p_post) then return 'duplicate'; end if;
 -- Require a settled billing period containing this post, plus currently valid paid coverage.
 if s.billing_state<>'active' or s.paid_through is null or s.paid_through<=now() or not exists(
 select 1 from litix_monthly_settlements where subscription_id=s.id and period_start<=p_published and period_end>p_published
 ) then return 'not_paid'; end if;
 day=(p_published at time zone 'UTC')::date;
 select candidate into slot from generate_series(1,3) candidate where not exists(
 select 1 from litix_monthly_post_claims where subscription_id=s.id and utc_day=day and daily_slot=candidate
 ) order by candidate limit 1;
 if slot is null then return 'daily_limit'; end if;
 insert into litix_monthly_post_claims(subscription_id,post_id,utc_day,daily_slot) values(s.id,p_post,day,slot);
 return 'claimed';
end $$;
