import {after} from "next/server.js";
import {createHmac,randomUUID,timingSafeEqual} from "node:crypto";
import {neon} from "@neondatabase/serverless";
import {boosteroProduction} from "../../../../../lib/boosteroReadOnly.mjs";
import {normalizeBoosteroService} from "../../../../../lib/boosteroGlobalCatalog.mjs";
import {validateBoosteroOrderDraft} from "../../../../../lib/boosteroFullOrderContracts.mjs";
import {quoteBoostero60TypedUnits,quoteBoostero60Package} from "../../../../../lib/boosteroRetail60.mjs";
import {boosteroProductionReady,boosteroSQL,boosteroOrderId,boosteroToken,
 hashBoostero,boosteroNotice} from "../../../../../lib/boosteroFulfillment.mjs";
import {dispatchBoosteroTypedPaidOrder} from "../../../../../lib/boosteroTypedPaidDispatch.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const answer=(v,status=200)=>Response.json(v,{status,headers:{
 "cache-control":"no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"
}});
const fail=(code,status=409)=>answer({error:code,paymentAttempted:false,supplierOrderSubmitted:false},status);
const typedEnabled=()=>process.env.LITIX_BOOSTERO_TYPED_ORDERS_ENABLED==="true"&&
 boosteroProductionReady()&&!!process.env.LITIX_BOOSTERO_INVENTORY_READONLY_URL&&
 !!process.env.LITIX_BOOSTERO_INVENTORY_EXPECTED_HOST;
