// Verified multi-supplier v2 adapter. Backend only; no secrets in the browser.
// Only use for new PAID orders explicitly created for verified_router dispatch.
// Existing Boostero and owned-node orders must NEVER be replayed here.
import {randomUUID,timingSafeEqual} from "node:crypto";
import {neon} from "@neondatabase/serverless";
import {litixPlatform,litixKind} from "./litixServiceClassify.mjs";

export const SUPPLIERS=Object.freeze({
 SMMWIZ:{host:"smmwiz.com",url:"https://smmwiz.com/api/v2",key:"LITIX_SMMWIZ_API_KEY",override:"LITIX_SMMWIZ_API_URL"},
 JAP:{host:"justanotherpanel.com",url:"https://justanotherpanel.com/api/v2",key:"LITIX_JAP_API_KEY",override:"LITIX_JAP_API_URL"},
 PEAKERR:{host:"peakerr.com",url:"https://peakerr.com/api/v2",key:"LITIX_PEAKERR_API_KEY",override:"LITIX_PEAKERR_API_URL"}
});

export function supplierConfiguration(code,{env=process.env}={}){
 const p=SUPPLIERS[code];
 if(!p)throw Error("supplier_not_allowlisted");
 const key=env[p.key];
 if(typeof key!=="string"||key.trim().length<12)throw Error("supplier_key_not_configured");
 const url=new URL(env[p.override]||p.url);
 if(url.protocol!=="https:"||url.hostname!==p.host||url.port||url.username||
  url.password||url.search||url.hash||!["/api/v2","/api/public/v2"].includes(url.pathname))
  throw Error("supplier_url_not_allowlisted");
 return {url:url.toString(),key};
}

const validId=v=>/^[0-9]{1,12}$/.test(String(v??""));
const validOrderId=v=>/^ltx2_[a-f0-9-]{36}$/.test(String(v??""));
const positiveInteger=v=>Number.isSafeInteger(v)&&v>0&&v<=1_000_000;
export function classifySupplierResponse(payload,{action}={}){
 if(!payload||typeof payload!=="object"||Array.isArray(payload))
  return {state:"UNKNOWN_OUTCOME",reason:"invalid_supplier_response"};
 if(typeof payload.error==="string"&&payload.error.trim()){
  // Rejection is only certain if the provider gives a structured error and
  // no accepted order ID. Narrow to errors that explicitly reject the SKU.
  // Invalid links/quantities and ambiguous errors require manual review.
  if(!payload.order&&/\b(service (?:not found|unavailable|disabled|inactive|does not exist)|invalid service|service id (?:not found|invalid))\b/i.test(payload.error))
   return {state:"PROVIDER_REJECTED",reason:"service_unavailable"};
  return {state:"UNKNOWN_OUTCOME",reason:"provider_error_requires_review"};
 }
 if(action==="add"&&/^\d{1,24}$/.test(String(payload.order||"")))
  return {state:"SUBMITTED",supplierOrderId:String(payload.order)};
 return {state:"UNKNOWN_OUTCOME",reason:"supplier_order_not_confirmed"};
}

export async function supplierRequest(code,action,parameters={},{
 fetcher=fetch,env=process.env,timeoutMs=12000
}={}){
 if(!["services","balance","add","status"].includes(action))throw Error("supplier_action_forbidden");
 const {url,key}=supplierConfiguration(code,{env});
 const body=new URLSearchParams({key,action,...parameters});
 let response;
 try{
  response=await fetcher(url,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
   body:body.toString(),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(timeoutMs)});
 }catch{throw Error("supplier_transport_unknown_outcome")}
 if(!response.ok)throw Error("supplier_http_unknown_outcome");
 let payload;
 try{payload=await response.json()}catch{throw Error("supplier_json_unknown_outcome")}
 if(action==="services"){
  if(!Array.isArray(payload))throw Error("supplier_catalog_unavailable");
  return payload;
 }
 if(action==="balance"){
  if(!payload||!Number.isFinite(Number(payload.balance))||
   Number(payload.balance)<0||String(payload.currency||"USD").toUpperCase()!=="USD")
   throw Error("supplier_balance_unavailable");
  return payload;
 }
 if(action==="add")return classifySupplierResponse(payload,{action});
 return payload;
}

