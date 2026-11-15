import {after} from "next/server";
import {randomUUID} from "node:crypto";
import {boosteroProduction} from "./boosteroReadOnly.mjs";
import {
 boosteroSQL,boosteroOrderId,boosteroToken,hashBoostero,
 boosteroNotice,boosteroProductionReady,verifyBoosteroQuote
} from "./boosteroFulfillment.mjs";
import {quoteCuratedCart} from "./litixCartQuote.mjs";
import {publicServiceCardName} from "./serviceCardDisplay.mjs";

const headers={"cache-control":"no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"};
const send=(payload,status=200)=>Response.json(payload,{status,headers});
const message=e=>String(e?.message||"unknown").slice(0,90);
const validEmail=x=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)&&x.length<=254;
const audit=async(sql,orderId,ordinal,eventType,details={})=>sql.query(
 "insert into public.litix_order_proof_events(id,order_id,ordinal,event_type,details) values($1,$2,$3,$4,$5::jsonb)",
 [randomUUID(),orderId,ordinal,eventType,JSON.stringify(details)]
);
function ipFromRequest(request){
 const raw=request.headers.get("x-vercel-forwarded-for")||
  request.headers.get("x-forwarded-for")||"";
 const first=raw.split(",")[0]?.trim()||"";
 return /^[a-fA-F0-9:.]{3,48}$/.test(first)?first:"";
}
function linesFor(cart,link,bumpLink){
 const mainTarget=cart.main.destination;
 const extraTarget=cart.bump.destination;
 if(!mainTarget||!extraTarget)throw Error("cart_invalid_target");
 const p=cart.main.quote,b=cart.bump.quote;
 return [
  {ordinal:1,serviceId:String(cart.main.service.service),serviceName:p.serviceName,
   kind:p.kind,destination:mainTarget,quantity:p.quantity,retailCents:p.amountCents,
   costCents:p.wholesaleCents},
  {ordinal:2,serviceId:String(cart.bump.service.service),serviceName:b.serviceName,
   kind:b.kind,destination:extraTarget,quantity:b.quantity,retailCents:b.amountCents,
   costCents:b.wholesaleCents}
 ];
}
export async function dispatchCartLine(orderId,ordinal,{sql=boosteroSQL(),operation=boosteroProduction}={}){
 if(!boosteroProductionReady())return {submitted:false,state:"DISABLED"};
 const claimId=randomUUID();
 const rows=await sql.query(
  "update public.litix_cart_lines l set state='DISPATCHING',attempt_id=$3,attempted_at=now(),updated_at=now() where l.order_id=$1 and l.ordinal=$2 and l.state='QUEUED' and l.attempt_id is null and exists(select 1 from public.litix_v2_orders o where o.id=$1 and o.payment_state='paid' and o.payment_transaction_id is not null) returning l.supplier_service_id,l.destination,l.quantity,l.retail_cents",
  [orderId,ordinal,claimId]);
 if(rows.length!==1)return {submitted:false,state:"NOT_CLAIMED"};
 const item=rows[0];
 let supplierAttempted=false;
 try{
  await audit(sql,orderId,ordinal,"SUPPLIER_DISPATCH_STARTED");
  const {quote}=await verifyBoosteroQuote(String(item.supplier_service_id),Number(item.quantity));
  if(quote.amountCents>Number(item.retail_cents))
   throw Error("supplier_cost_changed_after_payment");
  const balance=await operation("balance");
  if(!Number.isFinite(Number(balance.balance))||Number(balance.balance)<quote.costUSD)
   throw Error("supplier_balance_insufficient");
  supplierAttempted=true;
  const result=await operation("add",{
   service:quote.serviceId,link:item.destination,quantity:quote.quantity
  },{claimed:true});
  const supplierId=String(result?.order||"");
  if(!/^[0-9]{1,24}$/.test(supplierId))throw Error("supplier_receipt_missing");
  const saved=await sql.query(
   "update public.litix_cart_lines set state='SUBMITTED',supplier_order_id=$4,supplier_status=$5::jsonb,updated_at=now() where order_id=$1 and ordinal=$2 and attempt_id=$3 and state='DISPATCHING' returning ordinal",
   [orderId,ordinal,claimId,supplierId,JSON.stringify({status:"Pending",checked_at:new Date().toISOString()})]);
  if(saved.length!==1)throw Error("supplier_receipt_storage_uncertain");
  await audit(sql,orderId,ordinal,"SUPPLIER_SUBMITTED",{supplierOrderId:supplierId});
  return {submitted:true,state:"SUBMITTED",ordinal};
 }catch(error){
  const state=supplierAttempted?"UNKNOWN_OUTCOME":"MANUAL_REVIEW";
  await sql.query(
   "update public.litix_cart_lines set state=$4,error_code=$5,updated_at=now() where order_id=$1 and ordinal=$2 and attempt_id=$3 and state='DISPATCHING'",
   [orderId,ordinal,claimId,state,message(error)]).catch(()=>{});
  await audit(sql,orderId,ordinal,supplierAttempted?"SUPPLIER_UNCERTAIN":"REVIEW_REQUIRED",
   {reason:message(error)}).catch(()=>{});
  return {submitted:false,state,ordinal,requiresReview:true};
 }
}
export async function dispatchCart(orderId,{sql=boosteroSQL(),operation=boosteroProduction}={}){
 const first=await dispatchCartLine(orderId,1,{sql,operation});
 const second=await dispatchCartLine(orderId,2,{sql,operation});
 const lines=await sql.query("select state from public.litix_cart_lines where order_id=$1 order by ordinal",[orderId]);
 const allSubmitted=lines.length===2&&lines.every(x=>["SUBMITTED","COMPLETED"].includes(x.state));
 await sql.query(
  "update public.litix_boostero_fulfillment set state=$2,updated_at=now() where litix_order_id=$1 and state='MANUAL_REVIEW'",
  [orderId,allSubmitted?"SUBMITTED":"MANUAL_REVIEW"]).catch(()=>{});
 await sql.query(
  "update public.litix_v2_orders set fulfillment_state=$2,updated_at=now() where id=$1 and payment_state='paid'",
  [orderId,allSubmitted?"submitted":"manual_review"]).catch(()=>{});
 return {submitted:allSubmitted,state:allSubmitted?"SUBMITTED":"MANUAL_REVIEW",lines:[first,second]};
}

