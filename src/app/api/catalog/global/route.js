import {boosteroProduction} from "../../../../lib/boosteroReadOnly.mjs";
import {enabledBoosteroCards} from "../../../../lib/boosteroCatalog.mjs";
import {sortServicesPer1000} from "../../../../lib/catalogSort.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
let cached=null,expires=0,flight=null;
const clean=(value,max=150)=>String(value??"").replace(/[\u0000-\u001f]/g," ").trim().slice(0,max);
const platformOf=s=>{
 const t=(s.name+" "+s.category).toLowerCase();
 return /instagram|\big\b/.test(t)?"Instagram":/tik[\s._-]*tok/.test(t)?"TikTok":
 /youtube/.test(t)?"YouTube":/facebook|\bfb\b/.test(t)?"Facebook":/spotify/.test(t)?"Spotify":"Other";
};
const kindOf=s=>{
 const text=(s.name+" "+s.category).toLowerCase();
 return /\bfollowers?\b/.test(text)?"followers":/\blikes?\b/.test(text)?"likes":"other";
};
async function allServices(){
 if(cached&&Date.now()<expires)return cached;
 if(!flight)flight=boosteroProduction("services").then(async raw=>{
  if(!Array.isArray(raw))throw Error("invalid supplier response");
  const approved=await enabledBoosteroCards().catch(()=>[]);
  const byId=new Map(approved.map(item=>[String(item.id),item]));
  const unique=new Map();
  for(const s of raw){
   const id=String(s?.service??"");
   const rate=Number(s?.rate),min=Number(s?.min),max=Number(s?.max);
   if(!/^\d{1,12}$/.test(id)||!Number.isFinite(rate)||rate<=0||
     !Number.isSafeInteger(min)||min<1||!Number.isSafeInteger(max)||max<min||unique.has(id))continue;
   const name=clean(s.name),category=clean(s.category,100);
   const platform=platformOf({name,category}),kind=kindOf({name,category});
   const approvedCard=byId.get("boostero_"+id);
   // Discovery rate is an estimate, never a checkout quote or supplier wholesale disclosure.
   const factor=rate<1?8:rate<20?5:2;
   const previewRate=Math.max(5,Math.ceil(rate*factor*100-1e-8)/100);
   unique.set(id,approvedCard||{
    id:"boostero_"+id,name,category:category||"Other",platform,kind,
    type:clean(s.type,45)||"Unknown",min,max,
    per1000:previewRate,startingAmountCents:null,
    pricingReview:true,purchasable:false,provider:"Boostero",
    purchaseNote:"Manual review required; displayed rate is an estimate, not a purchasable quote"
   });
  }
  const result=sortServicesPer1000([...unique.values()],null,x=>x.per1000);
  cached=result;expires=Date.now()+120000;return result;
 }).finally(()=>{flight=null});
 return flight;
}
export async function GET(request){
 try{
  const p=new URL(request.url).searchParams;
  const query=clean(p.get("q"),100).toLowerCase(),platform=clean(p.get("platform"),40),
   category=clean(p.get("category"),120),kind=clean(p.get("kind"),35);
  const page=Math.max(1,Math.min(10000,Number(p.get("page"))||1));
  const all=await allServices();
  const filtered=all.filter(s=>(!query||[s.id,s.name,s.category].some(t=>String(t).toLowerCase().includes(query)))&&
   (!platform||platform==="All platforms"||platform===s.platform)&&(!category||category===s.category)&&
   (!kind||kind===s.kind));
  const size=24;
  return Response.json({provider:"Boostero",items:filtered.slice((page-1)*size,page*size),
   total:filtered.length,allCount:all.length,page,
   checkoutPath:"/",verifiedPurchasableCount:all.filter(s=>s.purchasable).length,
   message:"Only explicitly approved Boostero services can enter PayKings checkout. Other listings require manual review. Preview prices are estimates, not checkout quotes."},
  {headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
 }catch(error){
  console.error("Litix Boostero discovery unavailable",String(error?.message||error).slice(0,95));
  return Response.json({provider:"Boostero",items:[],total:0,allCount:0,error:"Supplier directory currently unavailable. No payment attempted."},
   {status:503,headers:{"cache-control":"no-store"}});
 }
}