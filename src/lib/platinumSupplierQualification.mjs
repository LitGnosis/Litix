/**
 * Litix Platinum: independent supplier qualification registry.
 * DATA ONLY. This module cannot issue network requests, read credentials,
 * modify routing, enable services, change pricing or submit orders.
 * Live customer orders remain explicitly Boostero-exclusive.
 */
export const LIVE_SUPPLIER = "boostero";
const registry = [
 {code:"boostero",name:"Boostero",role:"verified_live",
  endpoint:"configured_server_side_only",documentation:"https://boostero.com/",
  api:"account-specific API v2",statusMethod:"status",auth:"server_secret",
  documentedStatus:"current production integration",enabledForNewOrders:true,
  review:"Four approved service IDs; live checkout, supplier order and delivery previously verified"},
 {code:"justanotherpanel_live",name:"JustAnotherPanel.live",role:"evaluation_only",
  endpoint:"https://www.justanotherpanel.live/api/public/v2",
  documentation:"https://www.justanotherpanel.live/api",
  api:"JSON POST",statusMethod:"status",auth:"key_in_json_post_body",
  documentedStatus:"published documentation only; legal identity and domain ownership not verified",
  enabledForNewOrders:false,review:"Multiple similarly named JAP domains; do not conflate organizations or keys"},
 {code:"smmwiz",name:"SMMWiz",role:"evaluation_only",
  endpoint:"https://smmwiz.com/api/v2",
  documentation:"https://smmwiz.com/blog",
  api:"SMM panel v2 claimed",statusMethod:"to_be_verified",auth:"server_side_account_key",
  documentedStatus:"API endpoint advertised; account catalog not verified",
  enabledForNewOrders:false,review:"No account-specific service costs, order contract or reliability metrics confirmed"},
 {code:"morethanpanel",name:"MoreThanPanel",role:"evaluation_only",
  endpoint:"https://morethanpanel.com/api/v2",
  documentation:"https://morethanpanel.com/api",
  api:"form-encoded HTTPS POST",statusMethod:"poll_batch_up_to_100",auth:"key_in_post_body",
  documentedStatus:"published detailed API; customer account, commercial approval and runtime metrics not verified",
  enabledForNewOrders:false,review:"No status webhooks documented; respect polling backoff and provider rate limits"}
];
export const SUPPLIER_REGISTRY=Object.freeze(registry.map(v=>Object.freeze({...v})));
const evidenceFields=[
 "verifiedEntityAndDomain","commercialAuthorization","accountOwnerApproved",
 "readOnlyApiAuthenticated","accountCatalogRetrieved","accountPricesAndLimitsValidated",
 "serviceInputTypesMapped","fulfillmentAndStatusContractVerified",
 "independentReliabilitySample","platformPolicyReview","ownerApprovedForDispatch"
];
export const REQUIRED_SUPPLIER_EVIDENCE=Object.freeze(evidenceFields);
export function currentSupplierForNewOrder(){
 return LIVE_SUPPLIER;
}
export function supplierEvaluation(code,evidence={}){
 const item=SUPPLIER_REGISTRY.find(x=>x.code===code);
 if(!item)return {code:String(code||"").slice(0,50),decision:"unknown_supplier",checkoutAllowed:false,missing:[]};
 const missing=evidenceFields.filter(key=>evidence[key]!==true);
 // This research tool never authorizes new suppliers. Enabling requires a
 // separately reviewed source change, dispatch pathway and release approval.
 return {code:item.code,name:item.name,role:item.role,
  decision:item.code==="boostero"?"current_allowlisted_only":"evaluation_only",
  checkoutAllowed:item.code==="boostero",
  proposedIntegrationApproved:false,missing,
  historicalOrdersProviderMustRemainUnchanged:true};
}
const finitePositive=x=>typeof x==="number"&&Number.isFinite(x)&&x>=0;
export function summarizeIndependentSupplierMetrics(snapshots=[]){
 if(!Array.isArray(snapshots)||!snapshots.length)return {verified:false,reason:"no_measured_samples"};
 const valid=snapshots.every(x=>x&&typeof x==="object"&&typeof x.timestamp==="string"&&
   typeof x.success==="boolean"&&finitePositive(x.latencyMs)&&x.latencyMs<=120000);
 if(!valid)return {verified:false,reason:"invalid_measurements"};
 const sample=[...snapshots].sort((a,b)=>a.latencyMs-b.latencyMs);
 const success=snapshots.filter(x=>x.success).length;
 const p95=sample[Math.ceil(sample.length*0.95)-1].latencyMs;
 return {verified:true,sampleCount:sample.length,successCount:success,
  availabilityPercent:Math.round(success/sample.length*10000)/100,
  p95LatencyMs:p95,
  // Samples without an independently verified observation window are not
  // equivalent to measured historical uptime.
  historicalUptimeVerified:false};
}
export function validateAccountService(service){
 if(!service||typeof service!=="object")return {valid:false,reason:"missing_service"};
 const id=String(service.service??service.id??"");
 const rate=Number(service.rate),min=Number(service.min),max=Number(service.max);
 if(!/^\d{1,12}$/.test(id)||!Number.isFinite(rate)||rate<=0||
    !Number.isSafeInteger(min)||min<1||!Number.isSafeInteger(max)||max<min)
  return {valid:false,reason:"invalid_price_or_limits"};
 const type=String(service.type||"").trim();
 if(!type||type.length>100)return {valid:false,reason:"unknown_input_type"};
 return {valid:true,id,ratePer1000:rate,min,max,type,
  explicitlyApproved:false,checkoutAllowed:false};
}
