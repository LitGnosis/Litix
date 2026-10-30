import {after} from "next/server";
import {randomUUID} from "node:crypto";
import {resolveTikTokVideoLink} from "./tiktokVideoLinks.mjs";
import {boosteroProduction,boosteroCompatibleServices} from "./boosteroReadOnly.mjs";
import {boosteroAdminAuthorized,boosteroProductionReady,boosteroSQL,boosteroDestination,verifyBoosteroQuote,
 boosteroOrderId,boosteroToken,hashBoostero,dispatchBoostero,boosteroNotice,boosteroQuote} from "./boosteroFulfillment.mjs";
const send=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"}});
const validId=s=>/^ltx2_[a-f0-9-]{36}$/.test(String(s||""));
export async function handleBoosteroOrder(request,{adminOnly=true}={}){
 // Existing internal route remains owner-authenticated; storefront paths are restricted to card purchase.
 if(adminOnly&&!boosteroAdminAuthorized(request.headers.get("authorization")))return send({error:"Unauthorized"},401);
 if(!boosteroProductionReady())return send({error:"Boostero live purchases are disabled"},503);
 const origin=request.headers.get("origin");
 if(origin&&origin!==new URL(request.url).origin)return send({error:"Invalid origin"},403);
 let data;
 try{const raw=await request.text();if(raw.length>6000)return send({error:"Oversized request"},413);data=JSON.parse(raw)}
 catch{return send({error:"Invalid JSON"},400)}
 const action=String(data?.action||(adminOnly?"":"card_purchase"));
 if(!adminOnly&&action!=="card_purchase")return send({error:"Customer actions must use verified card checkout"},403);
 const sql=boosteroSQL();
 if(action==="refill"){
  const orderId=String(data.orderId||"");
  if(!validId(orderId))return send({error:"Invalid order ID"},400);
  const rows=await sql.query("select o.id,f.supplier_order_id,f.supplier_service_id,f.state from public.litix_v2_orders o join public.litix_boostero_fulfillment f on f.litix_order_id=o.id where o.id=$1 and f.state in('SUBMITTED','COMPLETED')",[orderId]);
  if(rows.length!==1||!rows[0].supplier_order_id)return send({error:"No eligible confirmed Boostero order"},409);
  let service;
  try{service=boosteroCompatibleServices(await boosteroProduction("services")).find(s=>s.id===rows[0].supplier_service_id)}
  catch{return send({error:"Live supplier eligibility cannot be verified"},503)}
  if(!service?.apiRefillEligible)return send({error:"Supplier API refill not available; no request sent"},409);
  const attemptId=randomUUID();
  try{await sql.query("insert into public.litix_boostero_attempts(id,litix_order_id,kind,state) values($1,$2,'refill','STARTED')",[attemptId,orderId]);}
  catch{return send({error:"Refill already attempted; reconcile supplier before another request"},409)}
  try{
   const result=await boosteroProduction("refill",{order:String(rows[0].supplier_order_id)},{adminApproved:true});
   await sql.query("update public.litix_boostero_attempts set state='CONFIRMED',finished_at=now() where id=$1",[attemptId]);
   return send({orderId,refillRequested:true,supplierResponse:!!result.refill||!!result.success});
  }catch{
   await sql.query("update public.litix_boostero_attempts set state='UNKNOWN_OUTCOME',error_code='needs_manual_reconciliation',finished_at=now() where id=$1",[attemptId]).catch(()=>{});
   return send({orderId,refillRequested:false,requiresReview:true},202);
  }
 }
 if(!["quote","card_purchase","admin_purchase"].includes(action))return send({error:"Unknown action"},404);
 const id=String(data?.serviceId||""),email=String(data?.email||"").trim().toLowerCase(),quantity=Number(data?.quantity);
 if(!/^\d{1,12}$/.test(id)||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return send({error:"Invalid service/quantity/contact"},422);
 let quote,supplierService;
 try{({quote,service:supplierService}=await verifyBoosteroQuote(id,quantity,sql))}
 catch(e){return send({error:String(e.message||"Unable to verify live quote").slice(0,100)},409)}
 const multiple=Array.isArray(data?.postAllocations)&&data.postAllocations.length>1;
 let verifiedPosts=[];
 if(multiple){
  if(action!=="card_purchase"||String(quote.platform).toLowerCase()!=="tiktok"||
     quote.kind!=="likes"||data.postAllocations.length>5)
   return send({error:"Multi-post checkout supports 2–5 TikTok Likes videos only"},422);
  const seen=new Set();
  let totalQty=0,totalCents=0,totalWholesale=0,totalCost=0;
  for(const item of data.postAllocations){
   const count=Number(item?.quantity);
   if(!Number.isSafeInteger(count))
    return send({error:"Each video's like quantity must be a whole number"},422);
   let one;
   try{one=boosteroQuote({service:supplierService,quantity:count})}
   catch{return send({error:"Each video must meet the minimum and maximum quantity; no charge attempted"},422)}
   let canonical;
   try{canonical=await resolveTikTokVideoLink(item?.link)}
   catch(e){return send({error:String(e.message||"TikTok link not supported").slice(0,160)},422)}
   if(seen.has(canonical))return send({error:"Each TikTok video must be selected only once"},422);
   seen.add(canonical);
   totalQty+=count;totalCents+=one.amountCents;totalWholesale+=one.wholesaleCents;totalCost+=one.costUSD;
   verifiedPosts.push({link:canonical,quantity:count,amountCents:one.amountCents});
  }
  if(totalQty!==quantity||totalQty>Number(supplierService.max)||totalCents>100000000)
   return send({error:"Invalid multi-post quantities; no charge attempted"},422);
  quote={...quote,amountCents:totalCents,wholesaleCents:totalWholesale,costUSD:totalCost};
 }
 let destinationInput=multiple?verifiedPosts[0].link:data?.destination;
 if(String(quote.platform).toLowerCase()==="tiktok"&&quote.kind==="likes"){
  try{destinationInput=await resolveTikTokVideoLink(destinationInput);}
  catch(e){return send({error:String(e.message||"TikTok video link could not be verified").slice(0,160)},422)}
 }
 const destination=boosteroDestination(destinationInput,quote.platform,quote.kind);
 if(!destination)return send({error:"Enter a valid public service destination URL. Followers need a public profile; Likes need a post/video link."},422);
 if(action==="quote")return send({approved:true,serviceId:id,serviceName:quote.serviceName,quantity,
  amountCents:quote.amountCents,supplierCostCents:quote.wholesaleCents,destination,minimumCheckoutCents:100});
 if(Number(data?.expectedAmountCents)!==quote.amountCents)return send({error:"Live price changed; no payment attempted"},409);
 const idem=String(data?.idempotencyKey||"");
 if(!/^[a-f0-9-]{36}$/.test(idem))return send({error:"Idempotency key required"},422);
 const paymentMode=action==="card_purchase"?"card":"admin";
 const gatewayToken=String(data?.paymentToken||"");
 if(paymentMode==="card"&&(gatewayToken.length<10||gatewayToken.length>500))return send({error:"Collect.js token required"},422);
 if(paymentMode==="card"&&!process.env.NMI_SECURITY_KEY)return send({error:"Production gateway unavailable"},503);
 if(paymentMode==="admin"&&String(data?.approvedCostCents)!==String(quote.wholesaleCents))
  return send({error:"Admin must explicitly approve live supplier cost"},409);
 // Only validated Default services with a current supplier quote can enter this idempotent payment ledger.
 let balance;
 try{balance=await boosteroProduction("balance")}
 catch{return send({error:"Cannot verify Boostero balance; no payment attempted"},503)}
 if(!Number.isFinite(Number(balance.balance))||Number(balance.balance)<quote.costUSD)
  return send({error:"Boostero wallet insufficient to fulfill; no payment attempted"},409);
 const orderId=boosteroOrderId(),secret=boosteroToken();
 let inserted;
 try{
  const rows=await sql.query(
   "with new_order as (insert into public.litix_v2_orders(id,email,service_id,service_name,category,destination,quantity,amount_cents,supplier_cost_cents,idempotency_key,tracking_token_hash,metadata,payment_state,fulfillment_state) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,'pending') on conflict(idempotency_key) do nothing returning id), selected as (insert into public.litix_boostero_fulfillment(litix_order_id,supplier_service_id,payment_mode,state,approved_admin_id) select id,$3,$14,$15,$16 from new_order returning litix_order_id) select litix_order_id from selected",
   [orderId,email,id,quote.serviceName,"Boostero "+quote.platform+" "+quote.kind,destination,quantity,quote.amountCents,
    quote.wholesaleCents,idem,hashBoostero(secret),JSON.stringify({supplier:"boostero",adminOnly:true,...(multiple?{postAllocations:verifiedPosts,fulfillmentMode:"litix_assisted_multi_post"}:{})}),paymentMode==="admin"?"admin_authorized":"processing",
    paymentMode,paymentMode==="admin"?"QUEUED":"PENDING_PAYMENT",paymentMode==="admin"?"owner":null]);
  inserted=rows.length===1;
 }catch{return send({error:"Cannot create safe order ledger; no charge attempted"},503)}
 if(!inserted)return send({error:"Checkout already submitted; no repeat charge or purchase"},409);
 if(paymentMode==="card"){
  let response;
  try{
   const r=await fetch("https://paykings.transactiongateway.com/api/transact.php",{
    method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},cache:"no-store",signal:AbortSignal.timeout(18000),
    body:new URLSearchParams({security_key:process.env.NMI_SECURITY_KEY,type:"sale",payment_token:gatewayToken,
     amount:(quote.amountCents/100).toFixed(2),orderid:orderId,email})});
   if(!r.ok)throw Error("gateway_unavailable");
   response=Object.fromEntries(new URLSearchParams(await r.text()));
  }catch{
   await sql.query("update public.litix_v2_orders set payment_state='review' where id=$1",[orderId]).catch(()=>{});
   return send({orderId,payment:"review",message:"Payment outcome unknown: do not submit another purchase"},202);
  }
  if(String(response.response)!=="1"){
   await sql.query("update public.litix_v2_orders set payment_state='declined' where id=$1",[orderId]).catch(()=>{});
   return send({orderId,payment:"declined",message:"Card declined; no Boostero purchase"},402);
  }
  const transaction=String(response.transactionid||"");
  if(!/^[A-Za-z0-9-]{3,100}$/.test(transaction)){
   await sql.query("update public.litix_v2_orders set payment_state='review' where id=$1",[orderId]).catch(()=>{});
   return send({orderId,payment:"review",message:"Gateway approval missing transaction ID; reconcile before fulfillment"},202);
  }
  try{
   const marked=await sql.query(
    "with verified as (update public.litix_v2_orders set payment_state='paid',payment_transaction_id=$2,fulfillment_state=$3,updated_at=now() where id=$1 and payment_state='processing' returning id) update public.litix_boostero_fulfillment set state=$4,updated_at=now() where litix_order_id in(select id from verified) and state='PENDING_PAYMENT' returning litix_order_id",
    [orderId,transaction,multiple?"manual_review":"pending",multiple?"MANUAL_REVIEW":"QUEUED"]);
   if(marked.length!==1)throw Error("payment_persist_mismatch");
  }catch{
   after(()=>boosteroNotice(orderId,null).catch(()=>{}));
   return send({orderId,payment:"paid",fulfillment:"manual_review",message:"Approved payment needs ledger reconciliation; supplier NOT submitted"},202);
  }
 }
 const attempt=multiple?{submitted:false,state:"MANUAL_REVIEW",requiresReview:false}:
  await dispatchBoostero(orderId).catch(()=>({submitted:false,state:"UNKNOWN_OUTCOME",requiresReview:true}));
 after(async()=>{await Promise.allSettled([
  boosteroNotice(orderId,paymentMode==="card"?secret:null),
  ...(attempt.requiresReview?[boosteroNotice(orderId,null)]:[])
 ]);});
 return send({orderId,secret:paymentMode==="card"?secret:undefined,payment:paymentMode==="card"?"paid":"admin_authorized",
  fulfillment:attempt.state,supplierOrderId:attempt.supplierOrderId||null,supplierSubmitted:attempt.submitted===true,
  message:multiple?"Payment confirmed. Litix will fulfill each selected video separately; do not place a duplicate order.":attempt.submitted?"Supplier order accepted and stored":"Order requires owner review; do NOT repeat payment or supplier add"},attempt.submitted?200:202);
}
