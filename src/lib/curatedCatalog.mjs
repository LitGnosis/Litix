import {boosteroProduction} from "./boosteroReadOnly.mjs";
import {boosteroQuote} from "./boosteroFulfillment.mjs";
import {retiredAutoLikesService} from "./retiredAutolikes.mjs";
import {CORE_KINDS,CORE_PLATFORMS,CORE_QUANTITIES} from "../config/curatedServices.mjs";
import {activeSupplierRow,resolveExactTikTokServices,tiktokTierLabel} from "./tiktokCatalog.mjs";
import {litixPlatform,litixKind} from "./litixServiceClassify.mjs";

let cached=null,expiry=0,pending=null;
export async function curatedSupplierSnapshot({operation=boosteroProduction}={}){
 if(operation===boosteroProduction&&cached&&Date.now()<expiry)return cached;
 if(operation===boosteroProduction&&pending)return pending;
 const load=async()=>{
  const rows=await operation("services");
  if(!Array.isArray(rows)||!rows.length)throw Error("supplier_catalog_unavailable");
  if(operation===boosteroProduction){cached=rows;expiry=Date.now()+60000;}
  return rows;
 };
 if(operation!==boosteroProduction)return load();
 pending=load().finally(()=>{pending=null});
 return pending;
}
function chooseInstagram(raw,kind,tier){
 const available=raw.filter(row=>activeSupplierRow(row)&&!retiredAutoLikesService(row)&&
  litixPlatform(row.name,row.category)==="Instagram"&&litixKind(row.name,row.category)===kind);
 if(!available.length)return null;
 const qual=row=>String(row.name||"");
 const eligible=available.filter(row=>tier==="vip"
  ? /\b(?:super real accounts|real accounts|active-looking|active accounts)\b/i.test(qual(row))
  : /\b(?:high quality|premium quality)\b/i.test(qual(row))||
   !/\b(?:super real accounts|real accounts|active-looking|active accounts)\b/i.test(qual(row)));
 return eligible.sort((a,b)=>{
  const usa=x=>/\bUSA\b/i.test(String(x.name)+" "+String(x.category))?0:1;
  return usa(a)-usa(b)||Number(a.rate)-Number(b.rate)||Number(a.service)-Number(b.service);
 })[0]||null;
}
export function resolveCuratedSupplier(raw,platform,kind,tier="standard"){
 if(!CORE_PLATFORMS.includes(platform)||!["standard","vip"].includes(tier))return null;
 if(!CORE_KINDS.includes(kind)&&!(platform==="TikTok"&&
  ["shares","saves","story_views"].includes(kind)))return null;
 if(platform==="TikTok"){
  if(tier==="vip")return null;
  return resolveExactTikTokServices(raw)["tiktok_"+kind]||null;
 }
 return chooseInstagram(Array.isArray(raw)?raw:[],kind,tier);
}
export function curatedPublicProduct(raw,platform,kind,tier="standard"){
 const service=resolveCuratedSupplier(raw,platform,kind,tier);
 if(!service)return null;
 const cards=CORE_QUANTITIES.map(quantity=>{
  try{
   const q=boosteroQuote({service,quantity});
   return {quantity,totalCents:q.amountCents,available:true};
  }catch{return {quantity,totalCents:null,available:false};}
 });
 if(!cards.some(x=>x.available))return null;
 let minimum;
 try{minimum=boosteroQuote({service,quantity:Number(service.min)}).minimum;}
 catch{
  const first=cards.find(x=>x.available);
  minimum=first?.quantity||Number(service.min);
 }
 const quote=boosteroQuote({service,quantity:cards.find(x=>x.available).quantity});
 const sku=platform.toLowerCase()+"_"+kind;
 return {
  sku,platform,kind,tier,name:kind==="story_views"?"Story Views":kind[0].toUpperCase()+kind.slice(1),
  label:platform==="TikTok"?tiktokTierLabel(sku):tier==="vip"?"Real-Look / Active listing":"High Quality",
  min:minimum,max:Number(service.max),step:1,per1000:quote.retailPer1000Cents/100,
  quantityCards:cards
 };
}
export async function curatedPublicCatalog(){
 const raw=await curatedSupplierSnapshot(),products=[];
 for(const platform of CORE_PLATFORMS)
  for(const kind of CORE_KINDS)
   for(const tier of ["standard","vip"]){
    const product=curatedPublicProduct(raw,platform,kind,tier);
    if(product)products.push(product);
   }
 for(const kind of ["shares","saves","story_views"]){
  const product=curatedPublicProduct(raw,"TikTok",kind,"standard");
  if(product)products.push(product);
 }
 return {products,extras:{
  customCommentsEnabled:false,autoLikesEnabled:false,autoViewsEnabled:false,
  recurringEnabled:false
 }};
}
