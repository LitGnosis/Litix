// Dedicated future-post supplier bridge (STAGED; not connected to customer checkout).
// A subscription API template is not evidence of a live eligible Likes product.
// Calls placing supplier orders must be made ONLY after durable PAID claim,
// reseller authorization, live service validation, and a separate release review.
import {RESELLER_CANDIDATES,eligibleFuturePostLikes,buildFuturePostSubscription}
 from "./litixSubscriptionSupplierEvaluation.mjs";

export function supplierConfigFromEnvironment(env=process.env){
 const provider=String(env.LITIX_AUTOLIKES_PROVIDER||"").trim().toLowerCase();
 const candidate=RESELLER_CANDIDATES[provider];
 const verified=env.LITIX_AUTOLIKES_RESELLER_VERIFIED==="true";
 const enabled=env.LITIX_AUTOLIKES_PROVIDER_DISPATCH_ENABLED==="true";
 const key=candidate?env[candidate.keyEnv]:null;
 const instagram=Number(env.LITIX_AUTOLIKES_IG_SERVICE_ID);
 const tiktok=Number(env.LITIX_AUTOLIKES_TIKTOK_SERVICE_ID);
 return Object.freeze({
  provider,
  configured:!!candidate&&typeof key==="string"&&key.length>=8,
  verified,enabled,
  serviceIds:Object.freeze({
   instagram:Number.isSafeInteger(instagram)&&instagram>0?instagram:null,
   tiktok:Number.isSafeInteger(tiktok)&&tiktok>0?tiktok:null
  }),
  // Do not expose API keys in status or UI.
  canDispatch:!!candidate&&!!key&&key.length>=8&&verified&&enabled&&
   [instagram,tiktok].some(id=>Number.isSafeInteger(id)&&id>0)
 });
}

const numberOrderId=x=>/^\d{1,15}$/.test(String(x||""))?String(x):null;
export class UnknownSupplierOutcome extends Error {
 constructor(){super("supplier_outcome_unknown_manual_reconciliation_required");this.name="UnknownSupplierOutcome"}
}

export function createVerifiedFuturePostSupplier({
 provider,key,fetcher=fetch,allowNewOrders=false,confirmedServices={}
}={}){
 const meta=RESELLER_CANDIDATES[provider];
 if(!meta)throw Error("unknown_subscription_supplier");
 if(typeof key!=="string"||key.length<8)throw Error("supplier_credentials_missing");
 const api=async (fields,{mutating=false}={})=>{
  if(mutating&&!allowNewOrders)throw Error("supplier_ordering_not_authorized");
  const requestFields=new URLSearchParams({key,...fields});
  let res,body;
  try{
   res=await fetcher(meta.url,{
    method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body:requestFields,
    signal:AbortSignal.timeout(15000),
    cache:"no-store",
    redirect:"error"
   });
   if(!res.ok)throw Error("supplier_http_error");
   body=await res.json();
  }catch(error){
   // A supplier may accept POST / add and lose the response. Never retry.
   if(mutating)throw new UnknownSupplierOutcome();
   throw new Error("supplier_read_unavailable");
  }
  if(body?.error)throw Error("supplier_rejected_request");
  return body;
 };
 const liveServices=async()=>eligibleFuturePostLikes(await api({action:"services"}));
 const findVerified=async platform=>{
  if(!["instagram","tiktok"].includes(platform))throw Error("unsupported_platform");
  const id=Number(confirmedServices[platform]);
  if(!Number.isSafeInteger(id)||id<1)throw Error("service_id_not_verified");
  const services=await liveServices();
  const match=services.find(s=>s.platform===platform&&s.id===id);
  if(!match)throw Error("verified_subscription_service_not_active");
  return match;
 };
 return Object.freeze({
  async readiness(){
   let services;
   try{services=await liveServices()}catch{return {connected:false,eligible:[],ready:false}}
   return {
    connected:true,
    eligible:services.map(x=>({platform:x.platform,id:x.id,name:x.name,min:x.min,max:x.max,ratePer1000:x.ratePer1000})),
    ready:allowNewOrders&&["instagram","tiktok"].some(p=>services.some(s=>s.platform===p&&s.id===Number(confirmedServices[p])))
   };
  },
  async validate({platform,username,likesPerPost,postCount,now}){
   const verified=await findVerified(platform);
   const validatedAt=now?new Date(now):new Date();
   const request=buildFuturePostSubscription({service:verified,username,likesPerPost,postCount,now:validatedAt});
   return {service:verified,request,validatedAt:validatedAt.toISOString()};
  },
  async placeSubscription(prepared){
   if(!allowNewOrders)throw Error("supplier_ordering_not_authorized");
   if(!prepared?.service||!prepared?.request)throw Error("missing_verified_subscription");
   const current=await findVerified(prepared.service.platform);
   if(current.id!==prepared.service.id)throw Error("service_changed_reverify");
   // Reject stale, changed or fabricated payloads. Caller must additionally
   // hold a durable one-time claim on a PAID order before invoking this method.
   const at=new Date(prepared.validatedAt);
   if(!Number.isFinite(at.getTime())||Math.abs(Date.now()-at.getTime())>15*60_000)
    throw Error("subscription_validation_expired");
   const rebuilt=buildFuturePostSubscription({
    service:current,username:prepared.request.username,
    likesPerPost:Number(prepared.request.min),postCount:Number(prepared.request.posts),
    delayMinutes:Number(prepared.request.delay||0),now:at
   });
   if(JSON.stringify(rebuilt)!==JSON.stringify(prepared.request))
    throw Error("subscription_request_modified");
   const response=await api(rebuilt,{mutating:true});
   const orderId=numberOrderId(response?.order);
   if(!orderId)throw new UnknownSupplierOutcome();
   return {supplierOrderId:orderId};
  },
  async getStatus(orderId){
   const id=numberOrderId(orderId);
   if(!id)throw Error("invalid_supplier_order_id");
   const state=await api({action:"status",order:id});
   return {status:String(state?.status||"").slice(0,80),remains:state?.remains??null};
  }
 });
}
