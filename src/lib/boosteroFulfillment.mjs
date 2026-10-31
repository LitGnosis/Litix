// Isolated Boostero fulfillment; no import into existing storefront or SMMGLOB checkout.
import {neon} from "@neondatabase/serverless";
import {createHash,randomUUID,timingSafeEqual} from "node:crypto";
import {boosteroProduction,boosteroCompatibleServices} from "./boosteroReadOnly.mjs";
import {litixRetailPer1000Cents,litixOrderCents,litixPurchasableDefault,litixSupplierSafeLink} from "./litixRetail60.mjs";
import {litixPlatform,litixKind} from "./litixServiceClassify.mjs";
import {litixCustomerServiceName} from "./serviceCardDisplay.mjs";
import {queueCustomerDeliveryChange,sendCustomerDeliveryUpdates} from "./litixCustomerUpdates.mjs";

export const boosteroDatabaseURL=()=>process.env.LITIX_BOOSTERO_DATABASE_URL||process.env.LITIX_V2_DATABASE_URL||
 process.env.DATABASE_URL||process.env.POSTGRES_URL||"";
export const boosteroSQL=()=>neon(boosteroDatabaseURL());
export const hashBoostero=x=>createHash("sha256").update(String(x)).digest("hex");
export const boosteroToken=()=>randomUUID()+"-"+randomUUID();
export const boosteroOrderId=()=> "ltx2_"+randomUUID();
export const boosteroProductionReady=()=>process.env.VERCEL_ENV==="production"&&process.env.LITIX_BOOSTERO_ENABLED==="true"&&
 !!process.env.BOOSTERO_API_KEY&&!!process.env.BOOSTERO_API_URL&&!!boosteroDatabaseURL();
