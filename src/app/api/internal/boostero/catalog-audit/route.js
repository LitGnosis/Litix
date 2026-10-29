import {boosteroReadOnly} from "../../../../../lib/boosteroReadOnly.mjs";
import {normalizeBoosteroCatalog} from "../../../../../lib/boosteroGlobalCatalog.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const respond=(value,status=200)=>Response.json(value,{status,headers:{
 "cache-control":"no-store","x-content-type-options":"nosniff","x-robots-tag":"noindex"
}});
let cached=null,expires=0,inFlight=null;
async function catalog(){
 if(cached&&Date.now()<expires)return cached;
 if(!inFlight)inFlight=boosteroReadOnly("services")
  .then(rows=>{cached=normalizeBoosteroCatalog(rows);expires=Date.now()+5*60*1000;return cached})
  .finally(()=>{inFlight=null});
 return inFlight;
}
const PRIORITY={Instagram:0,TikTok:1};
const KINDS={followers:0,likes:1,views:2,shares:3};
const safePublicPreview=x=>({
 id:"boostero_"+x.id,name:x.name,category:x.category,platform:x.platform,
 kind:x.kind,type:x.type,min:x.min,max:x.max,
 refill:x.refill,cancel:x.cancel,dripfeed:x.dripfeed,
 supportedInputShape:x.supportedInputShape,
 purchasable:false,pricingStatus:"awaiting_verification_and_owner_approval"
});
/**
 * Preview-only supplier catalog reader. Never calls supplier add/refill/cancel.
 * No API keys, private fields or supplier wholesale prices are serialized.
 * Internal preview UI uses view=items, paginated and cached for 5 min.
 */
export async function GET(request){
 if(process.env.VERCEL_ENV!=="preview")return respond({error:"not_found"},404);
 try{
  const {stats,items}=await catalog();
  const params=new URL(request.url).searchParams;
  if(params.get("view")!=="items")
   return respond({supplier:"boostero",readOnly:true,source:"live_api_v2_services",...stats,
    publicEnabledInProduction:"independent_approved_allowlist"});
  const platform=String(params.get("platform")||"").slice(0,90);
  const kind=String(params.get("kind")||"").slice(0,55);
  const q=String(params.get("q")||"").trim().toLowerCase().slice(0,100);
  const page=Math.max(1,Math.min(10000,Number.parseInt(params.get("page")||"1",10)||1));
  const filtered=items.filter(x=>(!platform||x.platform===platform)&&(!kind||x.kind===kind)&&
   (!q||(x.name+" "+x.category+" "+x.id).toLowerCase().includes(q)));
  filtered.sort((a,b)=>(PRIORITY[a.platform]??2)-(PRIORITY[b.platform]??2)||
   a.platform.localeCompare(b.platform)||(KINDS[a.kind]??4)-(KINDS[b.kind]??4)||
   a.name.localeCompare(b.name)||Number(a.id)-Number(b.id));
  return respond({supplier:"boostero",readOnly:true,items:filtered.slice((page-1)*24,page*24).map(safePublicPreview),
   total:filtered.length,page,pageSize:24,availableSourceTotal:stats.valid,
   platforms:stats.platforms,kinds:stats.kinds,
   notice:"Preview only. Services do not become purchasable until checkout, retail price, and supplier requirements are approved."});
 }catch(error){
  const msg=String(error?.message||"").slice(0,100);
  const code=/^boostero_[a-z0-9_]+$/.test(msg)?msg:"catalog_audit_unavailable";
  return respond({error:code,readOnly:true},503);
 }
}
