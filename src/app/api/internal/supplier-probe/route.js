// A minimal, non-sensitive diagnostic for Litix's secondary upstream.
// Read-only supplier calls, guarded by short in-process caching.
// No supplier names, supplier costs, numeric balances, IDs, or keys exposed.
import {joySmmConnectionSummary} from "../../../../lib/joysmmReadOnly.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=45;
const headers={"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
const respond=(body,status=200)=>Response.json(body,{status,headers});
let cached=null,expiresAt=0,flight=null;
export async function GET(){
 if(process.env.VERCEL_ENV!=="production")return respond({status:"PREVIEW_ONLY",liveConnectionChecked:false,checkoutRerouted:false});
 if(!process.env.LITIX_JOYSMM_API_KEY)
  return respond({status:"CREDENTIAL_NOT_CONFIGURED",connected:false,checkoutRerouted:false},503);
 if(cached&&Date.now()<expiresAt)return respond(cached.body,cached.http);
 if(!flight){
  flight=(async()=>{
   let body,http=200;
   try{
    const result=await joySmmConnectionSummary();
    body={status:"READ_ONLY_CONNECTED",connected:result.connected,servicesChecked:result.catalogServiceCount,
     recommendedCount:result.recommendedServiceCount,
     futurePostSubscriptionCandidates:result.futurePostSubscriptionCandidates,
     subscriptionPlatforms:result.subscriptionPlatforms,
     walletFunded:result.walletFunded,walletCurrency:result.walletCurrency,
     rateCurrencyVerified:result.currencyRateParityVerified,
     checkoutRerouted:false,paidDispatchEnabled:false,
     newOrderFulfillmentVerified:false};
   }catch{
    http=503;
    body={status:"READ_ONLY_UNVERIFIED",connected:false,checkoutRerouted:false,paidDispatchEnabled:false};
   }
   cached={body,http};expiresAt=Date.now()+(http===200?300000:45000);
   return cached;
  })().finally(()=>{flight=null;});
 }
 const result=await flight;
 return respond(result.body,result.http);
}
export async function POST(){return respond({error:"READ_ONLY_ROUTE"},405);}