export function verifyMappedService(route,services,quantity,retailCents){
 if(route?.enabled!==true||route?.owner_approved!==true||!route?.verified_at ||
    !positiveInteger(quantity)||!Number.isSafeInteger(retailCents)||retailCents<100 ||
    !Array.isArray(services))return null;
 const row=services.find(x=>String(x?.service)==String(route.supplier_service_id));
 if(!row||!/^default$/i.test(String(row.type||"Default")))return null;
 const platform=litixPlatform(row.name,row.category),kind=litixKind(row.name,row.category);
 if(platform!==route.platform||kind!==route.kind)return null;
 const min=Number(row.min),max=Number(row.max),rate=Number(row.rate),ceiling=Number(route.wholesale_rate_per_1000_usd);
 if(!positiveInteger(min)||!Number.isSafeInteger(max)||max<min||
    quantity<min||quantity>max||!Number.isFinite(rate)||rate<=0||
    !Number.isFinite(ceiling)||rate>ceiling)return null;
 const costCents=Math.ceil(rate*quantity/10);
 // Existing retail must still cover at least a 60% markup, all else unchanged.
 if(retailCents<Math.ceil(costCents*1.60-1e-8))return null;
 return {supplierServiceId:String(row.service),costCents,quantity,platform,kind};
}

function database(){
 const url=process.env.LITIX_V2_DATABASE_URL||process.env.DATABASE_URL||
  process.env.POSTGRES_URL||process.env.POSTGRES_PRISMA_URL;
 if(!url)throw Error("litix_db_missing");
 return neon(url);
}
const status=async (sql,id,state)=>sql.query(
 "UPDATE public.litix_supplier_route_claims SET final_state=$2,updated_at=now() WHERE litix_order_id=$1",
 [id,state]);

