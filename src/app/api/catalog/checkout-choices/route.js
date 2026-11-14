import {after} from "next/server";
import {allBoosteroCardsSnapshot} from "../../../../lib/boosteroCatalog.mjs";
import {buildCheckoutChoices} from "../../../../lib/litixCheckoutChoices.mjs";
import {persistVerifiedCatalog,readDurableCatalog} from "../../../../lib/litixDurableCatalog.mjs";
import {CHECKOUT_PLATFORMS,choicesForPlatform} from "../../../../lib/litixCheckoutBootstrap.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=12;
const EMPTY=Object.freeze({items:[],status:"unavailable"});
let lastRefresh=0;
const capped=(job,ms,fallback)=>new Promise(resolve=>{
 const timer=setTimeout(()=>resolve(fallback),ms);
 Promise.resolve(job).then(value=>{clearTimeout(timer);resolve(value)},
  ()=>{clearTimeout(timer);resolve(fallback)});
});

// This route provides product browsing only. No cached/static quote can approve
// a PayKings charge. The separate authenticated checkout still re-quotes live.
export async function GET(request){
 const params=new URL(request.url).searchParams;
 const requested=params.get("platform")||"Instagram";
 const platform=CHECKOUT_PLATFORMS.includes(requested)?requested:"Instagram";
 let snapshot=await capped(readDurableCatalog(),1200,EMPTY);
 let choices=null;
 let fromDatabase=false;
 if(snapshot.items?.length){
  const result=buildCheckoutChoices(snapshot.items,platform);
  if(result.platform===platform&&result.items.length){choices=result;fromDatabase=true;}
 }
 // First-time visitors, expired DB snapshot, and backend outages all get
 // a real, previously verified static display snapshot rather than an empty
 // package picker. Never manufacture a service ID or wholesale price.
 if(!choices){
  const seed=choicesForPlatform(platform);
  choices={platform:seed.platform,platforms:seed.platforms,kinds:seed.kinds,
   items:seed.items,total:seed.total};
 }
 const data={
  ...choices,currency:"USD",liveAvailability:false,
  catalogStatus:fromDatabase?"cached":"static",
  note:"Previously verified Litix prices are shown for browsing. The final amount and availability are checked again before any payment."
 };
 // Supplier refresh never blocks Step 03. Only server-verified cards update
 // the Neon snapshot. Failed/disabled supplier API calls do not erase it.
 if(process.env.LITIX_BOOSTERO_ENABLED==="true"&&Date.now()-lastRefresh>5*60*1000){
  lastRefresh=Date.now();
  after(async()=>{
   const live=await capped(allBoosteroCardsSnapshot(),3800,EMPTY);
   if(live.status==="live"&&Array.isArray(live.items)&&live.items.length)
    await persistVerifiedCatalog(live.items).catch(()=>{});
  });
 }
 return Response.json(data,{status:200,headers:{
  "cache-control":"private, no-store",
  "x-content-type-options":"nosniff"
 }});
}
