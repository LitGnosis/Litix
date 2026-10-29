/**
 * Catalog validation is not payment or supplier authorization.
 * Service IDs are never allowlisted in source code: capabilities are checked by
 * the exact supplier type and the implemented adapter at the moment of checkout.
 */
import {normalizeBoosteroService} from "./boosteroGlobalCatalog.mjs";
import {boosteroOrderCapability,supportedBoosteroType} from "./boosteroFullOrderContracts.mjs";
import {boosteroRetailCandidate} from "./boosteroRetail25.mjs";
export const serviceStates=Object.freeze([
 "IMPORTED","VERIFIED","PURCHASABLE","UNSUPPORTED_TYPE","INVALID_METADATA",
 "SUPPLIER_UNAVAILABLE","DISCONTINUED","PENDING_REVIEW"
]);
const validId=x=>/^\d{1,12}$/.test(String(x??""));
export function checkBoosteroService(raw,{dispatchTypes=new Set(["Default"]),approvedCheckout=false}={}){
 const id=raw&&typeof raw==="object"?String(raw.service??raw.id??""):null;
 if(!validId(id))return {id:null,state:"INVALID_METADATA",reason:"missing_or_invalid_service_id",service:null};
 const service=normalizeBoosteroService(raw);
 if(!service){
  const rate=Number(raw?.rate),min=Number(raw?.min),max=Number(raw?.max);
  const reason=!String(raw?.name||"").trim()||!String(raw?.category||"").trim()?"name_or_category_missing":
   !Number.isFinite(rate)||rate<=0?"invalid_wholesale":
   !Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min<=0||max<min?"invalid_quantity_limits":
   "unrecognized_supplier_metadata";
  return {id,state:"INVALID_METADATA",reason,service:null};
 }
 const type=supportedBoosteroType(service.type);
 if(!type)return {id,state:"UNSUPPORTED_TYPE",reason:"unsupported_supplier_type",service};
 const capability=boosteroOrderCapability(service);
 if(!capability.schemaSupported)return {id,state:"PENDING_REVIEW",reason:capability.status,service};
 const pricing=service.type==="Default"&&!service.dripfeed?
   boosteroRetailCandidate(service.wholesaleRateText):
   {retailCents:null,reviewReason:"special_service_billing_unverified"};
 if(pricing.reviewReason)return {id,state:"PENDING_REVIEW",reason:pricing.reviewReason,service,retailCents:pricing.retailCents};
 // Preserve the published $6–$15 ceiling for ordinary Instagram/TikTok
 // followers/views (premium long-refill exceptions require separate approval).
 const protectedTier=["Instagram","TikTok"].includes(service.platform)&&
  ["followers","views"].includes(service.kind);
 if(protectedTier&&pricing.retailCents!==null&&pricing.retailCents>1500)
  return {id,state:"PENDING_REVIEW",reason:"existing_social_price_ceiling_conflict",service,retailCents:pricing.retailCents};
 if(!service.supportedInputShape)
  return {id,state:"VERIFIED",reason:"checkout_adapter_not_implemented",service,retailCents:pricing.retailCents};
 if(!dispatchTypes.has(type))return {id,state:"VERIFIED",reason:"order_type_dispatch_not_verified",service,retailCents:pricing.retailCents};
 if(!approvedCheckout)return {id,state:"VERIFIED",reason:"payment_and_dispatch_release_not_approved",service,retailCents:pricing.retailCents};
 // A validated contract still requires live quote, paid ledger, and one-shot
 // dispatch at the payment boundary. This result cannot initiate an order.
 return {id,state:"PURCHASABLE",reason:null,service,retailCents:pricing.retailCents};
}
export function validateBoosteroBatch(rows,options={}){
 if(!Array.isArray(rows)||rows.length<1)throw Error("supplier_catalog_not_array_or_empty");
 const seen=new Set(),valid=[],excluded=[],reasons={};
 for(let i=0;i<rows.length;i++){
  const result=checkBoosteroService(rows[i],options);
  if(result.id!==null&&seen.has(result.id)){
   result.state="INVALID_METADATA";result.reason="duplicate_service_id";
  }
  if(result.id!==null)seen.add(result.id);
  if(result.service&&result.state!=="INVALID_METADATA")valid.push(result);
  else excluded.push({index:i,id:result.id,state:result.state,reason:result.reason});
  if(result.reason)reasons[result.reason]=(reasons[result.reason]||0)+1;
 }
 return {valid,excluded,reasons,received:rows.length,uniqueSeen:seen.size};
}