// Each paid order is claimed ONCE in Neon. Any crash after a supplier call
// requires reconciliation, never an implicit second purchase.
export async function dispatchVerifiedSupplierOrder(orderId,{
 sql=database(),requestSupplier=supplierRequest,enabled=process.env.LITIX_VERIFIED_SUPPLIER_FAILOVER_ENABLED==="true"
}={}){
 if(!enabled||process.env.VERCEL_ENV!=="production")return {state:"DISABLED",reason:"router_not_released"};
 if(!validOrderId(orderId))return {state:"INVALID_ORDER"};
 const claims=await sql.query(`
  INSERT INTO public.litix_supplier_route_claims(litix_order_id)
  SELECT o.id FROM public.litix_v2_orders o
  WHERE o.id=$1 AND o.payment_state='paid' AND o.payment_transaction_id IS NOT NULL
    AND o.fulfillment_state='queued' AND o.metadata->>'supplier'='verified_router'
    AND NOT EXISTS(SELECT 1 FROM public.litix_boostero_fulfillment b WHERE b.litix_order_id=o.id)
  ON CONFLICT(litix_order_id) DO NOTHING RETURNING litix_order_id`,[orderId]);
 if(claims.length!==1)return {state:"NOT_ELIGIBLE_OR_ALREADY_CLAIMED"};
 try{
  const orders=await sql.query(`SELECT id,service_id,quantity,amount_cents,destination
    FROM public.litix_v2_orders WHERE id=$1 AND payment_state='paid'
    AND fulfillment_state='queued'`,[orderId]);
  if(orders.length!==1){await status(sql,orderId,"MANUAL_REVIEW");return {state:"MANUAL_REVIEW"}}
  const order=orders[0],quantity=Number(order.quantity);
  const sid=String(order.service_id||"").replace(/^litix_/,"boostero_");
  const link=String(order.destination||"");
  let target;
  try{target=new URL(link)}catch{}
  if(!target||target.protocol!=="https:"||target.username||target.password||
     !positiveInteger(quantity)||!/^[a-z0-9.-]+$/i.test(target.hostname)){
   await status(sql,orderId,"MANUAL_REVIEW");return {state:"MANUAL_REVIEW",reason:"invalid_order_target"};
  }
  const routes=await sql.query(`SELECT * FROM public.litix_verified_supplier_routes
    WHERE litix_service_id=$1 AND enabled AND owner_approved
      AND verified_at>now()-interval '14 days'
    ORDER BY priority LIMIT 2`,[sid]);
  if(!routes.length||routes[0].priority!==1){
   await status(sql,orderId,"REJECTED");return {state:"NO_VERIFIED_PRIMARY"};
  }
  for(const route of routes){
   const code=String(route.supplier_code);
   let quote;
   try{
    const services=await requestSupplier(code,"services");
    quote=verifyMappedService(route,services,quantity,Number(order.amount_cents));
    if(quote){
     const balance=await requestSupplier(code,"balance");
     if(Number(balance.balance)*100<quote.costCents)quote=null;
    }
   }catch{quote=null;}
   // Read-only quote failures are safe to skip; no supplier order was submitted.
   if(!quote)continue;
   const attemptId=randomUUID();
   const inserted=await sql.query(`INSERT INTO public.litix_supplier_failover_attempts
    (id,litix_order_id,supplier_code,supplier_service_id,attempt_no,state)
    VALUES($1,$2,$3,$4,$5,'DISPATCHING')
    ON CONFLICT DO NOTHING RETURNING id`,
    [attemptId,orderId,code,quote.supplierServiceId,route.priority]);
   if(inserted.length!==1){
    await status(sql,orderId,"MANUAL_REVIEW");
    return {state:"MANUAL_REVIEW",reason:"supplier_claim_conflict"};
   }
   let result;
   try{
    result=await requestSupplier(code,"add",{
     service:quote.supplierServiceId,link,quantity:String(quantity)
    });
   }catch{result={state:"UNKNOWN_OUTCOME",reason:"supplier_transport_unknown_outcome"}}
   if(result.state==="PROVIDER_REJECTED"){
    const journal=await sql.query(`UPDATE public.litix_supplier_failover_attempts
      SET state='PROVIDER_REJECTED',error_code=$2,updated_at=now()
      WHERE id=$1 AND state='DISPATCHING' RETURNING id`,
      [attemptId,result.reason||"service_unavailable"]);
    if(journal.length!==1){await status(sql,orderId,"MANUAL_REVIEW");return {state:"MANUAL_REVIEW"}}
    continue;
   }
   if(result.state==="SUBMITTED"){
    const saved=await sql.query(`UPDATE public.litix_supplier_failover_attempts
      SET state='SUBMITTED',supplier_order_id=$2,updated_at=now()
      WHERE id=$1 AND state='DISPATCHING' RETURNING id`,
     [attemptId,result.supplierOrderId]);
    if(saved.length!==1){await status(sql,orderId,"MANUAL_REVIEW");return {state:"MANUAL_REVIEW"}}
    const updated=await sql.query(`UPDATE public.litix_v2_orders
      SET fulfillment_state='processing',supplier_order_id=$2,
      metadata=metadata||jsonb_build_object('fulfilled_by','verified_router'),
      updated_at=now()
      WHERE id=$1 AND fulfillment_state='queued' AND payment_state='paid'
      RETURNING id`,[orderId,result.supplierOrderId]);
    await status(sql,orderId,updated.length===1?"SUBMITTED":"MANUAL_REVIEW");
    return {state:updated.length===1?"SUBMITTED":"MANUAL_REVIEW",reconciled:updated.length===1};
   }
   await sql.query(`UPDATE public.litix_supplier_failover_attempts
    SET state='UNKNOWN_OUTCOME',error_code=$2,updated_at=now()
    WHERE id=$1 AND state='DISPATCHING'`,[attemptId,result.reason||"unconfirmed"]);
   await status(sql,orderId,"MANUAL_REVIEW");
   return {state:"MANUAL_REVIEW",reason:"supplier_outcome_unknown_no_retry"};
  }
  await status(sql,orderId,"REJECTED");
  return {state:"NO_ELIGIBLE_SUPPLIER"};
 }catch(error){
  await status(sql,orderId,"MANUAL_REVIEW").catch(()=>{});
  return {state:"MANUAL_REVIEW",reason:"dispatch_reconciliation_required"};
 }
}
