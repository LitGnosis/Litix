// ZoraSMM reseller subscription adapter. Supplier detects FUTURE public posts.
// Intentionally not wired to public checkout until a live subscription service,
// funded account and delivery are verified. Never reuse Boostero order IDs here.
import {eligibleNativeAutoLikes} from "./boosteroNativeAutoLikes.mjs";
import {quotePrepaidAutoLikes,prepaidNativeSupplierParams} from "./litixPrepaidAutoLikes.mjs";

export const ZORA_API_URL="https://zorasmm.com/api/v2";
const DELAYS=new Set([0,5,10,15,20,30,40,50,60,90,120,150,180,210,240,270,300,360,420,480,540,600]);
const ID=/^\d{1,12}$/;
const ORDER_ID=/^\d{1,24}$/;

export function zoraProviderConfigured(env=process.env){
 return env.VERCEL_ENV==="production"&&
  env.LITIX_AUTOLIKES_SUPPLIER==="zorasmm"&&
  env.LITIX_ZORA_AUTOLIKES_VERIFIED==="true"&&
  typeof env.ZORASMM_API_KEY==="string"&&env.ZORASMM_API_KEY.length>=12;
}

function approvedId(platform,env=process.env){
 if(platform!=="instagram"&&platform!=="tiktok")throw Error("zora_platform_invalid");
 const key=platform==="instagram"?"LITIX_ZORA_INSTAGRAM_SERVICE_ID":"LITIX_ZORA_TIKTOK_SERVICE_ID";
 const value=String(env[key]||"");
 if(!ID.test(value))throw Error("zora_service_not_approved");
 return value;
}
export function eligibleZoraSubscription(service,platform){
 // The API must actually mark it as a subscription. Words like "Auto Likes"
 // in a title of a Default service do NOT establish a future-post detector.
 const type=String(service?.type||"").trim().toLowerCase();
 return ["subscription","subscriptions"].includes(type)&&eligibleNativeAutoLikes(service,platform);
}
export function selectZoraSubscription(services,platform,qty,env=process.env){
 if(!Array.isArray(services))throw Error("zora_services_invalid_shape");
 const allowed=approvedId(platform,env);
 const service=services.find(x=>String(x?.service??x?.id??"")===allowed);
 if(!service||!eligibleZoraSubscription(service,platform)||
  !Number.isSafeInteger(Number(qty))||qty<Number(service.min)||qty>Number(service.max))
  throw Error("zora_approved_subscription_unavailable");
 return service;
}
export function quoteZoraPrepaid({services,platform,profile,tierId,posts},env=process.env){
 // Existing Litix one-time tiers and 60% minimum cost protection are preserved.
 const tiers={lite:50,start:100,rise:150,grow:250,prime:400,power:650,max:1150};
 const qty=tiers[tierId];
 if(!qty)throw Error("zora_tier_invalid");
 const service=selectZoraSubscription(services,platform,qty,env);
 const quote=quotePrepaidAutoLikes({services:[service],platform,profile,tierId,posts});
 if(quote.supplierServiceId!==approvedId(platform,env))throw Error("zora_service_mismatch");
 return quote;
}
export function zoraSubscriptionPayload(quote,paidAt){
 // Strict 30-day expiry, no old posts, fixed likes per future post, finite post count.
 const params=prepaidNativeSupplierParams(quote,paidAt);
 if(params.old_posts!=="0"||Number(params.posts)<1||Number(params.posts)>10||
  Number(params.min)!==Number(params.max)||params.delay!=="0")throw Error("zora_subscription_parameters_invalid");
 return params;
}

export async function zoraSupplier(action,params={},options={}){
 const env=options.env||process.env;
 const key=env.ZORASMM_API_KEY;
 if(typeof key!=="string"||key.length<12)throw Error("zora_key_unconfigured");
 if(!["services","balance","status","subscription"].includes(action))
  throw Error("zora_action_forbidden");
 const args={key,action:action==="subscription"?"add":action};
 if(action==="status"){
  const order=String(params.order||"");
  if(!ORDER_ID.test(order))throw Error("zora_status_order_invalid");
  args.order=order;
 }
 if(action==="subscription"){
  if(options.claimed!==true||!zoraProviderConfigured(env))
   throw Error("zora_subscription_not_authorized");
  const service=String(params.service||"");
  const platform=String(options.platform||"");
  if(service!==approvedId(platform,env)||!/^[A-Za-z0-9._]{1,30}$/.test(String(params.username||""))||
   !Number.isSafeInteger(Number(params.min))||Number(params.min)<1||
   String(params.max)!==String(params.min)||
   !Number.isSafeInteger(Number(params.posts))||Number(params.posts)<1||Number(params.posts)>10||
   String(params.old_posts)!=="0"||!DELAYS.has(Number(params.delay))||
   !/^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/20\d{2}$/.test(String(params.expiry||"")))
   throw Error("zora_subscription_parameters_invalid");
  Object.assign(args,{service,username:String(params.username),min:String(params.min),
   max:String(params.max),posts:String(params.posts),old_posts:"0",
   delay:String(params.delay),expiry:String(params.expiry)});
 }
 let response;
 try{
  response=await (options.fetcher||fetch)(ZORA_API_URL,{
   method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams(args).toString(),cache:"no-store",redirect:"error",
   signal:AbortSignal.timeout(12000)
  });
 }catch{
  // A submitted order may have succeeded despite a timeout. Do not retry.
  throw Error(action==="subscription"?"zora_subscription_outcome_unknown":"zora_network_error");
 }
 if(!response.ok)throw Error(action==="subscription"?"zora_subscription_outcome_unknown":"zora_http_"+response.status);
 let result;
 try{result=await response.json()}catch{throw Error(action==="subscription"?"zora_subscription_outcome_unknown":"zora_non_json");}
 if(!result||typeof result!=="object"||result.error)
  throw Error("zora_supplier_rejected");
 if(action==="services"&&!Array.isArray(result))throw Error("zora_services_invalid_shape");
 if(action==="balance"&&(Array.isArray(result)||!Number.isFinite(Number(result.balance))))
  throw Error("zora_balance_invalid");
 if(action==="status"&&(Array.isArray(result)||typeof result.status!=="string"))
  throw Error("zora_status_invalid");
 if(action==="subscription"&&!ORDER_ID.test(String(result.order||"")))
  throw Error("zora_subscription_outcome_unknown");
 return result;
}
