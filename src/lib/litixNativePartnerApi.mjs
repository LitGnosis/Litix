// Litix Native B2B supplier adapter, phase 2. First-party ORIGINAL digital assets ONLY.
// No card charges, supplier API dispatch, social engagement delivery, or artificial metrics.
// Until a verified partner key, database migration and feature flag exist, POST fails closed.
import {createHash,randomUUID,timingSafeEqual} from "node:crypto";
import {litixNativeServices,previewLitixNativeAsset} from "./litixNativeSupplier.mjs";

const sha=s=>createHash("sha256").update(String(s),"utf8").digest("hex");
const idFormat=/^[A-Za-z0-9_-]{8,64}$/;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const safe=(code,status)=>({status,body:{error:code,charged:false,supplierOrderCreated:false}});
const isService=id=>litixNativeServices().some(x=>x.id===id);

export function nativePartnerPublicCatalog(){
 return {supplier:"Litix Native",apiVersion:"v1",mode:"FREE_B2B_TRIAL",
  paidCheckoutEnabled:false,artificialEngagementAvailable:false,
  actions:["services","add","status"],
  services:litixNativeServices().map(s=>({
   id:s.id,name:s.name,type:s.type,
   delivery:"original-digital-file",requiresBrief:true,
   activeForPaidOrders:false,trialOnly:true,trialPriceCents:0
  }))};
}

/** Keys are never stored in code or echoed in results. Store SHA-256 hashes only. */
export function resolveNativePartner(key,json){
 if(typeof key!=="string"||! /^[A-Za-z0-9_-]{40,256}$/.test(key))return null;
 let config;
 try{config=JSON.parse(String(json||"{}"));}catch{return null;}
 if(!Array.isArray(config?.partners)||config.partners.length>100)return null;
 const candidate=Buffer.from(sha(key),"hex");
 for(const entry of config.partners){
  if(!/^[a-z0-9_-]{2,40}$/.test(entry?.id||"")||!/^[0-9a-f]{64}$/i.test(entry?.keyHash||""))continue;
  const expected=Buffer.from(entry.keyHash,"hex");
  if(timingSafeEqual(candidate,expected)){
   return Object.freeze({id:entry.id,maxDaily:
     Number.isInteger(entry.maxDaily)&&entry.maxDaily>=1&&entry.maxDaily<=500?entry.maxDaily:25});
  }
 }
 return null;
}
const toRow=x=>({orderId:x.id,serviceId:x.service_id,status:x.status,
 filename:x.filename,mimeType:x.mime_type,sha256:x.sha256,
 createdAt:x.created_at||null,charged:false,costCents:0,trialOnly:true});
const selectQuery="select id,service_id,request_hash,filename,mime_type,sha256,content,status,created_at from public.litix_native_partner_orders where partner_id=$1 and request_id=$2 limit 1";
const selectById="select id,service_id,request_hash,filename,mime_type,sha256,content,status,created_at from public.litix_native_partner_orders where partner_id=$1 and id=$2::uuid limit 1";

/**
 * Execute a no-charge first-party supplier request with an injected SQL adapter.
 * The unique (partner_id,request_id) DB constraint makes replay safe across workers.
 * Never return a success if a ledger write fails.
 */
export async function executeNativePartnerAction({payload,key,env,sql}={}){
 if(env?.LITIX_NATIVE_PARTNER_ORDERS_ENABLED!=="true")return safe("PARTNER_ORDERS_DISABLED",503);
 if(!sql||typeof sql.query!=="function")return safe("PARTNER_DATABASE_UNAVAILABLE",503);
 const partner=resolveNativePartner(key,env?.LITIX_NATIVE_PARTNER_API_CONFIG);
 if(!partner)return safe("UNAUTHORIZED",401);
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return safe("BAD_REQUEST",400);
 const action=String(payload.action||"");
 if(action==="status"){
  const orderId=String(payload.orderId||"");
  if(!uuid.test(orderId))return safe("INVALID_ORDER_REFERENCE",422);
  try{
   const rows=await sql.query(selectById,[partner.id,orderId]);
   if(rows.length!==1)return safe("ORDER_NOT_FOUND",404);
   const row=rows[0];
   // A private file can be re-fetched only by its authorized reseller.
   return {status:200,body:{...toRow(row),...(payload.includeAsset===true?{content:row.content}:{})}};
  }catch{return safe("ORDER_LOOKUP_UNAVAILABLE",503);}
 }
 if(action!=="add")return safe("ACTION_NOT_SUPPORTED",422);
 const requestId=String(payload.requestId||"");
 const serviceId=String(payload.serviceId||"");
 if(!idFormat.test(requestId)||!isService(serviceId))return safe("INVALID_SERVICE_OR_REQUEST_ID",422);
 let asset;
 try{asset=previewLitixNativeAsset({serviceId,brief:payload.brief});}
 catch{return safe("INVALID_NATIVE_ASSET_BRIEF",422);}
 if(asset.content.length>25000)return safe("ASSET_TOO_LARGE",422);
 // PreviewHash is a stable hash of output + service ID. Replays with different
 // inputs that happen to produce identical output are safe and deterministic.
 const requestHash=sha(serviceId+"\n"+asset.previewHash);
 try{
  // An existing order is returned BEFORE the rate limit so retries cannot
  // consume extra quota. Same request ID + different asset is rejected.
  const existing=await sql.query(selectQuery,[partner.id,requestId]);
  if(existing.length){
   const row=existing[0];
   if(row.request_hash!==requestHash)return safe("IDEMPOTENCY_CONFLICT",409);
   return {status:200,body:{...toRow(row),content:row.content,replayed:true}};
  }
  const totals=await sql.query("select count(*)::integer as count from public.litix_native_partner_orders where partner_id=$1 and created_at>=date_trunc('day',now())",[partner.id]);
  if(Number(totals[0]?.count||0)>=partner.maxDaily)return safe("DAILY_TRIAL_LIMIT",429);
  // Content and SHA are recorded atomically with COMPLETED; no separate job
  // queue or external supplier call can be left in an ambiguous state.
  const inserted=await sql.query(
   "insert into public.litix_native_partner_orders(id,partner_id,request_id,service_id,request_hash,filename,mime_type,sha256,content,status) values($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,'COMPLETED') on conflict(partner_id,request_id) do nothing returning id,service_id,request_hash,filename,mime_type,sha256,content,status,created_at",
   [randomUUID(),partner.id,requestId,serviceId,requestHash,asset.filename,asset.mimeType,asset.sha256,asset.content]);
  if(inserted.length===1)return {status:201,body:{...toRow(inserted[0]),content:inserted[0].content,replayed:false}};
  const winner=await sql.query(selectQuery,[partner.id,requestId]);
  if(winner.length!==1)return safe("RECONCILIATION_REQUIRED",503);
  if(winner[0].request_hash!==requestHash)return safe("IDEMPOTENCY_CONFLICT",409);
  return {status:200,body:{...toRow(winner[0]),content:winner[0].content,replayed:true}};
 }catch{return safe("PARTNER_LEDGER_UNAVAILABLE",503);}
}
