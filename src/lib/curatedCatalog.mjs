import {boosteroProduction} from "./boosteroReadOnly.mjs";
import {boosteroQuote} from "./boosteroFulfillment.mjs";
import {curatedRetailQuote} from "./curatedVolumePricing.mjs";
import {retiredAutoLikesService} from "./retiredAutolikes.mjs";
import {CORE_KINDS,CORE_PLATFORMS,CORE_QUANTITIES} from "../config/curatedServices.mjs";
import {activeSupplierRow,resolveExactTikTokServices,tiktokSkuForService,tiktokTierLabel,normalizeTikTokSupplierName} from "./tiktokCatalog.mjs";
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
  : tier==="value"
  ? !/\b(?:high quality|premium quality|super real accounts|real accounts|active accounts|active-looking)\b/i.test(qual(row))
  : /\b(?:high quality|premium quality)\b/i.test(qual(row)));
 return eligible.sort((a,b)=>{
  const usa=x=>/\bUSA\b/i.test(String(x.name)+" "+String(x.category))?0:1;
  return usa(a)-usa(b)||Number(a.rate)-Number(b.rate)||Number(a.service)-Number(b.service);
 })[0]||null;
}
function liveTikTokFallback(raw,kind){
 // Match the supplier item's own name: a broad category can contain the
 // wrong engagement type or a product that requires an unsupported input.
 const forbidden=/\b(?:auto(?:matic)?|monthly|growth|packages?|subscriptions?|story|stories|custom|live\s*stream)\b/i;
 const candidates=(Array.isArray(raw)?raw:[]).filter(row=>{
  const name=normalizeTikTokSupplierName(row?.name);
  return activeSupplierRow(row)&&!retiredAutoLikesService(row)&&
   /^\s*(?:NEW\s+)?TikTok\b/i.test(name)&&!forbidden.test(name)&&
   /^\s*(?:NEW\s+)?TikTok\s+(?:Random\s+)?(Followers|Likes|Views|Comments)\b/i.exec(name)?.[1]?.toLowerCase()===kind&&
   litixPlatform(name,"")==="TikTok";
 });
 return candidates.sort((a,b)=>{
  const quality=x=>/\b(?:High Quality|Premium Quality)\b/i.test(String(x.name||""))?0:1;
  return quality(a)-quality(b)||Number(a.rate)-Number(b.rate)||
   Number(a.service)-Number(b.service);
 })[0]||null;
}
export function resolveCuratedSupplier(raw,platform,kind,tier="standard"){
 if(!CORE_PLATFORMS.includes(platform)||!["standard","value","vip"].includes(tier))return null;
 if(!CORE_KINDS.includes(kind)&&!(platform==="TikTok"&&
  ["shares","saves","story_views"].includes(kind)))return null;
 if(platform==="TikTok"){
  const preferred=resolveExactTikTokServices(raw)["tiktok_"+kind]||null;
  const standard=preferred||liveTikTokFallback(raw,kind);
  if(tier==="standard")return standard;
  if(!standard)return null;
  if(tier==="value")return (Array.isArray(raw)?raw:[]).filter(row=>{
   const name=normalizeTikTokSupplierName(row?.name);
   return activeSupplierRow(row)&&!retiredAutoLikesService(row)&&String(row.service)!==String(standard.service)&&
    litixPlatform(name,"")==="TikTok"&&litixKind(name,"")===kind&&
    !/\b(?:auto(?:matic)?|monthly|growth|packages?|subscriptions?|story|stories|custom|live\s*stream|high quality|premium quality|real accounts|active accounts)\b/i.test(name);
  }).sort((a,b)=>Number(a.rate)-Number(b.rate)||Number(a.service)-Number(b.service))[0]||null;
  // VIP must be another currently available Default service, never the
  // same supplier listing shown twice at different prices.
  return (Array.isArray(raw)?raw:[]).filter(row=>activeSupplierRow(row)&&
   !retiredAutoLikesService(row)&&String(row.service)!==String(standard.service)&&
   String(row.name||"").trim().toLowerCase()!==String(standard.name||"").trim().toLowerCase()&&
   litixPlatform(row.name,"")==="TikTok"&&
   litixKind(row.name,"")===kind&&
   !/\b(?:auto(?:matic)?|monthly|growth|packages?|subscriptions?|story|stories|custom|live\s*stream)\b/i.test(String(row.name||""))&&
   /\b(?:Real Accounts|Active Accounts|Super Real Accounts)\b/i.test(String(row.name||"")))
   .sort((a,b)=>Number(a.rate)-Number(b.rate)||Number(a.service)-Number(b.service))[0]||null;
 }
 return chooseInstagram(Array.isArray(raw)?raw:[],kind,tier);
}
export function curatedPublicProduct(raw,platform,kind,tier="standard"){
 const service=resolveCuratedSupplier(raw,platform,kind,tier);
 if(!service)return null;
 const cards=CORE_QUANTITIES.map(quantity=>{
  try{
   const q=curatedRetailQuote(boosteroQuote({service,quantity}));
   return {quantity,totalCents:q.amountCents,available:true,volumeDiscountPercent:q.volumeDiscountPercent};
  }catch{return {quantity,totalCents:null,available:false};}
 });
 if(!cards.some(x=>x.available))return null;
 let minimum;
 try{minimum=boosteroQuote({service,quantity:Number(service.min)}).minimum;}
 catch{
  const first=cards.find(x=>x.available);
  minimum=first?.quantity||Number(service.min);
 }
 const quote=curatedRetailQuote(boosteroQuote({service,quantity:cards.find(x=>x.available).quantity}));
 if(kind==="likes"&&quote.retailPer1000Cents<600)return null;
 const sku=platform.toLowerCase()+"_"+kind;
 return {
  id:"curated_"+sku+"_"+tier,
  sku,platform,kind,tier,name:platform+" "+(kind==="story_views"?"Story Views":kind[0].toUpperCase()+kind.slice(1)),
  label:tier==="vip"?"Active-look listing":tier==="value"?"Standard · Value Rate":platform==="TikTok"
   ?(tiktokSkuForService(service)===sku?tiktokTierLabel(sku):
    /\b(?:Real Accounts|Active Accounts|Super Real Accounts)\b/i.test(String(service.name||""))
     ?"Active-look service":/\b(?:High Quality|Premium Quality)\b/i.test(String(service.name||""))
     ?"High Quality":"Standard service")
   :"High Quality",
  min:minimum,max:Number(service.max),unitStep:1,per1000:quote.retailPer1000Cents/100,
  pricingRule:quote.pricingRule,startingAmountCents:quote.amountCents,
  purchasable:true,quantityCards:cards
 };
}
export async function curatedPublicCatalog(){
 const raw=await curatedSupplierSnapshot(),products=[];
 for(const platform of CORE_PLATFORMS)
  for(const kind of CORE_KINDS)
   for(const tier of ["standard","value","vip"]){
    const product=curatedPublicProduct(raw,platform,kind,tier);
    if(product)products.push(product);
   }
 for(const kind of ["shares","saves"]){
  const product=curatedPublicProduct(raw,"TikTok",kind,"standard");
  if(product)products.push(product);
 }
 return {products,extras:{
  customCommentsEnabled:false,autoLikesEnabled:false,autoViewsEnabled:false,
  recurringEnabled:false
 }};
}

export const parseCuratedId=id=>{
 const match=/^curated_(instagram|tiktok)_(followers|likes|views|comments|shares|saves|story_views)_(standard|value|vip)$/.exec(String(id||""));
 if(!match)return null;
 if(match[1]==="instagram"&&!["followers","likes","views","comments"].includes(match[2]))return null;
 return {platform:match[1]==="instagram"?"Instagram":"TikTok",kind:match[2],tier:match[3]};
};