export function boosteroAdminAuthorized(auth,secret=process.env.LITIX_BOOSTERO_ADMIN_TOKEN){
 const value=String(auth||"").replace(/^Bearer /,"");
 const expected=String(secret||"");
 if(expected.length<40||value.length!==expected.length)return false;
 return timingSafeEqual(Buffer.from(expected),Buffer.from(value));
}
export function boosteroProfile(input,platform){
 const raw=String(input||"").trim();
 if(!["instagram","tiktok"].includes(platform))return null;
 const origin=platform==="instagram"?"www.instagram.com":"www.tiktok.com";
 let username=raw.replace(/^@/,"");
 if(/^https?:\/\//i.test(raw)){
  let parsed;try{parsed=new URL(raw)}catch{return null}
  if(parsed.protocol!=="https:"||parsed.username||parsed.password||parsed.port||parsed.search||parsed.hash||
     ![origin,origin.replace(/^www\./,"")].includes(parsed.hostname.toLowerCase()))return null;
  const m=platform==="instagram"?parsed.pathname.match(/^\/([A-Za-z0-9._]{1,30})\/?$/):parsed.pathname.match(/^\/@([A-Za-z0-9._]{2,24})\/?$/);
  if(!m)return null;
  username=m[1];
 }
 if(platform==="instagram"&&!/^[A-Za-z0-9._]{1,30}$/.test(username))return null;
 if(platform==="tiktok"&&!/^[A-Za-z0-9._]{2,24}$/.test(username))return null;
 if(["p","reel","stories","explore","api"].includes(username.toLowerCase()))return null;
 return "https://"+origin+"/"+(platform==="tiktok"?"@":"")+username+"/";
}
export function boosteroDestination(input,platform,kind="followers"){
 if(["instagram","tiktok"].includes(String(platform).toLowerCase())&&kind==="followers")return boosteroProfile(input,String(platform).toLowerCase());
 if(!["instagram","tiktok"].includes(String(platform).toLowerCase())||kind!=="likes")
  return litixSupplierSafeLink(input);
 platform=String(platform).toLowerCase();
 let u;try{u=new URL(String(input||"").trim())}catch{return null}
 const host=u.hostname.toLowerCase().replace(/^www\./,"");
 if(u.protocol!=="https:"||host!==(platform==="instagram"?"instagram.com":"tiktok.com")||
   u.username||u.password||u.port||u.search||u.hash)return null;
 if(platform==="instagram"){
  const m=u.pathname.match(/^\/(p|reel)\/([a-zA-Z0-9_-]{5,32})\/?$/);
  return m?"https://www.instagram.com/"+m[1]+"/"+m[2]+"/":null;
 }
 const m=u.pathname.match(/^\/@([a-zA-Z0-9._]{2,24})\/video\/([0-9]{10,30})\/?$/);
 return m?"https://www.tiktok.com/@"+m[1]+"/video/"+m[2]:null;
}
// Price and eligibility are verified directly against the latest Boostero service
// every time before charging a real card. The catalog alone is not authority.
export function boosteroQuote({service,quantity}){
 const id=String(service?.service??service?.id??"");
 const qty=Number(quantity),min=Number(service?.min),max=Number(service?.max);
 const lowest=litixPurchasableDefault(service);
 if(!lowest||!Number.isSafeInteger(qty)||qty<lowest||qty>max||qty>1000000)
  throw Error("boostero_quantity_or_type_not_supported");
 const rate=Number(service?.rate);
 const retailPer1000Cents=litixRetailPer1000Cents(rate);
 const amountCents=litixOrderCents(retailPer1000Cents,qty);
 const costUSD=rate*qty/1000;
 const wholesaleCents=Math.ceil(costUSD*100-1e-8);
 if(!Number.isSafeInteger(amountCents)||amountCents<100||amountCents>100000000||
    !Number.isFinite(costUSD)||costUSD<=0||amountCents<Math.ceil(costUSD*160-1e-8))
  throw Error("boostero_price_must_cover_60_percent_markup");
 const name=String(service.name||"Service").slice(0,200);
 const category=String(service.category||"Other").slice(0,140);
 return {quantity:qty,amountCents,wholesaleCents,costUSD,retailPer1000Cents,
  platform:litixPlatform(name,category),serviceId:id,serviceName:name,
  kind:litixKind(name,category),supplierMin:min,minimum:lowest,type:"Default"};
}
export async function verifyBoosteroQuote(serviceId,quantity,_sql=boosteroSQL()){
 if(!/^\d{1,12}$/.test(String(serviceId)))throw Error("boostero_service_id_invalid");
 const raw=await boosteroProduction("services");
 const service=raw.find(s=>String(s?.service)===String(serviceId));
 if(!service)throw Error("boostero_live_service_not_found");
 return {quote:boosteroQuote({service,quantity}),service};
}
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function resend({to,subject,text,key}){
 const credential=process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY;
 if(!credential)throw Error("resend_unavailable");
 const r=await fetch("https://api.resend.com/emails",{method:"POST",cache:"no-store",signal:AbortSignal.timeout(8500),
  headers:{"authorization":"Bearer "+credential,"content-type":"application/json","Idempotency-Key":key},
  body:JSON.stringify({from:"Litix <orders@litix.net>",to:Array.isArray(to)?to:[to],subject,text,
   html:"<div style='font-family:Arial,sans-serif;white-space:pre-wrap'>"+esc(text)+"</div>"})});
 if(!r.ok)throw Error("resend_http_"+r.status);
}
export async function boosteroNotice(orderId,secret){
 const sql=boosteroSQL();
 const orders=await sql.query("select o.id,o.email,o.service_name,o.quantity,o.amount_cents,o.payment_state,o.destination,o.metadata,f.state,f.supplier_order_id from public.litix_v2_orders o join public.litix_boostero_fulfillment f on o.id=f.litix_order_id where o.id=$1",[orderId]);
 if(orders.length!==1)return false;
 const o=orders[0];
 const allocations=Array.isArray(o.metadata?.postAllocations)?o.metadata.postAllocations.slice(0,5):[];
 const postPlatform=o.metadata?.postPlatform==="instagram"?"Instagram":"TikTok";
 const automatedMulti=allocations.length>1&&o.metadata?.fulfillmentMode==="boostero_child_order_dispatch";
 const allocationLines=allocations.map((p,i)=>
  (postPlatform==="Instagram"?"Post ":"Video ")+(i+1)+": "+String(p.link||"")+" — "+Number(p.quantity||0).toLocaleString()+" likes");
 const publicService=litixCustomerServiceName(o.service_name);
 const publicLink=secret?"https://www.litix.net/track?track="+encodeURIComponent(orderId)+"&token="+encodeURIComponent(secret):null;
 // Customer communication stays Litix-branded. The private owner notification
 // retains supplier references needed for fulfillment and support.
 const amount="USD $"+(Number(o.amount_cents)/100).toFixed(2);
 const customerBody=[
  "Litix — Your payment and order confirmation",
  "Litix Order: "+orderId,
  "Service: "+publicService,
  "Quantity: "+o.quantity,
  ...(allocations.length?["Your selected "+postPlatform+" posts:",...allocationLines,
   "Litix will coordinate separate delivery for each post."]:[]),
  "Total paid: "+amount,
  "Payment status: "+o.payment_state,
  "Litix order status: "+(o.state==="COMPLETED"?"Completed":o.state==="FAILED"?"Needs support":"Processing"),
  "We will update your private tracking page as delivery progresses.",
  publicLink?"Track your order: "+publicLink:null,
  "Questions? Contact Litix at litixsocial@gmail.com.",
  "Please do not place a duplicate order while your delivery is processing."
 ].filter(Boolean).join("\n");
 const ownerLink=publicLink;
 const ownerBody=[
  "Litix — Order and fulfillment details",
  "Litix Order: "+orderId,
  "Service: "+publicService,
  "Quantity: "+o.quantity,
  ...(allocations.length?(automatedMulti?[
    "AUTOMATED PER-POST FULFILLMENT: Review the individual Boostero child statuses in Litix tracking.",
    "Do NOT submit any selected post manually unless its prior supplier outcome is independently confirmed not accepted. Unknown outcomes require reconciliation.",
    ...allocationLines
   ]:[postPlatform==="Instagram"?"ACTION REQUIRED: Manual Instagram multi-post fulfillment.":"ACTION REQUIRED: Manual TikTok multi-post fulfillment.",
    postPlatform==="Instagram"?"Submit each post separately to the existing supplier. Never submit the parent destination as a single order.":"Submit each video separately to the existing supplier. Never submit the parent destination as a single order.",
    ...allocationLines]):[]),
  "Amount: "+amount,
  "Payment: "+o.payment_state,
  "Supplier: Boostero",
  automatedMulti?"Boostero order IDs are recorded separately for each selected post.": "Boostero Order ID: "+(o.supplier_order_id||"Awaiting confirmation"),
  "Fulfillment: "+o.state,
  ownerLink?"Private tracking URL: "+ownerLink:null
 ].filter(Boolean).join("\n");
 if(secret&&o.payment_state==="paid"){
  await Promise.allSettled([
   resend({to:o.email,subject:"Litix — Payment confirmed and order tracking",text:customerBody,key:"litix-boostero-customer/"+orderId}),
   resend({to:["litixsocial@gmail.com","litgnosisllc@gmail.com"],
    subject:"Litix — New paid order "+orderId,text:ownerBody,key:"litix-boostero-owner/"+orderId})
  ]);
 }else{
  await resend({to:["litixsocial@gmail.com","litgnosisllc@gmail.com"],
   subject:"Litix — Fulfillment needs review "+orderId,text:ownerBody,
   key:"litix-boostero-review/"+orderId+"/"+o.state});
 }
 return true;
}
// Durable one-way claim: unknown supplier outcomes are NEVER automatically retried.
export async function dispatchBoostero(orderId,{sql=boosteroSQL(),operation=boosteroProduction}={}){
 if(!boosteroProductionReady())throw Error("boostero_production_disabled");
 const attemptId=randomUUID();
 const claimed=await sql.query(
  "update public.litix_boostero_fulfillment f set state='DISPATCHING',purchase_attempt_id=$2,attempted_at=now(),updated_at=now() where f.litix_order_id=$1 and f.state='QUEUED' and f.supplier_order_id is null and exists(select 1 from public.litix_v2_orders o where o.id=$1 and ((f.payment_mode='card' and o.payment_state='paid' and o.payment_transaction_id is not null) or (f.payment_mode='admin' and f.approved_admin_id is not null))) and exists(select 1 from public.litix_v2_orders e where e.id=$1 and e.metadata->>'supplier'='boostero') returning f.supplier_service_id",
  [orderId,attemptId]);
 if(!claimed.length)return {submitted:false,state:"not_eligible_or_already_claimed"};
 try{await sql.query("insert into public.litix_boostero_attempts(id,litix_order_id,kind,state) values($1,$2,'add','STARTED')",[attemptId,orderId]);}
 catch{
  await sql.query("update public.litix_boostero_fulfillment set state='MANUAL_REVIEW',error_code='audit_lock_failed',updated_at=now() where litix_order_id=$1 and purchase_attempt_id=$2 and state='DISPATCHING'",[orderId,attemptId]).catch(()=>{});
  console.error("Litix Boostero audit lock failed",{orderId});
  return {submitted:false,state:"MANUAL_REVIEW",requiresReview:true};
 }
 const orders=await sql.query("select o.destination,o.quantity,o.amount_cents,f.supplier_service_id from public.litix_v2_orders o join public.litix_boostero_fulfillment f on f.litix_order_id=o.id where o.id=$1",[orderId]);
 if(orders.length!==1){
  await sql.query("update public.litix_boostero_fulfillment set state='MANUAL_REVIEW',error_code='paid_order_lookup_failed',updated_at=now() where litix_order_id=$1 and purchase_attempt_id=$2 and state='DISPATCHING'",[orderId,attemptId]).catch(()=>{});
  console.error("Litix Boostero paid order lookup missing",{orderId});
  return {submitted:false,state:"MANUAL_REVIEW",requiresReview:true};
 }
 let result;
 try{
  // Refresh current wholesale and remaining account balance just before spend.
  const {quote}=await verifyBoosteroQuote(String(orders[0].supplier_service_id),Number(orders[0].quantity),sql);
  if(Number(orders[0].amount_cents)<quote.amountCents)throw Error("boostero_wholesale_changed_after_payment");
  const balance=await operation("balance");
  if(!Number.isFinite(Number(balance.balance))||Number(balance.balance)<quote.costUSD)throw Error("boostero_insufficient_balance");
  result=await operation("add",{service:quote.serviceId,link:orders[0].destination,quantity:quote.quantity},{claimed:true});
 }catch(err){
  const certain=["boostero_provider_rejected","boostero_insufficient_balance","boostero_wholesale_changed","boostero_wholesale_changed_after_payment",
   "boostero_retail_not_approved_for_current_cost","boostero_service_breaks_litix_retail_ladder"].includes(err.message);
  const state=certain?"REJECTED":"UNKNOWN_OUTCOME";
  await Promise.allSettled([
   sql.query("update public.litix_boostero_fulfillment set state=$2,error_code=$3,updated_at=now() where litix_order_id=$1 and state='DISPATCHING' and purchase_attempt_id=$4",
    [orderId,state,certain?String(err.message).slice(0,80):"unconfirmed_supplier_outcome",attemptId]),
   sql.query("update public.litix_boostero_attempts set state=$2,error_code=$3,finished_at=now() where id=$1",
    [attemptId,certain?"REJECTED":"UNKNOWN_OUTCOME",certain?String(err.message).slice(0,80):"unconfirmed_supplier_outcome"])
  ]);
  return {submitted:false,state,requiresReview:true};
 }
 // Supplier may have accepted the purchase even if DB goes down. A subsequent retry is forbidden.
 const providerId=String(result.order);
 try{
  const saved=await sql.query("update public.litix_boostero_fulfillment set supplier_order_id=$2,state='SUBMITTED',supplier_status=$3::jsonb,updated_at=now() where litix_order_id=$1 and state='DISPATCHING' and purchase_attempt_id=$4 returning supplier_order_id",
   [orderId,providerId,JSON.stringify({status:"Pending",checked_at:new Date().toISOString()}),attemptId]);
  if(!saved.length)throw Error("receipt_conflict");
  await sql.query("update public.litix_boostero_attempts set supplier_order_id=$2,state='CONFIRMED',finished_at=now() where id=$1",[attemptId,providerId]);
  await sql.query("update public.litix_v2_orders set supplier_order_id=$2,fulfillment_state='submitted',last_supplier_status=$3::jsonb,updated_at=now() where id=$1 and supplier_order_id is null",
   [orderId,providerId,JSON.stringify({provider:"boostero",status:"Pending",checked_at:new Date().toISOString()})]);
  return {submitted:true,state:"SUBMITTED",supplierOrderId:providerId};
 }catch{return {submitted:false,state:"UNKNOWN_OUTCOME",requiresReview:true};}
}
export const deliverLitixCustomerUpdates=({sql=boosteroSQL(),limit=12}={})=>sendCustomerDeliveryUpdates({sql,sendEmail:resend,limit});
export async function syncBoosteroStatuses({sql=boosteroSQL(),operation=boosteroProduction,limit=20}={}){
 if(!boosteroProductionReady())return {checked:0,disabled:true};
 const orders=await sql.query("select litix_order_id,supplier_order_id,attempted_at,checked_at,supplier_status,state from public.litix_boostero_fulfillment where state='SUBMITTED' and supplier_order_id is not null and (checked_at is null or checked_at<now()-interval '15 minutes') order by checked_at nulls first limit $1",[Math.min(20,limit)]);
 let checked=0,failed=0;
 for(const item of orders){
  try{
   const res=await operation("status",{order:item.supplier_order_id});
   const name=String(res.status||"").toLowerCase();
   const state=/^completed|complete|finished$/.test(name)?"COMPLETED":/^(canceled|cancelled|failed|error)$/.test(name)?"FAILED":"SUBMITTED";
   const snapshot={provider:"boostero",status:String(res.status||"Unknown").slice(0,80),
    remains:res.remains??null,checked_at:new Date().toISOString()};
   // Record meaningful changes before overwriting the previous snapshot. If the outbox
   // is unavailable, the next poll retries instead of silently dropping the update.
   const info=await sql.query("select quantity from public.litix_v2_orders where id=$1 and payment_state=\'paid\'",[item.litix_order_id]);
   if(info.length===1)await queueCustomerDeliveryChange({sql,orderId:item.litix_order_id,supplierOrderId:item.supplier_order_id,
    previous:item.supplier_status,latest:snapshot,state,quantity:info[0].quantity});
   await sql.query("update public.litix_boostero_fulfillment set state=$2,supplier_status=$3::jsonb,checked_at=now(),updated_at=now() where litix_order_id=$1 and supplier_order_id=$4",
    [item.litix_order_id,state,JSON.stringify(snapshot),item.supplier_order_id]);
   // Keep the generic customer/owner tracking record in sync as well.
   // Only the matching confirmed Boostero ID may be updated.
   const customerState=state==="COMPLETED"?"completed":state==="FAILED"?"failed":"processing";
   await sql.query("update public.litix_v2_orders set fulfillment_state=$3,last_supplier_status=$4::jsonb,updated_at=now() where id=$1 and supplier_order_id=$2 and payment_state='paid'",
    [item.litix_order_id,String(item.supplier_order_id),customerState,JSON.stringify(snapshot)]);
   if(state==="FAILED"||(state==="SUBMITTED"&&item.attempted_at&&Date.now()-Date.parse(item.attempted_at)>86400000))
    await boosteroNotice(item.litix_order_id,null).catch(()=>{});
   checked++;
  }catch{failed++;if(item.attempted_at&&Date.now()-Date.parse(item.attempted_at)>86400000)await boosteroNotice(item.litix_order_id,null).catch(()=>{});}
 }
 return {checked,failed};
}
