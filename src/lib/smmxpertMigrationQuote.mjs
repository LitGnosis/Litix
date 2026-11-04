// SMMXPERT preflight only. No payment, supplier purchase, order dispatch,
// customer checkout or catalog imports. Never treat Indian rupees as US dollars.
import {litixPlatform,litixKind} from "./litixServiceClassify.mjs";
import {litixRetailPer1000Cents,litixServiceMinimum,litixOrderCents} from "./litixRetail60.mjs";

export const SMMXPERT_ENDPOINT="https://smmxpert.com/api/v2";
export const SMMXPERT_APPROVAL_MAX_AGE_MS=15*60*1000;
const finitePositive=x=>typeof x==="number"&&Number.isFinite(x)&&x>0;
export const normalizeSmmxpertCurrency=x=>{
 const v=String(x??"").trim().toUpperCase();
 if(v!=="USD"&&v!=="INR")throw Error("smmxpert_unsupported_account_currency");
 return v;
};
export function smmxpertRateUsd(rate,{accountCurrency,fxUsdPerInr,fxVerifiedAt,now=Date.now()}={}){
 const wholesale=Number(rate);
 if(!finitePositive(wholesale)||wholesale>10000000)throw Error("smmxpert_invalid_supplier_rate");
 const currency=normalizeSmmxpertCurrency(accountCurrency);
 if(currency==="USD")return wholesale;
 // When the reseller account is INR, the correct USD/INR spot rate must be
 // supplied independently and recently verified. No implicit 1:1 conversion.
 if(!finitePositive(fxUsdPerInr)||fxUsdPerInr<0.001||fxUsdPerInr>0.1||
  !Number.isSafeInteger(fxVerifiedAt)||fxVerifiedAt>now||
  now-fxVerifiedAt>SMMXPERT_APPROVAL_MAX_AGE_MS)
  throw Error("smmxpert_live_fx_unavailable");
 const converted=wholesale*fxUsdPerInr;
 if(!finitePositive(converted))throw Error("smmxpert_invalid_converted_rate");
 return converted;
}
export function smmxpertDraftQuote(service,quantity,{
 accountCurrency,fxUsdPerInr,fxVerifiedAt,now=Date.now(),
 approvedServiceIds=[],requiredPlatform,requiredKind
}={}){
 const id=String(service?.id??service?.service??"");
 if(!/^[0-9]{1,12}$/.test(id)||!Array.isArray(approvedServiceIds)||
  !approvedServiceIds.some(x=>String(x)===id))throw Error("smmxpert_service_not_approved");
 if(String(service?.serviceType??service?.type??"").toLowerCase()!=="default")
  throw Error("smmxpert_service_type_not_supported");
 const platform=litixPlatform(service?.name,service?.category);
 const kind=litixKind(service?.name,service?.category);
 if(platform!==requiredPlatform||kind!==requiredKind||
  !["Instagram","TikTok","YouTube","Twitter (X)"].includes(platform)||
  !["followers","likes","views","subscribers","retweets"].includes(kind))
  throw Error("smmxpert_service_category_mismatch");
 const min=Number(service?.min),max=Number(service?.max),qty=Number(quantity);
 if(!Number.isSafeInteger(min)||min<1||!Number.isSafeInteger(max)||max<min||max>1_000_000||
  !Number.isSafeInteger(qty)||qty<min||qty>max)
  throw Error("smmxpert_invalid_quantity");
 const wholesalePer1000USD=smmxpertRateUsd(
  service?.retailIndependentRate??service?.rate,
  {accountCurrency,fxUsdPerInr,fxVerifiedAt,now}
 );
 const retailPer1000Cents=litixRetailPer1000Cents(wholesalePer1000USD,service);
 const retailMinimum=litixServiceMinimum(min,max,retailPer1000Cents);
 const retailTotalCents=litixOrderCents(retailPer1000Cents,qty);
 const wholesaleTotalCents=Math.ceil(wholesalePer1000USD*qty/1000*100-1e-8);
 if(retailMinimum===null||qty<retailMinimum||retailTotalCents===null||
  retailTotalCents<100||
  retailTotalCents<Math.ceil(wholesalePer1000USD*qty/1000*160-1e-8))
  throw Error("smmxpert_insufficient_retail_margin");
 return {
  provider:"smmxpert",id,platform,kind,quantity:qty,
  retailMinimum,retailPer1000Cents,retailTotalCents,
  wholesaleTotalCents,wholesalePer1000USD,accountCurrency
 };
}
export function smmxpertActivationBlockers({
 apiKeyPresent=false,catalogReadVerified=false,balanceCurrencyVerified=false,
 fxVerified=false,serviceIdsApproved=false,idempotentDispatchImplemented=false,
 historicalOrderIsolationVerified=false,trackingAndRefundsVerified=false,
 paidEndToEndTestVerified=false
}={}){
 const gates={
  apiKeyPresent,catalogReadVerified,balanceCurrencyVerified,fxVerified,
  serviceIdsApproved,idempotentDispatchImplemented,historicalOrderIsolationVerified,
  trackingAndRefundsVerified,paidEndToEndTestVerified
 };
 return Object.entries(gates).filter(([,ok])=>ok!==true).map(([name])=>name);
}
