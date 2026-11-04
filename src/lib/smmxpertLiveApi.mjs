// SMMXPERT production API client. Server-only, fixed origin, no secrets in logs.
// This module is NOT connected to customer checkout until authenticated
// catalogue, wallet, currency, order ledger and live dispatch gates are passed.
export const SMMXPERT_API_URL="https://smmxpert.com/api/v2";
const READ_ACTIONS=new Set(["services","balance","status"]);
const normalizeId=value=>{
 const id=String(value??"");
 if(!/^[1-9][0-9]{0,17}$/.test(id))throw Error("smmxpert_invalid_numeric_id");
 return id;
};
const parsePositive=value=>{
 const n=Number(value);
 return Number.isFinite(n)&&n>0?n:null;
};
const asSafeErr=error=>String(error?.message??"unknown").slice(0,60);

async function callVendor(action,fields,options={}){
 const {key=process.env.LITIX_SMMXPERT_API_KEY,fetchImpl=fetch,timeoutMs=10000,allowPurchase=false}=options;
 if(!READ_ACTIONS.has(action)&&!(action==="add"&&allowPurchase))
  throw Error("smmxpert_action_not_authorized");
 if(typeof key!=="string"||key.length<20)throw Error("smmxpert_credential_missing");
 const form=new URLSearchParams({key,action,...fields});
 let response;
 try{
  response=await fetchImpl(SMMXPERT_API_URL,{
   method:"POST",redirect:"error",cache:"no-store",
   headers:{"content-type":"application/x-www-form-urlencoded","accept":"application/json"},
   body:form,signal:AbortSignal.timeout(Math.max(2000,Math.min(15000,timeoutMs)))
  });
 }catch{throw Error("smmxpert_connection_failed")}
 if(!response?.ok){
  const status=Number(response?.status)||0;
  if(status===401||status===403)throw Error("smmxpert_access_denied");
  throw Error("smmxpert_http_unavailable_"+(status>=400&&status<600?status:"unknown"));
 }
 let data;
 try{data=await response.json()}catch{throw Error("smmxpert_invalid_response")}
 if(data===null||typeof data!=="object"||Array.isArray(data)&&action!=="services")
  throw Error("smmxpert_invalid_response");
 if(data.error)throw Error("smmxpert_provider_rejected");
 return data;
}

/** Server-only. No purchases. Returns summary rather than wholesale catalog. */
export async function smmxpertConnectionCheck(options={}){
 const started=Date.now();
 const services=await callVendor("services",{},options);
 if(!Array.isArray(services)||services.length===0)throw Error("smmxpert_no_live_services");
 const valid=services.filter(s=>/^[1-9][0-9]{0,17}$/.test(String(s?.service??""))&&
  Number.isFinite(Number(s.rate))&&Number(s.rate)>0&&
  Number.isSafeInteger(Number(s.min))&&Number(s.min)>0&&
  Number.isSafeInteger(Number(s.max))&&Number(s.max)>=Number(s.min));
 const responseMs=Date.now()-started;
 const balance=await callVendor("balance",{},options);
 const currency=String(balance.currency??"").trim().toUpperCase();
 if(!["USD","INR"].includes(currency)||!Number.isFinite(Number(balance.balance)))
  throw Error("smmxpert_account_currency_unverified");
 // Do not assume rate currency equals wallet currency; supplier confirmation
 // is required independently before enabling price conversion/paid orders.
 return {authenticated:true,validServices:valid.length,receivedServices:services.length,
  accountCurrency:currency,rateCurrencyVerified:false,serviceResponseMs:responseMs};
}

/** Live read-only status for confirmed SMMXPERT order IDs only. */
export async function smmxpertReadStatus(orderIds,{ownedSupplierIds=[],...options}={}){
 if(!Array.isArray(orderIds)||!Array.isArray(ownedSupplierIds)||!orderIds.length||orderIds.length>100)
  throw Error("smmxpert_status_invalid_input");
 const ids=orderIds.map(normalizeId),owned=new Set(ownedSupplierIds.map(String));
 if(new Set(ids).size!==ids.length||ids.some(id=>!owned.has(id)))
  throw Error("smmxpert_status_order_not_owned");
 const fields=ids.length===1?{order:ids[0]}:{orders:ids.join(",")};
 const raw=await callVendor("status",fields,options);
 const byId=ids.length===1?{[ids[0]]:raw}:raw;
 if(ids.some(id=>!Object.hasOwn(byId,id)))throw Error("smmxpert_incomplete_status");
 return ids.map(id=>{
  const item=byId[id];
  if(!item||typeof item!=="object")return {id,state:"unknown",error:"unverified_status"};
  const status=String(item.status??"Unknown").slice(0,70);
  return {id,state:status,remains:parsePositive(item.remains)??(Number(item.remains)===0?0:null),
   charge:parsePositive(item.charge)??(Number(item.charge)===0?0:null),
   currency:typeof item.currency==="string"?item.currency.toUpperCase():null,
   error:item.error?"provider_error":null};
 });
}

/**
 * One purchase attempt ONLY after a durable, single-use database claim.
 * NO retries on network failure. The caller must confirm that the claim
 * corresponds to a PAID Litix order, matching approved service ID/link/qty.
 * This prevents a public or accidental caller from invoking 'add'.
 * Real checkout dispatch is intentionally NOT wired until ledger is ready.
 */
export async function smmxpertAddClaimedOrder({serviceId,link,quantity,claim},options={}){
 if(process.env.VERCEL_ENV!=="production"||
   process.env.LITIX_SMMXPERT_LIVE_ENABLED!=="true")throw Error("smmxpert_live_dispatch_disabled");
 if(!claim||claim.verifiedPaid!==true||claim.oneWayDbClaim!==true||
  typeof claim.orderId!=="string"||!/^ltx2_[a-f0-9-]{36}$/.test(claim.orderId))
  throw Error("smmxpert_paid_claim_required");
 const id=normalizeId(serviceId),q=Number(quantity);
 if(!Array.isArray(claim.approvedServiceIds)||!claim.approvedServiceIds.map(String).includes(id)||
  !Number.isSafeInteger(q)||q<1||q>1_000_000||
  !claim.matchingQuoteApproved)throw Error("smmxpert_order_not_approved");
 // Link must already be canonicalized and checked against the chosen
 // service type in checkout. Forbid credentials, fragments and non-HTTPS.
 let target;
 try{
  const u=new URL(link);
  if(u.protocol!=="https:"||u.username||u.password||u.port||u.hash||u.href.length>1100)
   throw Error("bad_url");
  target=u.toString();
 }catch{throw Error("smmxpert_invalid_destination")}
 // This is the only 'add' action, and its caller must be the internal
 // transaction-ledger dispatcher—not an API route exposed to customers.
 const raw=await callVendor("add",{service:id,link:target,quantity:String(q)},
  {...options,allowPurchase:true});
 const supplierId=normalizeId(raw.order);
 return {provider:"smmxpert",supplierOrderId:supplierId,status:"submitted"};
}
