// Private owner-only read and purchase API. Never imported by public checkout.
import {randomUUID,createHash} from "node:crypto";
import {neon} from "@neondatabase/serverless";
import {assertOwnerRead,assertOwnerMutation,signOwner,verifyOwner,ownerNoStore} from "../../../../lib/ownerPortalAuth.mjs";
import {sources,supplierConfig,supplierCall,parseWallet,parseCatalog,costCents,normalizeOwnerTarget} from "../../../../lib/ownerSupplierGateway.mjs";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
const reply=(value,status=200)=>Response.json(value,{status,headers:ownerNoStore});
const db=()=>{
 const url=process.env.LITIX_OWNER_DATABASE_URL||process.env.LITIX_V2_DATABASE_URL||"";
 if(!/^postgres(?:ql)?:\/\//.test(url))throw Error("owner_database_unconfigured");
 return neon(url);
};
const purchasesOn=()=>process.env.LITIX_OWNER_PURCHASES_ENABLED==="true"&&
  process.env.VERCEL_ENV==="production"&&
  Number.isSafeInteger(Number(process.env.LITIX_OWNER_MAX_ORDER_CENTS))&&
  Number(process.env.LITIX_OWNER_MAX_ORDER_CENTS)>=100;
const maxCost=()=>Number(process.env.LITIX_OWNER_MAX_ORDER_CENTS||0);
const uuid=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(x||""));
const hash=x=>createHash("sha256").update(x).digest("hex");
const errorCode=e=>{
 const s=String(e?.message||"");
 const recognized=["owner_supplier_not_connected","owner_currency_not_verified_usd","owner_balance_invalid",
  "owner_quantity_unavailable","owner_wholesale_price_invalid","owner_target_invalid",
  "owner_purchases_disabled","owner_supplier_rejected","owner_supplier_unknown_outcome",
  "owner_supplier_network_unavailable","owner_catalog_invalid","owner_database_unconfigured"];
 return recognized.includes(s)?s:"owner_action_unavailable";
};
async function available(supplier){
 supplierConfig(supplier);
 const [raw,wallet]=await Promise.all([supplierCall(supplier,"services"),supplierCall(supplier,"balance")]);
 return {items:parseCatalog(raw,supplier),wallet:parseWallet(wallet)};
}
async function priced(supplier,id,qty,destination){
 const x=await available(supplier);
 const service=x.items.find(item=>item.id===id);
 if(!service)throw Error("owner_service_unavailable");
 const quantity=Number(qty);
 const cost=costCents(service,quantity),target=normalizeOwnerTarget(destination,service);
 return {service,quantity,cost,target,wallet:x.wallet};
}
async function history(sql,sub){
 const rows=await sql.query(
  "SELECT id,supplier,service_id,service_name,quantity,destination,wholesale_cents,currency,state,supplier_order_id,status_data,created_at,checked_at,error_code FROM public.litix_owner_portal_orders WHERE owner_sub=$1 ORDER BY created_at DESC LIMIT 60",
  [sub]);
 return rows.map(x=>({...x,wholesale_cents:Number(x.wholesale_cents)}));
}
export async function GET(request){
 let owner;try{owner=assertOwnerRead(request)}catch{return reply({error:"owner_login_required"},401)}
 const params=new URL(request.url).searchParams,view=params.get("view")||"dashboard";
 try{
  if(view==="dashboard"){
   const results=await Promise.allSettled(sources.map(async supplier=>({
    supplier,...await available(supplier)})));
   const providers=results.map((result,i)=>result.status==="fulfilled"?
    {supplier:sources[i],connected:true,...result.value}:
    {supplier:sources[i],connected:false,error:errorCode(result.reason),items:[],wallet:null});
   let entries=[],ledgerReady=false;
   try{entries=await history(db(),owner.sub);ledgerReady=true}catch{}
   return reply({authenticated:true,csrf:owner.csrf,purchasesEnabled:purchasesOn()&&ledgerReady,
    maxOrderCents:purchasesOn()?maxCost():null,providers,history:entries,
    ledgerReady,notice:ledgerReady?null:"Private order history and purchases unavailable until the ledger is healthy."});
  }
  if(view==="history")return reply({history:await history(db(),owner.sub)});
  if(view==="track"){
   const id=params.get("id");
   if(!uuid(id))return reply({error:"invalid_order_id"},422);
   const sql=db(),rows=await sql.query(
    "SELECT * FROM public.litix_owner_portal_orders WHERE id=$1 AND owner_sub=$2 LIMIT 1",[id,owner.sub]);
   if(rows.length!==1)return reply({error:"order_not_found"},404);
   const x=rows[0];
   if(!x.supplier_order_id)return reply({order:{id,state:x.state,error_code:x.error_code,
    supplier_order_id:null,needsManualReview:x.state==="unknown"}});
   let live=null;
   try{
    live=await supplierCall(x.supplier,"status",{order:String(x.supplier_order_id)});
    const state=String(live?.status||"").toLowerCase();
    const next=/completed|finished/.test(state)?"completed":/partial/.test(state)?"partial":
      /cancel/.test(state)?"canceled":/fail|error/.test(state)?"failed":
      /progress|process|pending/.test(state)?"in_progress":x.state;
    await sql.query(
     "UPDATE public.litix_owner_portal_orders SET state=$2,status_data=$3::jsonb,checked_at=now(),updated_at=now() WHERE id=$1 AND owner_sub=$4",
     [id,next,JSON.stringify({status:String(live?.status||"").slice(0,75),
       remains:Number.isFinite(Number(live?.remains))?Number(live.remains):null}),owner.sub]);
   }catch{}
   return reply({order:{id,supplier:x.supplier,supplier_order_id:x.supplier_order_id,
    state:live?.status||x.state,lastChecked:live?new Date().toISOString():x.checked_at,
    needsManualReview:x.state==="unknown"}});
  }
  return reply({error:"unknown_view"},400);
 }catch{return reply({error:"owner_data_unavailable"},503)}
}
export async function POST(request){
 let owner;try{owner=assertOwnerMutation(request)}catch{return reply({error:"owner_login_or_csrf_required"},403)}
 if(Number(request.headers.get("content-length")||0)>8000)return reply({error:"request_too_large"},413);
 let body;try{body=await request.json()}catch{return reply({error:"invalid_json"},400)}
 if(body?.action!=="quote"&&body?.action!=="purchase")return reply({error:"action_not_supported"},422);
 if(body.action==="quote"){
  try{
   const supplier=String(body.supplier||""),serviceId=String(body.serviceId||"");
   if(!sources.includes(supplier)||!/^\d{1,12}$/.test(serviceId))return reply({error:"invalid_service"},422);
   const x=await priced(supplier,serviceId,body.quantity,body.destination);
   const nonce=randomUUID(),expires=Date.now()+120000;
   const token=signOwner("quote",{nonce,expires,ownerSub:owner.sub,supplier,
    serviceId,quantity:x.quantity,destination:x.target,costCents:x.cost});
   return reply({quoteToken:token,expires,service:x.service,quantity:x.quantity,
    destination:x.target,wholesaleCents:x.cost,currency:"USD",
    walletBalanceCents:x.wallet.balanceCents,walletEnough:x.wallet.balanceCents>=x.cost,
    purchasesEnabled:purchasesOn(),requiresExplicitConfirmation:true});
  }catch(e){return reply({error:errorCode(e)},503)}
 }
 // No live provider debit can happen before every condition below passes.
 if(!purchasesOn())return reply({error:"owner_purchases_disabled"},503);
 if(body.confirmed!==true||!uuid(body.idempotencyKey)||typeof body.quoteToken!=="string")
   return reply({error:"confirmation_required"},422);
 const q=verifyOwner("quote",body.quoteToken);
 if(!q||q.ownerSub!==owner.sub||!uuid(q.nonce)||!sources.includes(q.supplier)||
  !Number.isInteger(q.expires)||q.expires<Date.now()||q.expires>Date.now()+120000||
  !Number.isSafeInteger(q.costCents)||q.costCents<1||q.costCents>maxCost())
  return reply({error:"quote_expired_or_exceeds_owner_limit"},409);
 if(body.expectedWholesaleCents!==q.costCents)return reply({error:"price_confirmation_mismatch"},409);
 let x;try{
  x=await priced(q.supplier,q.serviceId,q.quantity,q.destination);
  if(x.cost!==q.costCents||x.target!==q.destination)return reply({error:"wholesale_price_changed_requote"},409);
  if(x.wallet.balanceCents<q.costCents)return reply({error:"insufficient_supplier_wallet"},409);
 }catch(e){return reply({error:errorCode(e)},503)}
 const sql=db(),fingerprint=hash([q.supplier,q.serviceId,q.quantity,q.destination].join("|"));
 let existing;
 try{
  existing=await sql.query(
   "SELECT id,state FROM public.litix_owner_portal_orders WHERE owner_sub=$1 AND supplier=$2 AND fingerprint=$3 AND created_at>now()-interval '5 minutes' LIMIT 1",
   [owner.sub,q.supplier,fingerprint]);
  if(existing.length)return reply({error:"duplicate_order_blocked",existingOrderId:existing[0].id,
   existingState:existing[0].state},409);
  const inserted=await sql.query(
   "INSERT INTO public.litix_owner_portal_orders(owner_sub,supplier,idempotency_key,quote_nonce,fingerprint,service_id,service_name,quantity,destination,wholesale_cents,balance_before_cents,state) VALUES($1,$2,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,'reserved') ON CONFLICT DO NOTHING RETURNING id",
   [owner.sub,q.supplier,body.idempotencyKey,q.nonce,fingerprint,q.serviceId,x.service.name,q.quantity,q.destination,q.costCents,x.wallet.balanceCents]);
  if(inserted.length!==1)return reply({error:"supplier_order_in_progress_or_duplicate"},409);
  const id=inserted[0].id;
  // Single active database reservation per supplier; confirm wallet again
  // after claiming the supplier slot to prevent concurrent owner overspend.
  try{
   const current=parseWallet(await supplierCall(q.supplier,"balance"));
   if(current.balanceCents<q.costCents){
    await sql.query("UPDATE public.litix_owner_portal_orders SET state='blocked',error_code='balance_changed',updated_at=now() WHERE id=$1",[id]);
    return reply({error:"supplier_balance_changed",orderId:id},409);
   }
  }catch{
   await sql.query("UPDATE public.litix_owner_portal_orders SET state='blocked',error_code='balance_unavailable',updated_at=now() WHERE id=$1",[id]).catch(()=>{});
   return reply({error:"balance_verification_failed",orderId:id},503);
  }
  await sql.query("UPDATE public.litix_owner_portal_orders SET state='sending',sent_at=now(),updated_at=now() WHERE id=$1 AND state='reserved'",[id]);
  // Exactly one outbound add. Never automatically retry an uncertain outcome.
  try{
   const result=await supplierCall(q.supplier,"add",
    {service:q.serviceId,quantity:q.quantity,link:q.destination},{approved:true});
   await sql.query(
    "UPDATE public.litix_owner_portal_orders SET state='submitted',supplier_order_id=$2,status_data=$3::jsonb,updated_at=now() WHERE id=$1",
    [id,String(result.order),JSON.stringify({order:String(result.order),status:"submitted"})]);
   return reply({orderId:id,supplierOrderId:String(result.order),supplier:q.supplier,
    state:"submitted",wholesaleCents:q.costCents,currency:"USD",paymentMethod:"supplier_prepaid_wallet",
    cardCharged:false,trackingUrl:"/owner"},201);
  }catch(error){
   const explicit=errorCode(error)==="owner_supplier_rejected";
   await sql.query(
    "UPDATE public.litix_owner_portal_orders SET state=$2,error_code=$3,updated_at=now() WHERE id=$1",
    [id,explicit?"rejected":"unknown",errorCode(error)]).catch(()=>{});
   return reply({error:explicit?"supplier_rejected_no_order_confirmed":"supplier_outcome_unknown",
    orderId:id,doNotRetry:true,manualReconciliationRequired:!explicit},503);
  }
 }catch{return reply({error:"order_reservation_failed",doNotRetry:true},503)}
}
