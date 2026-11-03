// Litix supplier qualification: isolated, read-only SMM Panel v2 probes.
// Not imported by production checkout, fulfillment, billing or catalog routes.
// IMPORTANT: never expose vendor keys or copy their rates into public UI.
export const TRIAL_PROVIDERS=Object.freeze({
 smmxpert:Object.freeze({
  name:"SMMXPERT",endpoint:"https://smmxpert.com/api/v2",
  keyEnvironment:"LITIX_TRIAL_SMMXPERT_API_KEY"
 }),
 morethanpanel:Object.freeze({
  name:"MoreThanPanel",endpoint:"https://morethanpanel.com/api/v2",
  keyEnvironment:"LITIX_TRIAL_MORETHANPANEL_API_KEY"
 })
});
const MAX_STATUS_IDS=100;
const recognized=new Set(["services","balance","status"]);
const safeOrderId=id=>/^[0-9]{1,18}$/.test(String(id));
const asFiniteNumber=value=>{
 const n=Number(value);
 return value===null||value===undefined||String(value).trim()===""||!Number.isFinite(n)?null:n;
};

/**
 * Runs ONLY supplier GET-LIKE actions, although each vendor's API v2 uses
 * HTTP POST. A top-level action whitelist makes it impossible to issue add,
 * refill, cancel, credit or account mutation requests through this function.
 *
 * Status requires a vendor-owned TEST order ID explicitly in ownedTrialIds.
 * Boostero orders are never suitable for querying either alternative account.
 */
export async function supplierTrialReadOnly({
 provider,action,key,ownedTrialIds=[],orderIds=[],transport=fetch,
 timeoutMs=9000
}={}){
 const vendor=TRIAL_PROVIDERS[provider];
 if(!vendor)throw Error("supplier_trial_provider_not_approved");
 if(!recognized.has(action))throw Error("supplier_trial_action_not_read_only");
 if(typeof key!=="string"||key.length<12||key.length>512)
  throw Error("supplier_trial_key_missing");
 if(typeof transport!=="function")throw Error("supplier_trial_transport_invalid");
 let ids=[];
 if(action==="status"){
  if(!Array.isArray(orderIds)||!Array.isArray(ownedTrialIds))
   throw Error("supplier_trial_order_ids_invalid");
  ids=[...new Set(orderIds.map(id=>String(id)))];
  const owned=new Set(ownedTrialIds.map(id=>String(id)));
  if(!ids.length||ids.length>MAX_STATUS_IDS||
    ids.some(id=>!safeOrderId(id)||!owned.has(id)))
   throw Error("supplier_trial_order_ids_not_owned");
 }
 // This endpoint is static, explicit and HTTPS; no arbitrary URL or redirect
 // target is accepted from caller input.
 const data=new URLSearchParams({key,action});
 if(action==="status")
  data.set(ids.length===1?"order":"orders",ids.length===1?ids[0]:ids.join(","));
 let response;
 try{
  response=await transport(vendor.endpoint,{
   method:"POST",
   headers:{"content-type":"application/x-www-form-urlencoded","accept":"application/json"},
   body:data,
   cache:"no-store",redirect:"error",
   signal:AbortSignal.timeout(Math.max(1000,Math.min(15000,timeoutMs)))
  });
 }catch{
  throw Error("supplier_trial_transport_unavailable");
 }
 if(!response||!response.ok)throw Error("supplier_trial_http_unavailable");
 let payload;
 try{payload=await response.json()}
 catch{throw Error("supplier_trial_invalid_json")}
 // Both providers sometimes return HTTP 200 with an error object.
 if(payload===null||typeof payload!=="object"||
  (typeof payload.error==="string"&&payload.error.trim()))
  throw Error("supplier_trial_provider_rejected_request");
 if(action==="services"){
  if(!Array.isArray(payload))throw Error("supplier_trial_catalog_not_array");
  const services=payload
   .filter(item=>item&&typeof item==="object"&&!Array.isArray(item))
   .map(item=>({
    id:String(item.service??""),
    name:String(item.name??"").slice(0,180),
    category:String(item.category??"").slice(0,120),
    serviceType:String(item.type??"").slice(0,70),
    retailIndependentRate:asFiniteNumber(item.rate),
    min:asFiniteNumber(item.min),
    max:asFiniteNumber(item.max),
    refill:item.refill===true,
    cancel:item.cancel===true
   })).filter(item=>safeOrderId(item.id)&&
      item.retailIndependentRate!==null&&item.retailIndependentRate>=0&&
      Number.isInteger(item.min)&&item.min>0&&
      Number.isInteger(item.max)&&item.max>=item.min);
  return {provider,action,services,validCount:services.length,receivedCount:payload.length};
 }
 if(action==="balance"){
  const balance=asFiniteNumber(payload.balance);
  if(balance===null||balance<0||typeof payload.currency!=="string")
   throw Error("supplier_trial_balance_invalid");
  return {provider,action,currency:payload.currency.toUpperCase(),balance};
 }
 // Status payloads are only readable for explicitly owned trial IDs.
 const raw=ids.length===1?{[ids[0]]:payload}:payload;
 if(!raw||Array.isArray(raw)||ids.some(id=>!Object.hasOwn(raw,id)))
  throw Error("supplier_trial_status_incomplete");
 return {provider,action,byId:ids.map(id=>({
  id,status:String(raw[id]?.status??"Unknown").slice(0,60),
  remains:asFiniteNumber(raw[id]?.remains),
  charge:asFiniteNumber(raw[id]?.charge),
  error:typeof raw[id]?.error==="string"?"supplier_error":null
 }))};
}
export function summarizeSupplierTrialServices(result){
 if(result?.action!=="services"||!Array.isArray(result.services))throw Error("supplier_trial_result_invalid");
 const categories=["Instagram","TikTok","YouTube","X","Facebook"];
 const matches=Object.fromEntries(categories.map(name=>[name,0]));
 const qualified=[];
 for(const service of result.services){
  const text=(service.name+" "+service.category).toLowerCase();
  for(const category of categories){
   if(text.includes(category.toLowerCase()))matches[category]++;
  }
  if(/instagram|tiktok/.test(text)&&/followers|likes|views/.test(text))
   qualified.push(service);
 }
 return {provider:result.provider,count:result.validCount,
  invalidCount:result.receivedCount-result.validCount,
  platformCounts:matches,qualifiedServices:qualified};
}