export async function handleCartPurchase(request,{sql=boosteroSQL(),operation=boosteroProduction}={}){
 if(process.env.VERCEL_ENV!=="production"||!boosteroProductionReady()||
    process.env.LITIX_CART_BUMPS_ENABLED!=="true")
  return send({error:"Cart checkout is not enabled. No payment attempted.",chargeAttempted:false},503);
 if(request.headers.get("origin")!==new URL(request.url).origin)
  return send({error:"same_origin_required",chargeAttempted:false},403);
 let data;
 try{
  const raw=await request.text();
  if(raw.length>6000)return send({error:"Invalid cart request",chargeAttempted:false},413);
  data=JSON.parse(raw);
 }catch{return send({error:"Invalid cart request",chargeAttempted:false},400);}
 const quantity=Number(data.quantity),email=String(data.email||"").trim().toLowerCase();
 const idem=String(data.idempotencyKey||""),token=String(data.paymentToken||"");
 if(!/^[a-f0-9-]{36}$/.test(idem)||!validEmail(email)||
    !Number.isSafeInteger(quantity)||quantity<1||quantity>1000000||
    token.length<10||token.length>500||!process.env.NMI_SECURITY_KEY)
  return send({error:"Review your payment and order details.",chargeAttempted:false},422);
 let cart;
 try{
  cart=await quoteCuratedCart({
   serviceId:data.serviceId,quantity,includeBump:true,
   mainTarget:data.link,bumpTarget:data.bumpLink||"",operation
  });
 }catch{return send({error:"Both services and destinations must be verified before payment.",chargeAttempted:false},409);}
 if(!cart.main.destination||!cart.bump?.destination)
  return send({error:"A valid public post link is required for the added service.",chargeAttempted:false},422);
 if(cart.totalCents!==Number(data.expectedAmountCents))
  return send({error:"Cart pricing changed. Review your total; no payment attempted.",chargeAttempted:false},409);
 const lines=linesFor(cart,data.link,data.bumpLink);
 const balance=await operation("balance").catch(()=>null);
 const totalCost=cart.main.quote.costUSD+cart.bump.quote.costUSD;
 if(!balance||!Number.isFinite(Number(balance.balance))||Number(balance.balance)<totalCost)
  return send({error:"These services are temporarily unavailable. No payment attempted.",chargeAttempted:false},409);
 const orderId=boosteroOrderId(),secret=boosteroToken();
 const platform=cart.main.quote.platform,mainKind=cart.main.quote.kind;
 const publicTitle=platform+" "+mainKind+" + "+cart.bump.quantity+" "+cart.bump.kind;
 try{
  const ids=[...new Set(lines.map(x=>x.serviceId))];
  await sql.query(
   "insert into public.litix_boostero_service_registry(supplier_service_id) select unnest($1::text[]) on conflict(supplier_service_id) do nothing",[ids]);
  const ip=ipFromRequest(request);
  const result=await sql.query(
   `with new_order as (
     insert into public.litix_v2_orders(
      id,email,service_id,service_name,category,destination,quantity,
      amount_cents,supplier_cost_cents,idempotency_key,tracking_token_hash,
      metadata,payment_state,fulfillment_state
     ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,'processing','pending')
     on conflict(idempotency_key) do nothing returning id
    ), fulfillment as (
     insert into public.litix_boostero_fulfillment(
      litix_order_id,supplier_service_id,payment_mode,state
     ) select id,$13,'card','PENDING_PAYMENT' from new_order returning litix_order_id
    ), lines as (
     insert into public.litix_cart_lines(
      order_id,ordinal,supplier_service_id,service_name,service_kind,destination,
      quantity,retail_cents,supplier_cost_cents,state
     ) select f.litix_order_id,(x->>'ordinal')::smallint,x->>'serviceId',
      x->>'serviceName',x->>'kind',x->>'destination',
      (x->>'quantity')::int,(x->>'retailCents')::int,(x->>'costCents')::int,
      'PENDING_PAYMENT'
     from fulfillment f cross join jsonb_array_elements($14::jsonb) x
     returning ordinal
    ), proof as (
     insert into public.litix_order_proof(order_id,buyer_ip,user_agent,checkout_source)
     select id,nullif($15,'')::inet,$16,'curated_cart' from new_order returning order_id
    ) select (select count(*)::int from lines) as items,
       (select count(*)::int from proof) as proof_records`,
   [orderId,email,lines[0].serviceId,publicTitle,
    "Litix "+platform+" cart",cart.main.destination,cart.quantity,
    cart.totalCents,lines.reduce((n,l)=>n+l.costCents,0),
    idem,hashBoostero(secret),
    JSON.stringify({supplier:"boostero",cart:true,curatedSku:data.serviceId,
     mainKind,bumpKind:cart.bump.kind,bumpQuantity:cart.bump.quantity}),
    lines[0].serviceId,JSON.stringify(lines),ip,
    String(request.headers.get("user-agent")||"").slice(0,600)]);
  if(result[0]?.items!==2||result[0]?.proof_records!==1)
   return send({error:"Checkout already submitted or ledger incomplete; no repeat payment.",chargeAttempted:false},409);
  await audit(sql,orderId,null,"CHECKOUT_CREATED",{items:2,amountCents:cart.totalCents});
 }catch{
  return send({error:"The secure order ledger is unavailable. No payment attempted.",chargeAttempted:false},503);
 }
 let gateway;
 try{
  const r=await fetch("https://paykings.transactiongateway.com/api/transact.php",{
   method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},cache:"no-store",
   signal:AbortSignal.timeout(18000),
   body:new URLSearchParams({security_key:process.env.NMI_SECURITY_KEY,type:"sale",
    payment_token:token,amount:(cart.totalCents/100).toFixed(2),orderid:orderId,email})
  });
  if(!r.ok)throw Error("gateway_unavailable");
  gateway=Object.fromEntries(new URLSearchParams(await r.text()));
 }catch{
  await sql.query("update public.litix_v2_orders set payment_state='review' where id=$1",[orderId]).catch(()=>{});
  await audit(sql,orderId,null,"PAYMENT_UNCERTAIN").catch(()=>{});
  return send({orderId,payment:"review",message:"Payment outcome unknown; do not place another order."},202);
 }
 if(String(gateway.response)!=="1"){
  await sql.query("update public.litix_v2_orders set payment_state='declined' where id=$1",[orderId]).catch(()=>{});
  await audit(sql,orderId,null,"PAYMENT_DECLINED").catch(()=>{});
  return send({orderId,payment:"declined",message:"Payment was not approved. No supplier order placed."},402);
 }
 const tx=String(gateway.transactionid||"");
 if(!/^[A-Za-z0-9-]{3,100}$/.test(tx)){
  await sql.query("update public.litix_v2_orders set payment_state='review' where id=$1",[orderId]).catch(()=>{});
  await audit(sql,orderId,null,"PAYMENT_UNCERTAIN",{reason:"missing_gateway_transaction"}).catch(()=>{});
  return send({orderId,payment:"review",message:"Approved payment requires reconciliation; no supplier order placed."},202);
 }
 try{
  const released=await sql.query(
   `with paid as (
     update public.litix_v2_orders set payment_state='paid',
      payment_transaction_id=$2,fulfillment_state='pending',updated_at=now()
     where id=$1 and payment_state='processing' returning id
    ), parent as (
     update public.litix_boostero_fulfillment set state='MANUAL_REVIEW',updated_at=now()
      where litix_order_id in(select id from paid) and state='PENDING_PAYMENT'
      returning litix_order_id
    )
    update public.litix_cart_lines set state='QUEUED',updated_at=now()
    where order_id in(select litix_order_id from parent) and state='PENDING_PAYMENT'
    returning ordinal`,[orderId,tx]);
  if(released.length!==2)throw Error("payment_release_incomplete");
  await audit(sql,orderId,null,"PAYMENT_APPROVED",{transactionId:tx,amountCents:cart.totalCents});
 }catch{
  after(()=>boosteroNotice(orderId,null).catch(()=>{}));
  return send({orderId,payment:"paid",fulfillment:"manual_review",
   message:"Payment approved; fulfillment needs ledger reconciliation. Do not reorder."},202);
 }
 const result=await dispatchCart(orderId,{sql,operation}).catch(()=>({
  submitted:false,state:"MANUAL_REVIEW",requiresReview:true
 }));
 after(()=>boosteroNotice(orderId,secret).catch(()=>{}));
 return send({orderId,secret,payment:"paid",fulfillment:result.state,
  message:result.submitted?"Payment approved. Both items have been submitted.":"Payment approved. Your cart requires a delivery review; do not purchase again."},
  result.submitted?200:202);
}
