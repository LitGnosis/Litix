import {boosteroReadOnly,boosteroProduction} from "../../../../lib/boosteroReadOnly.mjs";
import {randomUUID} from "node:crypto";
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
  // Auditable, aggregate-only inventory; never expose raw supplier records,
  // service IDs, wholesale rates, or API credentials in the public response.
  const typeCounts={};
  for(const row of raw){
   const type=String(row?.type||"Unknown").trim().slice(0,48);
   typeCounts[type]=(typeCounts[type]||0)+1;
  }
  cached={cards:list,totalSupplierServices:raw.length,typeCounts};
  expires=Date.now()+90000;return cached;
 })().finally(()=>{flight=null});
 return flight;
}
export async function GET(req){
 // Fail closed in production until every payment/fulfillment path is verified.
 if(process.env.VERCEL_ENV!=="preview"&&
    !(process.env.VERCEL_ENV==="production"&&process.env.LITIX_PREMIUM_BOOSTERO_LIVE==="true"))
  return Response.json({error:"Premium catalog not active"},{status:503,headers:{"cache-control":"no-store"}});
 try{
  const inventory=await load(),cards=inventory.cards,filters=new URL(req.url).searchParams;
  const view=filterPremiumCards(cards,filters);
  // Preview-only IDs are not redeemable and do not expose private supplier mappings.
  const publicItems=view.items.map(({id,...fields})=>({...fields,displayKey:randomUUID()}));
  const platformCounts=Object.fromEntries(view.platforms.map(platform=>[
   platform,cards.filter(card=>card.platform===platform).length
  ]));
  return Response.json({...view,items:publicItems,platformCounts,totalAll:cards.length,previewOnly:process.env.VERCEL_ENV!=="production",
   totalSupplierServices:inventory.totalSupplierServices,supplierServiceTypes:inventory.typeCounts,
   excludedSupplierServices:inventory.totalSupplierServices-cards.length,
   purchasingEnabled:false, // not connected to a verified new supplier submission path
   note:"Supplier listings are live. Delivery/refill wording is supplier-advertised, not a verified guarantee."},
   {headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
 }catch(e){
  console.error("Premium Boostero read-only catalog temporarily unavailable",{error:String(e.message||"supplier_error").slice(0,80)});
  return Response.json({items:[],total:0,previewOnly:true,purchasingEnabled:false,
   message:"Temporarily unavailable"},{status:503,headers:{"cache-control":"no-store"}});
 }
}