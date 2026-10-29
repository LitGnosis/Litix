/**
 * Qualification-only HTTP adapters. No public route imports this module.
 * No add, refill, cancel, route failover or payment methods.
 * This cannot be used on production; live Boostero remains the only provider.
 */
import {SUPPLIER_REGISTRY} from "./platinumSupplierQualification.mjs";
const READ_ONLY_ACTIONS=new Set(["services","balance","status"]);
const MAX_BODY=1024*1024;
function validServiceIds(ids,max){
 if(!Array.isArray(ids)||ids.length<1||ids.length>max||ids.some(x=>!/^\d{1,24}$/.test(String(x))))
  throw Error("invalid_owned_supplier_order_ids");
 return ids.map(String);
}
export function planReadOnlyStatusPolls(provider,ownedOrderIds,{batchSize=100}={}){
 if(provider!=="morethanpanel")throw Error("provider_polling_not_documented");
 const ids=validServiceIds(ownedOrderIds,10000);
 const n=Math.max(1,Math.min(100,Number.isSafeInteger(batchSize)?batchSize:1));
 return Array.from({length:Math.ceil(ids.length/n)},(_,i)=>Object.freeze({
  action:"status",orders:ids.slice(i*n,i*n+n),minDelayMs:1000,
  // Never automatically submit status requests for unknown/unowned orders.
  accountOwnershipRequired:true
 }));
}
function decodeJsonResponse(raw){
 if(typeof raw!=="string"||raw.length>MAX_BODY)throw Error("supplier_response_too_large");
 let data;try{data=JSON.parse(raw)}catch{throw Error("supplier_invalid_json")}
 if(data?.error)throw Error("supplier_response_error");
 return data;
}
export function normalizePolledStatus(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||raw.error) return {valid:false};
 const status=String(raw.status||"").trim().toLowerCase().replace(/[\s_-]+/g,"_");
 const accepted=new Set(["pending","in_progress","processing","completed","partial","canceled","cancelled","failed"]);
 if(!accepted.has(status))return {valid:false};
 const remains=raw.remains==null?null:Number(raw.remains);
 if(remains!==null&&(!Number.isSafeInteger(remains)||remains<0))return {valid:false};
 return {valid:true,status:status==="cancelled"?"canceled":status,remains,
  // Supplier status alone must not declare refund or card settlement.
  paymentVerified:false,deliveryIndependentlyVerified:false};
}
export async function qualificationReadOnlyCall({
 provider,action,apiKey,ownedOrderIds=[],fetchImpl=fetch,environment="preview",
 ownerAuthorized=false
}={}){
 const spec=SUPPLIER_REGISTRY.find(x=>x.code===provider);
 if(!spec||spec.role!=="evaluation_only")throw Error("existing_live_supplier_uses_current_integration");
 if(environment!=="preview"||ownerAuthorized!==true)throw Error("qualification_requires_authorized_preview");
 if(!READ_ONLY_ACTIONS.has(action))throw Error("mutating_supplier_action_not_permitted");
 if(typeof apiKey!=="string"||apiKey.length<8||apiKey.length>500)throw Error("missing_supplier_credential");
 if(provider==="smmwiz")throw Error("api_contract_not_confirmed");
 const url=spec.endpoint;
 const endpoint=new URL(url);
 if(endpoint.protocol!=="https:"||!["www.justanotherpanel.live","morethanpanel.com"].includes(endpoint.hostname))
  throw Error("supplier_endpoint_not_allowlisted");
 let payload={action,key:apiKey};
 if(action==="status"){
  if(provider!=="morethanpanel")throw Error("status_format_not_verified");
  const ids=validServiceIds(ownedOrderIds,100);
  payload={...payload,orders:ids.join(",")};
 }
 const json=provider==="justanotherpanel_live";
 const body=json?JSON.stringify(payload):new URLSearchParams(payload).toString();
 const timeout=AbortSignal.timeout(8000);
 // Supplied fetch is injectable for offline tests; no credentials are logged.
 const res=await fetchImpl(url,{
  method:"POST",
  headers:{"content-type":json?"application/json":"application/x-www-form-urlencoded"},
  body,signal:timeout,cache:"no-store",redirect:"error"
 });
 if(!res.ok)throw Error("supplier_http_error");
 const data=decodeJsonResponse(await res.text());
 if(action==="services"&&!Array.isArray(data))throw Error("supplier_catalog_shape_invalid");
 return data;
}
