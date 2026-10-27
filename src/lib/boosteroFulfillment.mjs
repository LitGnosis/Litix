// Isolated Boostero fulfillment; no import into existing storefront or SMMGLOB checkout.
import {neon} from "@neondatabase/serverless";
import {createHash,randomUUID,timingSafeEqual} from "node:crypto";
import {boosteroProduction,boosteroFollowers} from "./boosteroReadOnly.mjs";
import {proposeServiceRetail,minimumRetailCentsForWholesale,calculateOrderCents} from "./pricing.mjs";

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
export function boosteroQuote({service,approved,quantity}){
 if(!approved||approved.enabled!==true)throw Error("boostero_service_not_approved");
 if(String(service.id)!==String(approved.supplier_service_id)||service.platform!==approved.platform)
  throw Error("boostero_service_mapping_changed");
 const qty=Number(quantity),step=1,min=Number(service.min),max=Number(service.max);
 if(!Number.isSafeInteger(qty)||!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||qty<min||qty>max||(qty-min)%step)
  throw Error("boostero_quantity_out_of_range");
 const wholesalePer1000=Number(service.wholesalePer1000USD);
 if(!Number.isFinite(wholesalePer1000)||wholesalePer1000<=0||
    wholesalePer1000>Number(approved.wholesale_ceiling_per_1000))
  throw Error("boostero_wholesale_changed");
 const repriced=proposeServiceRetail({name:service.name,category:service.category,refill:service.refillClaim},wholesalePer1000);
 if(repriced.action!=="reprice")throw Error("boostero_service_breaks_litix_retail_ladder");
 const retailPer1000Cents=Number(approved.retail_per_1000_cents);
 // Never automatically reprice, and never sell below currently required margin.
 if(!Number.isSafeInteger(retailPer1000Cents)||retailPer1000Cents<repriced.retailPer1000Cents||
    (retailPer1000Cents>1500&&!["365","lifetime"].includes(repriced.classification.tier)))
  throw Error("boostero_retail_not_approved_for_current_cost");
 const amountCents=calculateOrderCents(qty,retailPer1000Cents/100);
 const costUSD=wholesalePer1000*qty/1000;
 const wholesaleCents=Math.ceil(costUSD*100-1e-8);
 const floor=minimumRetailCentsForWholesale(costUSD);
 if(amountCents<500||!Number.isSafeInteger(amountCents)||amountCents>100000000||floor===null||amountCents<floor)
  throw Error("boostero_five_dollar_or_margin_floor_not_met");
 return {quantity:qty,amountCents,wholesaleCents,costUSD,retailPer1000Cents,platform:approved.platform,
  serviceId:String(service.id),serviceName:String(service.name)};
}
export async function verifyBoosteroQuote(serviceId,quantity,sql=boosteroSQL()){
 const enabled=await sql.query("select * from public.litix_boostero_services where supplier_service_id=$1 and enabled=true",[serviceId]);
 if(enabled.length!==1)throw Error("boostero_service_not_explicitly_enabled");
 const rows=boosteroFollowers(await boosteroProduction("services"));
 const service=rows.find(x=>x.id===serviceId);
 if(!service)throw Error("boostero_live_service_not_found");
 return {quote:boosteroQuote({service,approved:enabled[0],quantity}),service};
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
 const orders=await sql.query("select o.id,o.email,o.service_name,o.quantity,o.amount_cents,o.payment_state,o.destination,f.state,f.supplier_order_id from public.litix_v2_orders o join public.litix_boostero_fulfillment f on o.id=f.litix_order_id where o.id=$1",[orderId]);
 if(orders.length!==1)return false;
 const o=orders[0],link=secret?"https://www.litix.net/api/internal/boostero/track?order="+encodeURIComponent(orderId)+"&token="+encodeURIComponent(secret):null;
 const body=["Litix Boostero order","Litix Order: "+orderId,"Service: "+o.service_name,"Quantity: "+o.quantity,
  "Amount: USD $"+(Number(o.amount_cents)/100).toFixed(2),"Payment: "+o.payment_state,
  "Supplier: Boostero","Boostero Order ID: "+(o.supplier_order_id||"Awaiting confirmation"),
  "Fulfillment: "+o.state,link?"Private tracking URL: "+link:null].filter(Boolean).join("\n");
 if(secret&&o.payment_state==="paid"){
  await Promise.allSettled([
   resend({to:o.email,subject:"Litix — Your payment and Boostero order",text:body,key:"litix-boostero-customer/"+orderId}),
   resend({to:["litixsocial@gmail.com","litgnosisllc@gmail.com"],subject:"Litix Boostero approved purchase — "+orderId,text:body,key:"litix-boostero-owner/"+orderId})
  ]);
 }else{
  await resend({to:["litixsocial@gmail.com","litgnosisllc@gmail.com"],subject:"Litix Boostero fulfillment requires review — "+orderId,text:body,
   key:"litix-boostero-review/"+orderId+"/"+o.state});
 }
 return true;
}
// Durable one-way claim: unknown supplier outcomes are NEVER automatically retried.
export async function dispatchBoostero(orderId,{sql=boosteroSQL(),operation=boosteroProduction}={}){
 if(!boosteroProductionReady())throw Error("boostero_production_disabled");
 const attemptId=randomUUID();
 const claimed=await sql.query(
  "update public.litix_boostero_fulfillment f set state='DISPATCHING',purchase_attempt_id=$2,attempted_at=now(),updated_at=now() where f.litix_order_id=$1 and f.state='QUEUED' and f.supplier_order_id is null and exists(select 1 from public.litix_v2_orders o where o.id=$1 and ((f.payment_mode='card' and o.payment_state='paid' and o.payment_transaction_id is not null) or (f.payment_mode='admin' and f.approved_admin_id is not null))) and exists(select 1 from public.litix_boostero_services s where s.supplier_service_id=f.supplier_service_id and s.enabled=true) returning f.supplier_service_id",
  [orderId,attemptId]);
 if(!claimed.length)return {submitted:false,state:"not_eligible_or_already_claimed"};
 try{await sql.query("insert into public.litix_boostero_attempts(id,litix_order_id,kind,state) values($1,$2,'add','STARTED')",[attemptId,orderId]);}
 catch{return {submitted:false,state:"locked_audit_failure_requires_review"};}
 const orders=await sql.query("select o.destination,o.quantity,f.supplier_service_id from public.litix_v2_orders o join public.litix_boostero_fulfillment f on f.litix_order_id=o.id where o.id=$1",[orderId]);
 if(orders.length!==1)return {submitted:false,state:"manual_review"};
 let result;
 try{
  // Refresh current wholesale and remaining account balance just before spend.
  const {quote}=await verifyBoosteroQuote(String(orders[0].supplier_service_id),Number(orders[0].quantity),sql);
  const balance=await operation("balance");
  if(!Number.isFinite(Number(balance.balance))||Number(balance.balance)<quote.costUSD)throw Error("boostero_insufficient_balance");
  result=await operation("add",{service:quote.serviceId,link:orders[0].destination,quantity:quote.quantity},{claimed:true});
 }catch(err){
  const certain=["boostero_provider_rejected","boostero_insufficient_balance","boostero_wholesale_changed",
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
export async function syncBoosteroStatuses({sql=boosteroSQL(),operation=boosteroProduction,limit=20}={}){
 if(!boosteroProductionReady())return {checked:0,disabled:true};
 const orders=await sql.query("select litix_order_id,supplier_order_id,attempted_at,checked_at from public.litix_boostero_fulfillment where state in ('SUBMITTED','COMPLETED') and supplier_order_id is not null and (checked_at is null or checked_at<now()-interval '15 minutes') order by checked_at nulls first limit $1",[Math.min(20,limit)]);
 let checked=0,failed=0;
 for(const item of orders){
  try{
   const res=await operation("status",{order:item.supplier_order_id});
   const name=String(res.status||"").toLowerCase();
   const state=/^completed|complete|finished$/.test(name)?"COMPLETED":/^(canceled|cancelled|failed|error)$/.test(name)?"FAILED":"SUBMITTED";
   await sql.query("update public.litix_boostero_fulfillment set state=$2,supplier_status=$3::jsonb,checked_at=now(),updated_at=now() where litix_order_id=$1 and supplier_order_id=$4",
    [item.litix_order_id,state,JSON.stringify({status:String(res.status||"Unknown").slice(0,80),remains:res.remains??null,checked_at:new Date().toISOString()}),item.supplier_order_id]);
   if(state==="FAILED")await boosteroNotice(item.litix_order_id,null).catch(()=>{});
   checked++;
  }catch{failed++;}
 }
 return {checked,failed};
}
