// Litix JoySMM API v2 adapter: authenticated read-only qualification.
// Never imported by checkout, pricing, existing Boostero dispatch, or paid orders.
// Never expose API keys, wallet amounts, wholesale rates, or service IDs publicly.
import {eligibleFuturePostLikes} from "./litixSubscriptionSupplierEvaluation.mjs";
export const JOYSMM_ENDPOINT="https://joysmm.net/api/v2";
const READ_ACTIONS=new Set(["services","balance","status"]);
const numericId=x=>/^[1-9]\d{0,17}$/.test(String(x??""));
const money=x=>x!==null&&x!==undefined&&String(x).trim()!==""&&Number.isFinite(Number(x))?Number(x):null;
export async function joySmmReadOnly({action,key=process.env.LITIX_JOYSMM_API_KEY,ownedOrderIds=[],orderIds=[],transport=fetch,timeoutMs=12000}={}){
 if(!READ_ACTIONS.has(action))throw Error("joysmm_mutation_forbidden");
 if(typeof key!=="string"||key.length<16||key.length>512)throw Error("joysmm_api_key_unconfigured");
 if(typeof transport!=="function")throw Error("joysmm_transport_invalid");
 let ids=[];
 if(action==="status"){
  if(!Array.isArray(orderIds)||!Array.isArray(ownedOrderIds))throw Error("joysmm_order_ids_invalid");
  ids=[...new Set(orderIds.map(String))];
  const owned=new Set(ownedOrderIds.map(String));
  if(ids.length<1||ids.length>50||ids.some(id=>!numericId(id)||!owned.has(id)))throw Error("joysmm_order_not_owned");
 }
 const body=new URLSearchParams({key,action});
 if(action==="status")body.set(ids.length===1?"order":"orders",ids.join(","));
 let response;
 try{
  response=await transport(JOYSMM_ENDPOINT,{
   method:"POST",headers:{"content-type":"application/x-www-form-urlencoded","accept":"application/json"},
   body,cache:"no-store",redirect:"error",
   signal:AbortSignal.timeout(Math.max(2000,Math.min(18000,timeoutMs)))
  });
 }catch{throw Error("joysmm_network_unavailable");}
 if(!response?.ok)throw Error("joysmm_http_"+(Number(response?.status)||"unknown"));
 let value;
 try{value=await response.json();}catch{throw Error("joysmm_non_json_response");}
 if(!value||typeof value!=="object"||(!Array.isArray(value)&&typeof value.error==="string"&&value.error.trim()))
  throw Error("joysmm_api_response_rejected");
 if(action==="services"){
  if(!Array.isArray(value)||value.length>40000)throw Error("joysmm_catalog_shape_invalid");
  const services=value.filter(x=>{
   const id=String(x?.service??""),rate=money(x?.rate),min=Number(x?.min),max=Number(x?.max);
   return numericId(id)&&rate!==null&&rate>=0&&Number.isSafeInteger(min)&&min>0&&Number.isSafeInteger(max)&&max>=min;
  }).map(x=>({service:Number(x.service),name:String(x.name||"").slice(0,180),
    category:String(x.category||"").slice(0,150),type:String(x.type||"").slice(0,75),
    rate:Number(x.rate),min:Number(x.min),max:Number(x.max),refill:x.refill===true,cancel:x.cancel===true}));
  return {action,services,receivedCount:value.length,validCount:services.length};
 }
 if(action==="balance"){
  const balance=money(value.balance),currency=String(value.currency||"").toUpperCase();
  if(balance===null||balance<0||!/^[A-Z]{3}$/.test(currency))throw Error("joysmm_wallet_invalid");
  return {action,balance,currency};
 }
 const records=ids.length===1?{[ids[0]]:value}:value;
 if(!records||Array.isArray(records)||ids.some(id=>!Object.hasOwn(records,id)))throw Error("joysmm_status_incomplete");
 return {action,orders:ids.map(id=>({id,status:String(records[id]?.status||"Unknown").slice(0,80),
  remains:money(records[id]?.remains),charge:money(records[id]?.charge)}))};
}
/** Only sanitized flags and counts can pass into a non-owner health response. */
export async function joySmmConnectionSummary({key=process.env.LITIX_JOYSMM_API_KEY,transport=fetch}={}){
 const catalog=await joySmmReadOnly({action:"services",key,transport});
 if(catalog.validCount===0)throw Error("joysmm_no_valid_services");
 const wallet=await joySmmReadOnly({action:"balance",key,transport});
 const auto=eligibleFuturePostLikes(catalog.services);
 return Object.freeze({connected:true,readOnly:true,paidDispatchEnabled:false,
  catalogServiceCount:catalog.validCount,invalidCatalogRows:catalog.receivedCount-catalog.validCount,
  recommendedServiceCount:catalog.services.filter(s=>/recommended services/i.test(s.category)).length,
  futurePostSubscriptionCandidates:auto.length,
  subscriptionPlatforms:[...new Set(auto.map(x=>x.platform))].sort(),
  walletFunded:wallet.balance>0,walletCurrency:wallet.currency,
  currencyRateParityVerified:false,
  // Supplier claims and capability signatures still require manual review.
  newOrderFulfillmentVerified:false});
}
