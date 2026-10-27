import {neon} from "@neondatabase/serverless";
import {randomUUID,createHash} from "node:crypto";
import {ownerSupplierAPI,ownerWholesaleCatalog,wholesaleQuote,ownerProfile} from "./ownerWholesale.mjs";

export const ownerDB=()=>{
 const url=process.env.LITIX_OWNER_DATABASE_URL||process.env.LITIX_BOOSTERO_DATABASE_URL||process.env.LITIX_V2_DATABASE_URL;
 if(!url)throw Error("owner_database_not_configured");
 return neon(url);
};
export const ownerPurchasesEnabled=()=>process.env.VERCEL_ENV==="production"&&
 process.env.LITIX_OWNER_WHOLESALE_PURCHASES==="true";
export const ownerCardEnabled=()=>ownerPurchasesEnabled()&&process.env.LITIX_OWNER_PAYKINGS_ENABLED==="true"&&
 !!process.env.NMI_SECURITY_KEY&&!!process.env.LITIX_OWNER_PAYKINGS_FEE_BPS&&
 !!process.env.LITIX_OWNER_PAYKINGS_FEE_FIXED_CENTS;
const hash=x=>createHash("sha256").update(String(x)).digest("hex");
const money=n=>"$"+(Number(n)/100).toFixed(2);
export const ownerGatewayFee=cents=>{
 if(!ownerCardEnabled())throw Error("owner_card_checkout_disabled");
 const bps=Number(process.env.LITIX_OWNER_PAYKINGS_FEE_BPS),fixed=Number(process.env.LITIX_OWNER_PAYKINGS_FEE_FIXED_CENTS);
 if(!Number.isSafeInteger(bps)||bps<0||bps>1500||!Number.isSafeInteger(fixed)||fixed<0||fixed>1000)
  throw Error("owner_card_fee_not_verified");
 return Math.ceil(cents*bps/10000)+fixed;
};
export async function currentOwnerQuote({provider,serviceId,quantity,profile,paymentMethod}){
 const destination=ownerProfile(profile);
 if(!destination)throw Error("invalid_instagram_profile");
 if(!["smmglob","boostero"].includes(provider)||!/^\d{1,12}$/.test(String(serviceId)))throw Error("invalid_supplier_service");
 const rows=(await ownerWholesaleCatalog()).services.filter(x=>x.provider===provider&&x.id===serviceId);
 if(rows.length!==1)throw Error("supplier_service_unavailable");
 const service=rows[0],price=wholesaleQuote(service,quantity);
 const method=String(paymentMethod||"supplier_balance");
 if(!["supplier_balance","paykings"].includes(method))throw Error("invalid_payment_method");
 const fee=method==="paykings"?ownerGatewayFee(price.costCents):0;
 const total=price.costCents+fee;
 if(method==="paykings"&&total<500)throw Error("owner_card_minimum_five_dollars");
 if(!Number.isSafeInteger(total)||total<=0||total>1000000)throw Error("owner_charge_out_of_range");
 return {service,provider,serviceId:service.id,destination,quantity:price.quantity,wholesalePer1000:service.pricePer1000,
  wholesaleCents:price.costCents,feeCents:fee,totalCents:total,paymentMethod:method};
}
export async function ownerBalance(provider){
 const x=await ownerSupplierAPI(provider,"balance");
 const value=Number(x.balance);if(!Number.isFinite(value)||value<0)throw Error("supplier_balance_invalid");
 return {amount:value,currency:String(x.currency||"USD").slice(0,5)};
}
export async function dispatchOwnerOrder(id,{db=null,operation=ownerSupplierAPI,quoteProvider=currentOwnerQuote}={}){
 if(!ownerPurchasesEnabled())throw Error("owner_purchases_disabled");
 db=db||ownerDB();
 const rows=await db.query(
  "update public.litix_owner_wholesale_orders set state='DISPATCHING',attempt_id=$2,updated_at=now() where id=$1 and state='QUEUED' and ((payment_method='supplier_balance' and payment_state='not_required') or (payment_method='paykings' and payment_state='paid' and payment_transaction_id is not null)) returning *",
  [id,randomUUID()]);
 if(rows.length!==1)return {state:"already_dispatched_or_unpaid",submitted:false};
 const o=rows[0],attempt=o.attempt_id;
 try{await db.query(
  "insert into public.litix_owner_wholesale_attempts(id,order_id,action,state) values($1,$2,'add','STARTED')",
  [attempt,id])}
 catch{return {state:"audit_ledger_unavailable",submitted:false,requiresReview:true}}
 let result;
 try{
  const q=await quoteProvider({provider:o.provider,serviceId:o.supplier_service_id,quantity:Number(o.quantity),
   profile:o.destination,paymentMethod:o.payment_method});
  if(q.wholesaleCents>Number(o.supplier_cost_cents)||q.totalCents>Number(o.total_charge_cents))throw Error("supplier_price_increased");
  const balance=await operation(o.provider,"balance");
  if(!Number.isFinite(Number(balance.balance))||Number(balance.balance)+1e-7<q.wholesaleCents/100)
   throw Error("supplier_insufficient_funds");
  result=await operation(o.provider,"add",{service:o.supplier_service_id,link:o.destination,quantity:o.quantity},{oneTimeLocked:true});
 }catch(err){
  const definitive=["supplier_definitely_rejected","supplier_price_increased","supplier_insufficient_funds",
   "supplier_quantity_invalid","supplier_service_unavailable","invalid_supplier_service"].includes(String(err.message));
  const state=definitive?"REJECTED":"UNKNOWN_OUTCOME";
  await Promise.allSettled([
   db.query("update public.litix_owner_wholesale_orders set state=$2,updated_at=now() where id=$1 and state='DISPATCHING' and attempt_id=$3",[id,state,attempt]),
   db.query("update public.litix_owner_wholesale_attempts set state=$2,finished_at=now() where id=$1",[attempt,state])
  ]);
  return {state,submitted:false,requiresReview:true};
 }
 const supplierId=String(result.order);
 try{
  const saved=await db.query(
   "update public.litix_owner_wholesale_orders set state='SUBMITTED',supplier_order_id=$2,updated_at=now() where id=$1 and state='DISPATCHING' and attempt_id=$3 returning id",
   [id,supplierId,attempt]);
  if(!saved.length)throw Error("unexpected_ledger_conflict");
  await db.query("update public.litix_owner_wholesale_attempts set state='CONFIRMED',supplier_order_id=$2,finished_at=now() where id=$1",[attempt,supplierId]);
  return {state:"SUBMITTED",submitted:true,supplierOrderId:supplierId};
 }catch{return {state:"UNKNOWN_OUTCOME",submitted:false,requiresReview:true}}
}
export async function ownerCreateOrder(sub,data,{db=null,getQuote=currentOwnerQuote,operation=ownerSupplierAPI}={}){
 if(!ownerPurchasesEnabled())throw Error("owner_purchases_disabled");
 db=db||ownerDB();
 const idem=String(data?.idempotencyKey||"");
 if(!/^[0-9a-f-]{36}$/i.test(idem)||data?.confirmed!==true)throw Error("final_owner_confirmation_required");
 const q=await getQuote(data);
 if(data?.expectedWholesaleCents!==q.wholesaleCents||data?.expectedTotalCents!==q.totalCents)
  throw Error("supplier_price_changed_review_before_purchasing");
 if(data.paymentMethod==="paykings"&&!ownerCardEnabled())throw Error("owner_card_checkout_disabled");
 const initial=(await operation(q.provider,"balance")).balance;
 if(!Number.isFinite(Number(initial))||Number(initial)+1e-7<q.wholesaleCents/100)throw Error("supplier_balance_too_low");
 const baseline=data?.originalFollowers===null||data?.originalFollowers===""||data?.originalFollowers===undefined?null:Number(data.originalFollowers);
 if(baseline!==null&&(!Number.isSafeInteger(baseline)||baseline<0||baseline>1000000000))
  throw Error("invalid_original_follower_count");
 const fingerprint=hash(JSON.stringify([sub,q.provider,q.serviceId,q.destination,q.quantity,q.wholesaleCents,q.totalCents,q.paymentMethod]));
 const orderId="low_"+randomUUID();
 let inserted;
 try{
  inserted=await db.query(
   "insert into public.litix_owner_wholesale_orders(id,owner_sub,idempotency_key,fingerprint,provider,supplier_service_id,service_name,destination,quantity,wholesale_per_1000,supplier_cost_cents,total_charge_cents,payment_method,payment_state,baseline_followers) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) on conflict(owner_sub,idempotency_key) do nothing returning id",
   [orderId,sub,idem,fingerprint,q.provider,q.serviceId,q.service.name,q.destination,q.quantity,q.wholesalePer1000,
    q.wholesaleCents,q.totalCents,q.paymentMethod,q.paymentMethod==="paykings"?"processing":"not_required",baseline]);
 }catch{throw Error("owner_order_ledger_unavailable")}
 if(inserted.length!==1)throw Error("duplicate_purchase_blocked_do_not_retry");
 if(q.paymentMethod==="paykings"){
  const token=String(data.paymentToken||"");
  if(token.length<10||token.length>500){await db.query("update public.litix_owner_wholesale_orders set payment_state='declined' where id=$1",[orderId]);throw Error("collectjs_token_required")}
  let reply;
  try{
   const r=await fetch("https://paykings.transactiongateway.com/api/transact.php",{
    method:"POST",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(18000),
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({security_key:process.env.NMI_SECURITY_KEY,type:"sale",
     payment_token:token,amount:(q.totalCents/100).toFixed(2),orderid:orderId})});
   if(!r.ok)throw Error("gateway_connection_uncertain");
   reply=Object.fromEntries(new URLSearchParams(await r.text()));
  }catch{
   await db.query("update public.litix_owner_wholesale_orders set payment_state='review' where id=$1",[orderId]).catch(()=>{});
   return {orderId,payment:"review",submitted:false,message:"Gateway outcome unknown. Do not pay again."};
  }
  if(reply.response!=="1"||!/^[A-Za-z0-9-]{3,100}$/.test(String(reply.transactionid||""))){
   await db.query("update public.litix_owner_wholesale_orders set payment_state=$2 where id=$1",[orderId,
    reply.response==="1"?"review":"declined"]).catch(()=>{});
   return {orderId,payment:reply.response==="1"?"review":"declined",submitted:false,
    message:"No supplier purchase. Payment requires review or was declined."};
  }
  try{
   const changed=await db.query(
    "update public.litix_owner_wholesale_orders set payment_state='paid',payment_transaction_id=$2,updated_at=now() where id=$1 and payment_state='processing' returning id",
    [orderId,String(reply.transactionid)]);
   if(changed.length!==1)throw Error("gateway_approval_not_persisted");
  }catch{return {orderId,payment:"review",submitted:false,message:"Approved gateway transaction requires reconciliation. No supplier order sent."}}
 }
 const outcome=await dispatchOwnerOrder(orderId,{db,operation,getQuote});
 await sendOwnerWholesaleNotice(orderId,{db}).catch(()=>{});
 return {orderId,payment:q.paymentMethod==="paykings"?"paid":"not_required",...outcome,costCents:q.wholesaleCents,
  totalCents:q.totalCents,feesCents:q.feeCents,provider:q.provider};
}
export async function ownerOrderRows(sub,{db=ownerDB(),limit=75}={}){
 return db.query("select id,provider,supplier_service_id,service_name,destination,quantity,supplier_cost_cents,total_charge_cents,payment_method,payment_state,state,supplier_order_id,supplier_status,baseline_followers,last_checked_at,created_at from public.litix_owner_wholesale_orders where owner_sub=$1 order by created_at desc limit $2",[sub,Math.min(limit,75)]);
}
export async function ownerRefreshOrder(sub,id,{db=ownerDB(),operation=ownerSupplierAPI}={}){
 const rows=await db.query("select * from public.litix_owner_wholesale_orders where id=$1 and owner_sub=$2",[id,sub]);
 if(rows.length!==1)throw Error("order_not_found");
 const o=rows[0];if(!o.supplier_order_id)return o;
 const last=Date.parse(String(o.last_checked_at||""));
 if(Number.isFinite(last)&&Date.now()-last<60000)return o;
 let supplier;
 try{supplier=await operation(o.provider,"status",{order:String(o.supplier_order_id)})}
 catch{return o}
 const status=String(supplier?.status||"Unknown").slice(0,80);
 const remains=Number(supplier?.remains);
 const validRemains=Number.isSafeInteger(remains)&&remains>=0&&remains<=Number(o.quantity)?remains:null;
 const state=/^(completed|complete|finished)$/i.test(status)?"COMPLETED":
  /^(cancelled|canceled|failed)$/i.test(status)?"FAILED":"SUBMITTED";
 const snap={status,remains:validRemains,completed:validRemains===null?null:Math.max(0,Number(o.quantity)-validRemains),
  checkedAt:new Date().toISOString()};
 const saved=await db.query(
 "update public.litix_owner_wholesale_orders set supplier_status=$3::jsonb,last_checked_at=now(),state=$4,updated_at=now() where id=$1 and owner_sub=$2 and supplier_order_id=$5 returning *",
 [id,sub,JSON.stringify(snap),state,o.supplier_order_id]);
 if(state==="FAILED"||state==="COMPLETED")await sendOwnerWholesaleNotice(id,{db,event:state}).catch(()=>{});
 return saved[0]||o;
}