const inventoryConnection=()=>{
 const raw=process.env.LITIX_BOOSTERO_INVENTORY_READONLY_URL||"";
 const expected=process.env.LITIX_BOOSTERO_INVENTORY_EXPECTED_HOST||"";
 let u;try{u=new URL(raw)}catch{throw Error("inventory_unavailable")}
 if(u.protocol!=="postgresql:"||u.hostname!==expected||
  !u.hostname.endsWith(".neon.tech")||u.pathname!=="/neondb"||
  !u.username||!u.password)throw Error("inventory_host_unverified");
 return neon(raw);
};
async function quoteForOrder(service,input,orderSQL,inventorySQL){
 const draft=validateBoosteroOrderDraft(service,input);
 if(!draft.valid||draft.variableFutureCharge)return null;
 const record=await inventorySQL.query(
  "select supplier_service_id,wholesale_per_1000,order_type from public.litix_boostero_inventory where supplier_service_id=$1 and active=true and refreshed_at>now()-interval '36 hours' limit 1",
  [String(service.id)]
 );
 if(record.length!==1||record[0].order_type!==service.type||
  Number(record[0].wholesale_per_1000)!==Number(service.wholesalePer1000))return null;
 const approval=await orderSQL.query(
  "select approved_retail_per_1000_cents,approved_package_price_cents,approved_wholesale_ceiling,order_type,special_contract_verified from public.litix_boostero_full_service_approvals where supplier_service_id=$1 and enabled=true and reviewed_at is not null limit 1",
  [String(service.id)]
 );
 if(approval.length!==1||approval[0].order_type!==service.type||
  Number(service.wholesalePer1000)>Number(approval[0].approved_wholesale_ceiling)||
  (service.type!=="Default"&&!approval[0].special_contract_verified))return null;
 const retail=Number(approval[0].approved_retail_per_1000_cents);
 const quote=draft.type==="Package"?
  quoteBoostero60Package({service,draft,approvedPackagePriceCents:approval[0].approved_package_price_cents}):
  quoteBoostero60TypedUnits({service,draft,approvedRetailPer1000Cents:retail});
 if(!quote.valid||quote.customerAmountCents<500)return null;
 return {draft,quote,retail};
}
export async function POST(request){
 if(!typedEnabled())return fail("new_service_checkout_not_activated",503);
 const origin=request.headers.get("origin");
 if(origin&&origin!==new URL(request.url).origin)return fail("invalid_origin",403);
 let data;try{
  const raw=await request.text();
  if(raw.length>16000)return fail("request_too_large",413);
  data=JSON.parse(raw);
 }catch{return fail("invalid_json",400)}
 const id=String(data?.serviceId||"");
 const email=String(data?.email||"").trim().toLowerCase();
 const token=String(data?.paymentToken||"");
 const idem=String(data?.idempotencyKey||"");
 if(!/^service_[a-f0-9]{24}$/.test(id)||!/^\w[^\s@]*@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||
  !/^[a-f0-9-]{36}$/i.test(idem)||token.length<10||token.length>500)
  return fail("invalid_checkout_input",422);
 if(!process.env.NMI_SECURITY_KEY)return fail("payment_gateway_unconfigured",503);
 const orderSQL=boosteroSQL();
 let inventorySQL;try{inventorySQL=inventoryConnection()}catch{return fail("verified_inventory_unavailable",503)}
 let service,draft,quote;
 let liveServices;
 try{
  liveServices=await boosteroProduction("services");
  const expected=id.slice("service_".length);
  const key=process.env.BOOSTERO_API_KEY;
  const raw=liveServices.find(s=>{
   const digest=createHmac("sha256",key).update(String(s.service)).digest("hex").slice(0,24);
   return timingSafeEqual(Buffer.from(expected),Buffer.from(digest));
  });
  service=normalizeBoosteroService(raw);
  if(!service)return fail("supplier_service_unavailable");
  const result=await quoteForOrder(service,data?.input,orderSQL,inventorySQL);
  if(!result)return fail("service_not_approved_for_purchase");
  ({draft,quote}=result);
 }catch{return fail("supplier_or_approval_verification_failed",503)}
 if(quote.customerAmountCents!==Number(data?.expectedAmountCents))return fail("retail_quote_changed");
 const amount=(quote.customerAmountCents/100).toFixed(2);
 let balance;try{balance=await boosteroProduction("balance")}catch{return fail("supplier_balance_unavailable",503)}
 if(!Number.isFinite(Number(balance.balance))||Number(balance.balance)<quote.supplierCostCents/100)
  return fail("supplier_balance_insufficient");
 const orderId=boosteroOrderId(),secret=boosteroToken();
 const quantity=quote.totalUnits;
 const destination=String(draft.params.link||draft.params.username||"").slice(0,500);
 let inserted;
 try{
  const rows=await orderSQL.query(
   "with created as (insert into public.litix_v2_orders (id,email,service_id,service_name,category,destination,quantity,amount_cents,supplier_cost_cents,idempotency_key,tracking_token_hash,metadata,payment_state,fulfillment_state) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,'processing','pending') on conflict (idempotency_key) do nothing returning id), claimed as (insert into public.litix_boostero_fulfillment (litix_order_id,supplier_service_id,payment_mode,state) select id,$3,'card','PENDING_PAYMENT' from created returning litix_order_id) select litix_order_id from claimed",
   [orderId,email,String(service.id),service.name,service.category,destination,quantity,
    quote.customerAmountCents,quote.supplierCostCents,idem,hashBoostero(secret),
    JSON.stringify({supplier:"boostero",typed:true,boostero_typed_draft:data.input})]);
  inserted=rows.length===1;
 }catch{return fail("order_ledger_unavailable",503)}
 if(!inserted)return fail("order_already_submitted_no_repeat_charge");
 let payment;
 try{
  const r=await fetch("https://paykings.transactiongateway.com/api/transact.php",{
   method:"POST",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(18000),
   headers:{"content-type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({security_key:process.env.NMI_SECURITY_KEY,type:"sale",
    payment_token:token,amount,orderid:orderId,email})
  });
  if(!r.ok)throw Error("gateway_unconfirmed");
  payment=Object.fromEntries(new URLSearchParams(await r.text()));
 }catch{
  await orderSQL.query("update public.litix_v2_orders set payment_state='review' where id=$1",[orderId]).catch(()=>{});
  return answer({orderId,payment:"review",supplierOrderSubmitted:false,
   message:"Payment outcome uncertain. Do not repeat purchase."},202);
 }
 if(String(payment.response)!=="1"){
  await orderSQL.query("update public.litix_v2_orders set payment_state='declined' where id=$1",[orderId]).catch(()=>{});
  return answer({orderId,payment:"declined",supplierOrderSubmitted:false},402);
 }
 const transaction=String(payment.transactionid||"");
 if(!/^[A-Za-z0-9-]{3,100}$/.test(transaction)){
  await orderSQL.query("update public.litix_v2_orders set payment_state='review' where id=$1",[orderId]).catch(()=>{});
  return answer({orderId,payment:"review",supplierOrderSubmitted:false},202);
 }
 try{
  const rows=await orderSQL.query(
   "with paid as (update public.litix_v2_orders set payment_state='paid',payment_transaction_id=$2,updated_at=now() where id=$1 and payment_state='processing' returning id) update public.litix_boostero_fulfillment set state='QUEUED',updated_at=now() where litix_order_id in (select id from paid) and state='PENDING_PAYMENT' returning litix_order_id",
   [orderId,transaction]);
  if(rows.length!==1)throw Error("payment_ledger_mismatch");
 }catch{
  after(()=>boosteroNotice(orderId,null).catch(()=>{}));
  return answer({orderId,payment:"paid",fulfillment:"manual_review",
   message:"Verified payment needs owner ledger reconciliation; supplier not submitted"},202);
 }
 const attempt=await dispatchBoosteroTypedPaidOrder(orderId,{
  sql:orderSQL,inventorySQL,liveServices,enabled:true
 }).catch(()=>({submitted:false,state:"UNKNOWN_OUTCOME",requiresReview:true}));
 after(()=>boosteroNotice(orderId,secret).catch(()=>{}));
 return answer({orderId,secret,payment:"paid",fulfillment:attempt.state,
  supplierSubmitted:attempt.submitted===true,
  message:attempt.submitted?"Order confirmed and submitted":
   "Supplier status requires review; never repeat card payment or supplier request"},attempt.submitted?200:202);
}
export function GET(){return fail("post_required",405)}
