import {createHmac} from "node:crypto";
import {boosteroReadOnly,boosteroProduction} from "../../../../lib/boosteroReadOnly.mjs";
import {normalizeBoosteroCatalog} from "../../../../lib/boosteroGlobalCatalog.mjs";
import {boosteroOrderCapability} from "../../../../lib/boosteroFullOrderContracts.mjs";
import {enabledBoosteroCards} from "../../../../lib/boosteroCatalog.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
let snapshot=null,validUntil=0,loading=null;
const priority={Instagram:0,TikTok:1,YouTube:2,Facebook:3,"Twitter/X":4,Spotify:5};
const kinds={followers:0,likes:1,views:2,comments:3,shares:4,auto_engagement:5};
const pageSize=24;
const safeText=(value,n)=>String(value||"").replace(/[\u0000-\u001f]/g," ").trim().slice(0,n);
async function inventory(){
 if(snapshot&&Date.now()<validUntil)return snapshot;
 if(!loading)loading=(async()=>{
  if(!["preview","production"].includes(process.env.VERCEL_ENV)||
    (process.env.VERCEL_ENV==="production"&&process.env.LITIX_BOOSTERO_ENABLED!=="true"))
   throw Error("supplier_disabled");
  const raw=process.env.VERCEL_ENV==="production"
   ?await boosteroProduction("services"):await boosteroReadOnly("services");
  const normalized=normalizeBoosteroCatalog(raw);
  if(normalized.stats.valid<100||normalized.stats.valid/Math.max(1,normalized.stats.retrieved)<.95)
   throw Error("supplier_incomplete_catalog");
  snapshot=normalized;validUntil=Date.now()+5*60*1000;return normalized;
 })().finally(()=>{loading=null});
 return loading;
}
export async function GET(request){
 const headers={"cache-control":"no-store","x-robots-tag":"noindex","x-content-type-options":"nosniff"};
 const respond=(body,status=200)=>Response.json(body,{status,headers});
 try{
  const {items,stats}=await inventory();
  // Only the existing production-approved cards are purchasable. Never infer
  // approval from a live supplier listing or a calculated retail estimate.
  let approved=[];
  if(process.env.VERCEL_ENV==="production")
   approved=await enabledBoosteroCards().catch(()=>[]);
  const byId=new Map(approved.map(s=>[String(s.id),s]));
  const search=new URL(request.url).searchParams;
  const q=safeText(search.get("q"),80).toLowerCase(),platform=safeText(search.get("platform"),50);
  const category=safeText(search.get("category"),140),kind=safeText(search.get("kind"),45);
  const sort=safeText(search.get("sort"),20);
  const pageRaw=Number(search.get("page")||1);
  const page=Number.isSafeInteger(pageRaw)?Math.max(1,Math.min(pageRaw,5000)):1;
  const filtered=items.filter(s=>(!platform||s.platform===platform)&&
    (!category||s.category===category)&&(!kind||s.kind===kind)&&
    (!q||(s.name+" "+s.category+" "+s.platform+" "+s.kind).toLowerCase().includes(q)));
  const ordered=[...filtered].sort((a,b)=>{
   const aa=byId.get("boostero_"+a.id),bb=byId.get("boostero_"+b.id);
   if(sort==="price_low"){
    const av=aa?.per1000??Infinity,bv=bb?.per1000??Infinity;
    if(av!==bv)return av-bv;
   }else if(sort==="price_high"){
    const av=aa?.per1000??-1,bv=bb?.per1000??-1;
    if(av!==bv)return bv-av;
   }
   return (priority[a.platform]??20)-(priority[b.platform]??20)||
    (kinds[a.kind]??20)-(kinds[b.kind]??20)||
    a.platform.localeCompare(b.platform)||a.category.localeCompare(b.category)||
    a.name.localeCompare(b.name)||Number(a.id)-Number(b.id);
  });
  const visibleCategories=[...new Set(items.filter(s=>!platform||s.platform===platform).map(s=>s.category))].sort((a,b)=>a.localeCompare(b)).slice(0,500);
  const result=ordered.slice((page-1)*pageSize,page*pageSize).map(s=>{
   const card=byId.get("boostero_"+s.id);
   const contract=boosteroOrderCapability(s);
   const opaque="service_"+createHmac("sha256",process.env.BOOSTERO_API_KEY||"unconfigured").update(s.id).digest("hex").slice(0,24);
   return {id:opaque,platform:s.platform,
    name:safeText(s.name,180).replace(/^\s*#?\d{3,7}\s*[-:|]\s*/,""),
    category:safeText(s.category,140),kind:s.kind,type:s.type,
    supplierMinimum:s.min,supplierMaximum:s.max,refill:s.refill,dripfeed:s.dripfeed,
    purchasable:!!card?.purchasable,orderFormSupported:contract.schemaSupported,
    checkoutPath:card?.purchasable?"/#custom-orders":null,
    pricePer1000:card?.purchasable?card.per1000:null,
    minimumRetailCents:card?.purchasable?card.startingAmountCents:null,
    status:card?.purchasable?"approved":"awaiting_checkout_compatibility_and_pricing",
    // Never return supplier service ID, wholesale rates, provider API key or DB metadata.
   };
  });
  const choices=ordered.slice(0,500).map(s=>({
   id:"service_"+createHmac("sha256",process.env.BOOSTERO_API_KEY||"unconfigured").update(s.id).digest("hex").slice(0,24),
   name:safeText(s.name,180).replace(/^\\s*#?\\d{3,7}\\s*[-:|]\\s*/,""),
   category:safeText(s.category,140),type:s.type,kind:s.kind,platform:s.platform,
   minimum:s.min,maximum:s.max,dripfeed:s.dripfeed,
   purchasable:!!byId.get("boostero_"+s.id)?.purchasable
  }));
  return respond({supplier:"boostero",supplierExclusive:true,source:"authenticated_live_services",
   observedAt:new Date().toISOString(),supplierTotal:stats.retrieved,validTotal:stats.valid,
   invalidTotal:stats.invalid,duplicates:stats.duplicates,
   approvedLiveCount:approved.length,filteredTotal:filtered.length,page,pageSize,
   platforms:stats.platforms,kinds:stats.kinds,orderTypes:stats.types,
   inputSchemaSupportedCount:items.filter(s=>boosteroOrderCapability(s).schemaSupported).length,
   blockedUntilFulfillmentValidated:stats.valid-approved.length,
   categories:visibleCategories,items:result,choices,choicesTruncated:ordered.length>choices.length,
   prices:"Only existing approved retail prices are shown; never supplier wholesale.",
   noChargeForUnapproved:true});
 }catch(e){
  const error=["supplier_disabled","supplier_incomplete_catalog"].includes(e.message)?e.message:"catalog_temporarily_unavailable";
  return respond({error,supplier:"boostero",items:[],noSupplierFallback:true},503);
 }
}