export async function sendOwnerWholesaleNotice(id,{db=ownerDB(),event="receipt",fetcher=fetch}={}){
 const credential=process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY;
 if(!credential)return {sent:false,reason:"email_not_configured"};
 const rows=await db.query(
  "select id,provider,supplier_service_id,destination,quantity,supplier_cost_cents,total_charge_cents,payment_method,payment_state,state,supplier_order_id,supplier_status,notification_state from public.litix_owner_wholesale_orders where id=$1",[id]);
 if(rows.length!==1)return {sent:false,reason:"order_not_found"};
 const o=rows[0];
 if(event==="receipt"&&o.notification_state==="SENT")return {sent:false,reason:"already_notified"};
 const body=[
  "PRIVATE LITIX WHOLESALE ORDER — "+String(event).toUpperCase(),
  "Litix owner order: "+o.id,"Supplier: "+o.provider+" #"+o.supplier_service_id,
  "Destination: "+o.destination,"Quantity: "+o.quantity,
  "Supplier wholesale: $"+(Number(o.supplier_cost_cents)/100).toFixed(2),
  "Card total (if applicable): $"+(Number(o.total_charge_cents)/100).toFixed(2),
  "Payment: "+o.payment_method+" / "+o.payment_state,
  "Supplier ID: "+(o.supplier_order_id||"Not independently confirmed"),
  "Fulfillment: "+o.state,
  "Provider status: "+String(o.supplier_status?.status||"Not yet reported").slice(0,80),
  "Supplier acceptance is not independent confirmation of Instagram delivery."
 ].join("\n");
 try{
  const response=await fetcher("https://api.resend.com/emails",{
   method:"POST",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000),
   headers:{"authorization":"Bearer "+credential,"content-type":"application/json",
    "Idempotency-Key":"litix-owner-wholesale-"+event+"-"+id},
   body:JSON.stringify({from:"Litix <orders@litix.net>",to:["litixsocial@gmail.com","litgnosisllc@gmail.com"],
    subject:"Litix private wholesale "+event+": "+id,text:body})
  });
  if(!response.ok)throw Error("owner_email_delivery_unconfirmed");
  if(event==="receipt")await db.query("update public.litix_owner_wholesale_orders set notification_state='SENT' where id=$1 and notification_state='PENDING'",[id]);
  return {sent:true};
 }catch{return {sent:false,reason:"email_delivery_unconfirmed"}}
}
export async function pollOwnerOrders({db=ownerDB(),limit=12}={}){
 if(!ownerPurchasesEnabled())return {checked:0,disabled:true};
 const rows=await db.query("select id,owner_sub,created_at,last_checked_at,state from public.litix_owner_wholesale_orders where state='SUBMITTED' and (last_checked_at is null or last_checked_at<now()-interval '15 minutes') order by last_checked_at nulls first limit $1",[Math.min(12,limit)]);
 let checked=0,failed=0;
 for(const item of rows){
  try{
   await ownerRefreshOrder(item.owner_sub,item.id,{db});
   if(Date.now()-new Date(item.created_at).getTime()>86400000)
    await sendOwnerWholesaleNotice(item.id,{db,event:"delayed"}).catch(()=>{});
   checked++;
  }catch{failed++}
 }
 return {checked,failed};
}
