import {boosteroProduction} from "../../../../lib/boosteroReadOnly.mjs";
import {boosteroProductionReady} from "../../../../lib/boosteroFulfillment.mjs";
import {nativeAutoLikesCatalog} from "../../../../lib/boosteroNativeAutoLikes.mjs";
import {litixCustomerServiceName} from "../../../../lib/serviceCardDisplay.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const send=(value,status=200)=>Response.json(value,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
let inFlight=null,record=null,validUntil=0;
async function liveNativeCatalog(){
 if(record&&Date.now()<validUntil)return record;
 if(!inFlight)inFlight=(async()=>{
  const services=await boosteroProduction("services");
  if(!Array.isArray(services))throw Error("native_catalog_invalid");
  const items=["instagram","tiktok"].flatMap(platform=>nativeAutoLikesCatalog(services,platform));
  record=items.map(({serviceId,name,platform,minimum,maximum,retailPer1000Cents})=>({
   id:"litix_"+serviceId,name:litixCustomerServiceName(name),
   platform,minimum,maximum,retailPer1000Cents
  }));
  validUntil=Date.now()+90000;
  return record;
 })().finally(()=>{inFlight=null});
 return inFlight;
}
export async function GET(){
 if(!boosteroProductionReady())return send({available:false,items:[],note:"AutoLikes supplier verification unavailable"},503);
 try{
  const items=await liveNativeCatalog();
  // Availability of supplier services does NOT authorize recurring payments.
  const checkoutEnabled=false;
  return send({available:items.length>0,items,checkoutEnabled,
   supportedPlatforms:["instagram","tiktok"],maximumPostsPerTerm:30,
   note:items.length?"Native future-post services found. Subscription checkout remains disabled until verified recurring settlement.":"No compatible native future-post Likes services currently available."});
 }catch{
  return send({available:false,items:[],checkoutEnabled:false,note:"AutoLikes catalog temporarily unavailable"},503);
 }
}
