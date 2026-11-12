// Private, read-only owner reconciliation queue. No email addresses, card data,
// customer post URLs, tokens or credential material are queried or returned.
const QUERIES={
 partial:`select m.parent_order_id as order_id,m.ordinal,m.supplier_order_id,m.state,m.supplier_status->>'status' as supplier_status,m.checked_at
   from public.litix_boostero_multi_posts m
   join public.litix_v2_orders o on o.id=m.parent_order_id and o.payment_state='paid'
   where m.state in ('MANUAL_REVIEW','UNKNOWN_OUTCOME')
   order by m.updated_at desc limit 25`,
 stale:`select m.parent_order_id as order_id,m.ordinal,m.supplier_order_id,m.state,m.supplier_status->>'status' as supplier_status,m.checked_at
   from public.litix_boostero_multi_posts m
   join public.litix_v2_orders o on o.id=m.parent_order_id and o.payment_state='paid'
   where m.state='SUBMITTED' and m.supplier_order_id is not null
    and m.created_at<now()-interval '45 minutes'
    and (m.checked_at is null or m.checked_at<now()-interval '45 minutes')
   order by m.updated_at asc limit 25`,
 single:`select f.litix_order_id as order_id,f.supplier_order_id,f.state,f.checked_at
   from public.litix_boostero_fulfillment f
   join public.litix_v2_orders o on o.id=f.litix_order_id and o.payment_state='paid'
   where f.state in ('UNKNOWN_OUTCOME','MANUAL_REVIEW')
    and not exists (select 1 from public.litix_boostero_multi_posts m where m.parent_order_id=f.litix_order_id)
   order by f.updated_at desc limit 25`,
 payment:`select id as order_id,payment_state,created_at
   from public.litix_v2_orders
   where payment_state in ('review','processing')
    and created_at<now()-interval '20 minutes'
   order by created_at asc limit 25`,
 bundle:`select id as order_id,payment_state,created_at
   from public.litix_growth_bundle_orders
   where payment_state in ('review','processing','approved_pending_settlement')
    and created_at<now()-interval '30 minutes'
   order by created_at asc limit 25`,
 legacy:`select id as order_id,fulfillment_state as state,supplier_order_id,
       metadata->>'supplier' as supplier_code,created_at
   from public.litix_v2_orders
   where payment_state='paid' and fulfillment_state in ('processing','submitted','manual_review')
     and created_at<now()-interval '24 hours'
   order by created_at asc limit 25`,
 outbox:`select e.order_id,e.created_at,e.state,
     (c.payment_state='settled' and c.gateway_transaction_id=e.transaction_id
       and c.amount_cents=e.amount_cents) as settled_match,
     (s.payment_status='paid' and s.payment_reference=e.transaction_id
       and s.retail_cents=e.amount_cents) as supplier_match,
     s.fulfillment_status as supplier_fulfillment_state,
     s.provider_order_id as supplier_order_id,
     exists(select 1 from public.litix_order_notifications n
       where n.order_id=e.order_id and n.status='sent'
         and n.event_type in ('submitted','completed')) as notification_sent
   from public.litix_paykings_outbox e
   left join public.litix_paykings_checkout_orders c on c.order_id=e.order_id
   left join public.litix_supplier_orders s on s.id=e.order_id
   where e.state='pending' and e.created_at<now()-interval '1 hour'
   order by e.created_at asc limit 25`
};
const safeOrder=id=>/^(?:ltx2_|ltx_|lbg_)[a-f0-9-]{36}$/.test(String(id||""))?String(id):null;
const safeSupplier=id=>/^\d{1,24}$/.test(String(id||""))?String(id):null;
export function mapOwnerTriage(kind,rows){
 if(!Array.isArray(rows))return [];
 return rows.slice(0,25).flatMap(x=>{
  const orderId=safeOrder(x.order_id);if(!orderId)return [];
  const supplierOrderId=safeSupplier(x.supplier_order_id);
  const extra={orderId,supplierOrderId,postIndex:Number.isSafeInteger(Number(x.ordinal))&&Number(x.ordinal)>0?Number(x.ordinal):null,
    checkedAt:x.checked_at||null};
  if(kind==="partial")return [{...extra,code:"SUPPLIER_NEEDS_RECONCILIATION",action:"Confirm existing supplier order outcome before credit or replacement",severity:"attention"}];
  if(kind==="stale")return [{...extra,code:"SUPPLIER_STATUS_STALE",action:"Check supplier status polling and saved order ID; never resubmit",severity:"attention"}];
  if(kind==="single")return [{...extra,code:"SINGLE_ORDER_NEEDS_RECONCILIATION",action:"Reconcile supplier result; do not duplicate charge or order",severity:"attention"}];
  if(kind==="payment"||kind==="bundle")return [{orderId,supplierOrderId:null,postIndex:null,checkedAt:x.created_at||null,
    code:kind==="bundle"?"BUNDLE_PAYMENT_UNCERTAIN":"PAYMENT_OUTCOME_UNCERTAIN",
    action:"Confirm original gateway transaction before charging or dispatching",severity:"attention"}];
  if(kind==="legacy")return [{...extra,checkedAt:x.created_at||null,
    code:x.supplier_code==="boostero"?"BOOSTERO_PAID_ORDER_UNRESOLVED":"HISTORICAL_PAID_ORDER_UNRESOLVED",
    action:x.supplier_code==="boostero"
      ?"Reconcile the existing Boostero order or canceled children; verify provider credits and customer remedy without re-buying"
      :"Identify the historical supplier and its original order outcome; never dispatch to Boostero as a replacement",
    severity:"attention"}];
  if(kind==="outbox"){
    const reflected=x.settled_match===true&&x.supplier_match===true&&
      x.notification_sent===true&&Boolean(supplierOrderId)&&
      ["completed","processing","submitted"].includes(String(x.supplier_fulfillment_state||"").toLowerCase());
    return [{...extra,checkedAt:x.created_at||null,
      code:reflected?"SETTLED_EVENT_ALREADY_REFLECTED":"SETTLED_EVENT_NEEDS_RECONCILIATION",
      action:reflected
       ?"Payment and supplier work already recorded. Owner may audit and mark the EVENT processed; never replay payment or supplier purchase"
       :"Review historical settled payment and missing fulfillment/notification evidence; do not clear event or repurchase",
      severity:"attention"}];
  }
  return [];
 });
}
export async function loadGuardianOwnerTriage(sql){
 const groups=Object.entries(QUERIES);
 const checked=await Promise.allSettled(groups.map(([,q])=>sql.query(q)));
 const items=checked.flatMap((r,i)=>r.status==="fulfilled"?mapOwnerTriage(groups[i][0],r.value):[]);
 return {items:items.slice(0,75),unavailableChecks:checked.filter(r=>r.status!=="fulfilled").length,
  readOnly:true,asOf:new Date().toISOString()};
}
