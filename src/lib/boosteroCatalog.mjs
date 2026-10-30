import {boosteroProduction} from "./boosteroReadOnly.mjs";
import {boosteroProductionReady} from "./boosteroFulfillment.mjs";
import {litixRetailPer1000Cents,litixOrderCents,litixPurchasableDefault} from "./litixRetail60.mjs";
let cache=null,expires=0,flight=null;
export function litixPlatform(name,category){
 const label=(String(name||"")+" "+String(category||"")).toLowerCase();
 const patterns=[
 ["Instagram",/instagram|\big\b/],["TikTok",/tik[\s._-]*tok/],["YouTube",/youtube|\byt\b/],
 ["Facebook",/facebook|\bfb\b/],["Twitter (X)",/twitter|\bx\s*(followers|likes|retweets|views)/],
 ["Spotify",/spotify/],["Telegram",/telegram/],["LinkedIn",/linkedin/],
 ["Discord",/discord/],["Snapchat",/snapchat/],["Pinterest",/pinterest/],
 ["Website Traffic",/website|traffic/],["Twitch",/twitch/],["Kick",/\bkick\b/],
 ["Reddit",/reddit/],["Apple Music",/apple\s*music/]
 ];
 return patterns.find(([,regex])=>regex.test(label))?.[0]||"Other";
}
export function litixKind(name,category){
 const label=(String(name||"")+" "+String(category||"")).toLowerCase();
 for(const type of ["followers","likes","views","comments","subscribers","shares","members","plays","traffic"]){
  const re=new RegExp("\\b"+type.replace(/s$/,"")+"s?\\b");
  if(re.test(label))return type;
 }
 return "other";
}
export async function allBoosteroCards(){
 if(!boosteroProductionReady())return [];
 if(cache&&Date.now()<expires)return cache;
 if(!flight)flight=boosteroProduction("services").then(items=>{
  const unique=new Map();
  for(const item of items){
   const supplierId=String(item?.service??"");
   if(!/^\d{1,12}$/.test(supplierId)||unique.has(supplierId))continue;
   const retailCents=litixRetailPer1000Cents(item.rate);
   const minimum=litixPurchasableDefault(item);
   if(!minimum||!retailCents)continue;
   const platform=litixPlatform(item.name,item.category),kind=litixKind(item.name,item.category);
   const name=String(item.name||"").slice(0,200);
   const category=String(item.category||"Other").slice(0,140);
   unique.set(supplierId,{
    id:"boostero_"+supplierId,name,category,platform,kind,type:"Default",
    min:minimum,supplierMin:Number(item.min),max:Number(item.max),unitStep:1,
    per1000:retailCents/100,startingAmountCents:litixOrderCents(retailCents,minimum),
    pricingReview:false,purchasable:true,
    refill:item.refill===true||String(item.refill)==="1",noDrop:false,
    pricingPolicy:"Boostero live cost + 60% markup",supplier:"Boostero"
   });
  }
  const rows=[...unique.values()];
  cache=rows;expires=Date.now()+90000;
  return rows;
 }).finally(()=>{flight=null});
 return flight;
}
export const enabledBoosteroCards=allBoosteroCards;
export function filterBoosteroCards(items,params){
 const q=String(params.get("q")||"").toLowerCase(),kind=String(params.get("kind")||"").toLowerCase(),
  cat=String(params.get("category")||""),platform=String(params.get("platform")||"");
 return items.filter(s=>(!q||[s.id,s.name,s.category,s.platform].some(x=>String(x).toLowerCase().includes(q)))&&
  (!cat||cat===s.category)&&(!platform||platform==="All platforms"||platform===s.platform)&&
  (!kind||kind===s.kind));
}
