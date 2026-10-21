-- Prerequisites: existing package, supplier-order and PayKings bridge tables.
-- Additive preparation only. Does not create payment orders or enable checkout.
begin;
alter table litix_package_purchases add column if not exists advertised_items jsonb;
alter table litix_package_purchases add column if not exists settled_transaction_id text;
create unique index if not exists litix_package_settled_transaction_unique
 on litix_package_purchases(settled_transaction_id) where settled_transaction_id is not null;

create or replace function litix_activate_paid_bundle(p_purchase_id text)
returns boolean language plpgsql security invoker as $$
declare
 p litix_package_purchases%rowtype;
 o litix_supplier_orders%rowtype;
 g litix_paykings_checkout_orders%rowtype;
 item record;
begin
 select * into p from litix_package_purchases where id=p_purchase_id for update;
 if not found or p.status<>'pending_payment' then return false; end if;
 select * into o from litix_supplier_orders where id=p.payment_reference for update;
 if not found then raise exception 'Missing bundle payment order'; end if;
 select * into g from litix_paykings_checkout_orders where order_id=o.id for update;
 if not found then raise exception 'Missing verified settlement'; end if;
 if p.payment_provider is distinct from 'paykings'
 or o.payment_provider is distinct from 'paykings'
 or o.payment_status is distinct from 'paid' or g.payment_state is distinct from 'settled'
 or g.currency is distinct from 'USD' or p.price_cents<=0
 or o.retail_cents is distinct from p.price_cents or g.amount_cents is distinct from p.price_cents
 or o.customer_id is distinct from p.customer_id or g.customer_id is distinct from p.customer_id
 or nullif(p.customer_id,'') is null or nullif(p.email,'') is null
 or lower(o.customer_email) is distinct from lower(p.email)
 or lower(g.billing_email) is distinct from lower(p.email)
 or coalesce(g.gateway_transaction_id,'') !~ '^[0-9]{4,40}$'
 or o.payment_reference is distinct from g.gateway_transaction_id
 then raise exception 'Bundle settlement mismatch'; end if;
 if p.advertised_items is null or jsonb_typeof(p.advertised_items)<>'object'
 or p.advertised_items='{}'::jsonb then raise exception 'Missing advertised items'; end if;
 if exists(select 1 from litix_package_balances where purchase_id=p.id)
 then raise exception 'Pending bundle already has credits'; end if;
 for item in select key,value from jsonb_each_text(p.advertised_items) loop
  if item.key not in ('Likes','Views','Impressions','Shares','Saves','Reposts')
  or item.value !~ '^[1-9][0-9]{0,14}$' then raise exception 'Invalid advertised item'; end if;
  insert into litix_package_balances(purchase_id,kind,total_quantity,remaining_quantity)
   values(p.id,item.key,item.value::bigint,item.value::bigint);
 end loop;
 update litix_package_purchases set status='active',settled_transaction_id=g.gateway_transaction_id,updated_at=now() where id=p.id;
 return true;
end;
$$;
-- Only the application/database owner should invoke this function.
revoke all on function litix_activate_paid_bundle(text) from public;
commit;
