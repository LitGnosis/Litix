import {boosteroReadOnly,boosteroProduction} from "../../../../lib/boosteroReadOnly.mjs";
import {premiumDefaultServices,filterPremiumCards} from "../../../../lib/boosteroPremiumCatalog.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
let cached=null,expires=0,flight=null;
async function load(){
 if(cached&&Date.now()<expires)return cached;
 if(!flight)flight=(async()=>{
  const raw=process.env.VERCEL_ENV==="preview"
    ?await boosteroReadOnly("services")
    :await boosteroProduction("services");
  const list=premiumDefaultServices(raw);
  cached=list;expires=Date.now()+90000;return list;
 })().finally(()=>{flight=null});
 return flight;
}
export async function GET(req){
 // Fail closed in production until every payment/fulfillment path is verified.
 if(process.env.VERCEL_ENV!=="preview"&&
    !(process.env.VERCEL_ENV==="production"&&process.env.LITIX_PREMIUM_BOOSTERO_LIVE==="true"))
  return Response.json({error:"Premium catalog not active"},{status:503,headers:{"cache-control":"no-store"}});
 try{
  const cards=await load(),filters=new URL(req.url).searchParams;
  const view=filterPremiumCards(cards,filters);
  return Response.json({...view,previewOnly:process.env.VERCEL_ENV!=="production",
   purchasingEnabled:false, // not connected to a verified new supplier submission path
   note:"Supplier listings are live. Delivery/refill wording is supplier-advertised, not a verified guarantee."},
   {headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
 }catch(e){
  console.error("Premium Boostero read-only catalog temporarily unavailable",{error:String(e.message||"supplier_error").slice(0,80)});
  return Response.json({items:[],total:0,previewOnly:true,purchasingEnabled:false,
   message:"Temporarily unavailable"},{status:503,headers:{"cache-control":"no-store"}});
 }
}