import {after} from "next/server";
import {allBoosteroCardsSnapshot} from "../../../../lib/boosteroCatalog.mjs";
import {buildCheckoutChoices} from "../../../../lib/litixCheckoutChoices.mjs";
import {persistVerifiedCatalog,readDurableCatalog} from "../../../../lib/litixDurableCatalog.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=20;

const EMPTY=Object.freeze({items:[],status:"unavailable"});
const bounded=(promise,ms,fallback)=>new Promise(resolve=>{
 const timer=setTimeout(()=>resolve(fallback),ms);
 Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value)},()=>{clearTimeout(timer);resolve(fallback)});
});
let lastRefreshAttempt=0;

// Selection is a read-only storefront view, NEVER a payment authorization.
// Serve verified Neon snapshots first; only a fresh server-side checkout quote
// can approve a PayKings charge.
export async function GET(request){
 const requested=new URL(request.url).searchParams.get("platform")||"Instagram";
 let snapshot=await bounded(readDurableCatalog(),1600,EMPTY);
 if(!snapshot.items?.length&&process.env.LITIX_BOOSTERO_ENABLED==="true"){
  snapshot=await bounded(allBoosteroCardsSnapshot(),2700,EMPTY);
  if(snapshot.status==="live"&&snapshot.items?.length){
   after(()=>persistVerifiedCatalog(snapshot.items).catch(()=>{}));
  }
 }else if(snapshot.items?.length&&process.env.LITIX_BOOSTERO_ENABLED==="true"){
  if(Date.now()-lastRefreshAttempt>5*60*1000){
   lastRefreshAttempt=Date.now();
   after(async()=>{
    const live=await bounded(allBoosteroCardsSnapshot(),4500,EMPTY);
    if(live.status==="live"&&live.items?.length)
     await persistVerifiedCatalog(live.items).catch(()=>{});
   });
  }
 }
 const choices=buildCheckoutChoices(snapshot.items,requested);
 const hasItems=choices.items.length>0;
 return Response.json({...choices,currency:"USD",
  liveAvailability:snapshot.status==="live",
  catalogStatus:hasItems?snapshot.status:"unavailable",
  note:hasItems&&snapshot.status!=="live"
    ?"Recently verified Litix services. Final availability and price are checked again at payment."
    :hasItems?"Choose a service and enter your public link to review your order."
    :"No verified packages are listed for this platform right now. Try another platform or contact Litix."
 },{headers:{
  "cache-control":"private, no-store",
  "x-content-type-options":"nosniff"
 }});
}
