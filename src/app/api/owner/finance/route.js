import {neon} from "@neondatabase/serverless";
import {ownerRequest,ownerResponse,safeOrigin} from "../../../../lib/ownerAuth.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=45;
// This endpoint is owner-session only. No admin keys or user passwords in JSON.
const db=()=>{
 if(process.env.VERCEL_ENV!=="production")throw Error("finance_not_production");
 const uri=process.env.LITIX_BOOSTERO_DATABASE_URL||"";
 if(!uri)throw Error("finance_db_unconfigured");
 return neon(uri);
};
const safeCents=value=>{
 const n=Number(value||0);
 return Number.isSafeInteger(n)&&n>=0?n:null;
};
const safeSigned=value=>{
 const n=Number(value||0);
 return Number.isSafeInteger(n)?n:null;
};
function metrics(v2,bundles,unreconciled){
 const a=v2[0]||{},b=bundles[0]||{},c=unreconciled[0]||{};
 const paid=safeCents(a.gross_paid),cost=safeCents(a.recorded_cost),settled=safeCents(b.gross_settled);
 const gross=paid!==null&&settled!==null?paid+settled:null;
 return {
  verifiedPaidOrders:Number(a.paid_orders||0)+Number(b.settled_orders||0),
  completedFulfillmentOrders:Number(a.completed_orders||0),
  grossCapturedCents:gross,
  paykingsV2Cents:paid,
  verifiedBundlesCents:settled,
  stripeCapturedCents:null,
  legacyGatewayCentsExcludedFromTotal:safeCents(c.legacy_settled_cents),
  legacyGatewayOrdersExcluded:Number(c.legacy_settled_orders||0),
  recordedBoosteroWholesaleCents:cost,
  processorFeesCents:null,
  refundsAndChargebacksCents:null,
  netContributionProfitCents:null,
  contributionBeforeFeesAndRefundsCents:gross!==null&&cost!==null?safeSigned(gross-cost):null,
  pendingPaymentValueCents:safeCents(a.pending_value),
  paidUnfulfilledValueCents:safeCents(a.paid_unfulfilled),
  last24hV2RevenueCents:safeCents(a.last24h),
  last7dV2RevenueCents:safeCents(a.last7d),
  last30dV2RevenueCents:safeCents(a.last30d),
  averageV2OrderCents:Number(a.paid_orders)>0&&paid!==null?Math.round(paid/Number(a.paid_orders)):null,
  coverage:{
   canonical:"litix_v2_orders with paid state and verified gateway transaction ID; settled verified bundles",
   overlapsExcluded:"litix_paykings_checkout_orders and litix_supplier_orders may duplicate canonical transactions",
   incomplete:["processor fees","chargebacks","Stripe settlement attribution","unreconciled legacy payments"],
   netProfitIsEstimated:false
  }
 };
}
export async function GET(req){
 if(!ownerRequest(req))return ownerResponse({error:"Authenticated owner session required"},401);
 if(!safeOrigin(req))return ownerResponse({error:"Owner origin verification failed"},403);
 const q=new URL(req.url).searchParams;
 if(q.toString().length>80)return ownerResponse({error:"Invalid dashboard query"},422);
 try{
  const sql=db();
  // All queries are read-only. Only paid, processor-referenced v2 records
  // contribute to captured revenue. Legacy ledger rows are reported separately
  // because they can describe the SAME payment as canonical tables.
  const [v2,bundles,unreconciled,orders,bundleOrders,services,serviceRanking]=await Promise.all([
   sql.query(`select
    count(*) filter(where payment_state='paid' and payment_transaction_id is not null)::integer as paid_orders,
    count(*) filter(where payment_state='paid' and payment_transaction_id is not null and lower(fulfillment_state)='completed')::integer as completed_orders,
    coalesce(sum(amount_cents) filter(where payment_state='paid' and payment_transaction_id is not null),0)::bigint as gross_paid,
    coalesce(sum(supplier_cost_cents) filter(where payment_state='paid' and payment_transaction_id is not null),0)::bigint as recorded_cost,
    coalesce(sum(amount_cents) filter(where payment_state in ('pending','processing','awaiting_payment')),0)::bigint as pending_value,
    coalesce(sum(amount_cents) filter(where payment_state='paid' and payment_transaction_id is not null and lower(fulfillment_state) not in ('completed','canceled','cancelled','refunded')),0)::bigint as paid_unfulfilled,
    coalesce(sum(amount_cents) filter(where payment_state='paid' and payment_transaction_id is not null and created_at>=now()-interval '1 day'),0)::bigint as last24h,
    coalesce(sum(amount_cents) filter(where payment_state='paid' and payment_transaction_id is not null and created_at>=now()-interval '7 days'),0)::bigint as last7d,
    coalesce(sum(amount_cents) filter(where payment_state='paid' and payment_transaction_id is not null and created_at>=now()-interval '30 days'),0)::bigint as last30d
    from public.litix_v2_orders`),
   sql.query(`select count(*) filter(where payment_state='settled' and (gateway_transaction_id is not null or bluevine_payment_reference is not null))::integer as settled_orders,
    coalesce(sum(price_cents) filter(where payment_state='settled' and (gateway_transaction_id is not null or bluevine_payment_reference is not null)),0)::bigint as gross_settled
    from public.litix_growth_bundle_orders`),
   sql.query(`select count(*) filter(where payment_state='settled')::integer as legacy_settled_orders,
    coalesce(sum(amount_cents) filter(where payment_state='settled'),0)::bigint as legacy_settled_cents
    from public.litix_paykings_checkout_orders`),
   sql.query(`select id,email,service_name,category,quantity,amount_cents,supplier_cost_cents,
    payment_state,fulfillment_state,payment_transaction_id,supplier_order_id,created_at,updated_at
    from public.litix_v2_orders order by created_at desc limit 75`),
   sql.query(`select id,email,package_name,platform,price_cents,payment_state,order_state,
    payment_provider,gateway_transaction_id,bluevine_payment_reference,created_at,updated_at
    from public.litix_growth_bundle_orders order by created_at desc limit 35`),
   sql.query(`select count(*) filter(where enabled)::integer as enabled_services,
    count(*)::integer as explicitly_reviewed_service_rows from public.litix_boostero_services`),
   sql.query(`select service_name,count(*)::integer as paid_orders,
    coalesce(sum(amount_cents),0)::bigint as gross_cents,
    coalesce(sum(supplier_cost_cents),0)::bigint as recorded_supplier_cents
    from public.litix_v2_orders where payment_state='paid' and payment_transaction_id is not null
    group by service_name order by paid_orders desc limit 12`)
  ]);
  return ownerResponse({asOf:new Date().toISOString(),metrics:metrics(v2,bundles,unreconciled),
   serviceOperations:{approvedPublicServices:Number(services[0]?.enabled_services||0),
    importedSupplierServices:null,blockedSupplierServices:null,
    source:"production approved_service allowlist; staging inventory not assumed to equal production"},
   orders:orders.map(x=>({...x,amount_cents:safeCents(x.amount_cents),
    supplier_cost_cents:safeCents(x.supplier_cost_cents)})),
   bundles:bundleOrders,topServices:serviceRanking,readOnly:true,
   notices:["Unknown processor fees and refunds are not counted as zero profit adjustments.",
    "Historical/legacy ledgers are excluded from gross until payment IDs are reconciled.",
    "No credit-card details or credentials are stored or returned."]});
 }catch{return ownerResponse({error:"Private financial database currently unavailable"},503)}
}
export function POST(){return ownerResponse({error:"Read-only dashboard"},405)}
