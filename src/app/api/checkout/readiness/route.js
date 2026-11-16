import {boosteroProductionReady,verifyBoosteroQuote,boosteroQuote} from "../../../../lib/boosteroFulfillment.mjs";
import {boosteroProduction} from "../../../../lib/boosteroReadOnly.mjs";
import {parseCuratedId,resolveCuratedSupplier} from "../../../../lib/curatedCatalog.mjs";
import {curatedRetailQuote} from "../../../../lib/curatedVolumePricing.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=10;
const headers={"cache-control":"no-store","x-content-type-options":"nosniff"};
const reply=(payload,status=200)=>Response.json(payload,{status,headers});
const timeout=(promise,ms)=>new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>reject(new Error("verification_timeout")),ms);
 Promise.resolve(promise).then(v=>{clearTimeout(timer);resolve(v)},e=>{clearTimeout(timer);reject(e)});
});
export async function GET(request){
 const url=new URL(request.url);
 const id=url.searchParams.get("serviceId")||"";
 const curated=parseCuratedId(id);
 const serviceId=id.match(/^litix_(\d{1,12})$/)?.[1];
 const quantity=Number(url.searchParams.get("quantity"));
 const expectedAmountCents=Number(url.searchParams.get("expectedAmountCents"));
 if((!serviceId&&!curated)||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000||
  !Number.isSafeInteger(expectedAmountCents)||expectedAmountCents<100||expectedAmountCents>100000000)
  return reply({ready:false,error:"Invalid service or quantity. Review your order details."},422);
 // Explicit gateway/supplier configuration checks, never leak API keys.
 const publicKey=process.env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY||
  process.env.PAYKINGS_NMI_COLLECT_PUBLIC_KEY;
 const paymentReady=process.env.VERCEL_ENV==="production"&&
  process.env.NMI_GATEWAY_MODE!=="TEST"&&
  !!process.env.NMI_SECURITY_KEY&&!!publicKey;
 if(!paymentReady||!boosteroProductionReady())
  return reply({ready:false,error:"Secure checkout or service verification is temporarily unavailable. Retry or contact Litix support.",
   chargeAttempted:false,retryable:true},503);
 try{
  // Read-only, time-bounded LIVE supplier quote; the final POST to /api/checkout/v1
  // still performs its own independent quote, settlement and idempotency checks.
  const resolved=curated
   ?resolveCuratedSupplier(await timeout(boosteroProduction("services"),3200),
     curated.platform,curated.kind,curated.tier)
   :null;
  if(curated&&!resolved)return reply({ready:false,error:"The selected service is temporarily unavailable. No payment attempted.",
   chargeAttempted:false,retryable:true},409);
  const {quote}=curated?{quote:curatedRetailQuote(boosteroQuote({service:resolved,quantity}))}:
   await timeout(verifyBoosteroQuote(serviceId,quantity),3400);
  if(quote.amountCents!==expectedAmountCents)
   return reply({ready:false,error:"The price or service limits have changed. Refresh package details before paying.",
    expectedAmountCents,currentAmountCents:quote.amountCents,
    chargeAttempted:false,retryable:true},409);
  return reply({ready:true,serviceId:id,quantity,amountCents:quote.amountCents,
   currency:"USD",chargeAttempted:false});
 }catch{
  return reply({ready:false,error:"The current package could not be verified. No charge was attempted. Retry or choose another service.",
   chargeAttempted:false,retryable:true},503);
 }
}
