import {boosteroProduction} from "../../../../lib/boosteroReadOnly.mjs";
import {enabledBoosteroCards} from "../../../../lib/boosteroCatalog.mjs";
import {sortServicesPer1000,matchesServiceQuickKind} from "../../../../lib/catalogSort.mjs";
import {litixRetailPer1000Cents} from "../../../../lib/litixRetail60.mjs";
import {litixPublicCard} from "../../../../lib/publicLitixCatalog.mjs";
import {publicServiceCardName} from "../../../../lib/serviceCardDisplay.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const PLATFORMS=[
 "Instagram","TikTok","YouTube","Facebook","Twitter (X)","Spotify","Telegram",
 "LinkedIn","Discord","Snapchat","Pinterest","Website Traffic","Twitch",
 "Clubhouse","Kick","CoinMarketCap","Apple Music","Shopee","Rumble","Reddit",
 "Bluesky","Truth Social","Quora","Tumblr","Medium","GitHub"
];
const PLATFORM_PATTERNS=[
 /instagram|\big\b/i,/tik[\s._-]*tok/i,/youtube|\byt\b/i,/facebook|\bfb\b/i,
 /twitter|\bx\s*(?:followers|likes|repost|views)\b/i,/spotify/i,/telegram/i,
 /linkedin/i,/discord/i,/snapchat/i,/pinterest/i,/website\s*traffic|web\s*visits?/i,
 /twitch/i,/clubhouse/i,/\bkick\b/i,/coinmarketcap/i,/apple\s*music/i,
 /shopee/i,/rumble/i,/reddit/i,/bluesky/i,/truth\s*social/i,/quora/i,
 /tumblr/i,/\bmedium\b/i,/github/i
];
const clean=(value,max=180)=>String(value??"").replace(/[\u0000-\u001f]/g," ").trim().slice(0,max);
const platformOf=service=>{
 const label=[service?.category,service?.name].map(v=>String(v||"")).join(" ");
 const index=PLATFORM_PATTERNS.findIndex(r=>r.test(label));
 return index<0?"Other":PLATFORMS[index];
};
const kindOf=s=>{
 const label=[s.name,s.category].map(v=>String(v??"")).join(" ").toLowerCase();
 if(platformOf(s)==="Twitter (X)"&&/\\b(?:retweets?|reposts?)\\b/.test(String(s.name||"").toLowerCase()))return "retweets";
 for(const [type,regex] of [
 ["followers",/\bfollowers?\b/],["likes",/\blikes?\b/],
 ["views",/\bviews?\b/],["comments",/\bcomments?\b/],
 ["subscribers",/\bsubscribers?\b/],["shares",/\bshares?\b/],
 ["members",/\bmembers?\b/],["plays",/\bplays?\b/],
 ["traffic",/\btraffic\b|\bvisits?\b/]
 ]){if(regex.test(label))return type}
 return "other";
};
let memo=null,expireAt=0,inFlight=null;
async function directory(){
 if(memo&&Date.now()<expireAt)return memo;
 if(!inFlight)inFlight=(async()=>{
  const provider=await boosteroProduction("services");
  if(!Array.isArray(provider))throw Error("catalog_unavailable");
  // This allowlist is intentionally independent of the complete public directory.
  // No new service gains payment or supplier-dispatch permission from being listed.
  const approved=await enabledBoosteroCards().catch(()=>[]);
  const allowed=new Map(approved.map(x=>[x.id,x]));
  const unique=new Map();
  for(const raw of provider){
   const supplierId=String(raw?.service??raw?.id??"");
   if(!/^\d{1,12}$/.test(supplierId)||unique.has(supplierId))continue;
   const name=clean(raw?.name),category=clean(raw?.category,120);
   if(!name)continue;
   const platform=platformOf({name,category}),kind=kindOf({name,category});
   const min=Number(raw?.min),max=Number(raw?.max),rate=Number(raw?.rate);
   const validRange=Number.isSafeInteger(min)&&min>=1&&Number.isSafeInteger(max)&&max>=min;
   const validRate=Number.isFinite(rate)&&rate>0;
   const id="boostero_"+supplierId;
   const purchasable=allowed.get(id);
   // 60% retail markup for discovery; actual payment still requires a live quote.
   // supplier terms and the $1 order floor must be checked before checkout.
   const indicative=validRate?litixRetailPer1000Cents(rate,raw)/100:null;
   unique.set(supplierId,purchasable?{
    ...purchasable,platform,kind,category:purchasable.category||category,
    supplierCategory:category,provider:"Litix",quoteStatus:"approved"
   }:{
    id,name,category:category||"Other",supplierCategory:category,
    platform,kind,type:clean(raw?.type,45)||"Standard",min:validRange?min:null,
    max:validRange?max:null,per1000:indicative,
    startingAmountCents:null,purchasable:false,pricingReview:true,
    provider:"Litix",quoteStatus:validRange&&validRate?"manual":"unavailable"
   });
  }
  const items=sortServicesPer1000([...unique.values()].filter(s=>s.purchasable===true),null,x=>x.per1000==null?Number.POSITIVE_INFINITY:Number(x.per1000));
  const counts={};const categories={};
  for(const s of items){
   counts[s.platform]=(counts[s.platform]||0)+1;
   {const label=publicServiceCardName({name:s.category});categories[label]=(categories[label]||0)+1;}
  }
  const platformOptions=Object.entries(counts).sort((a,b)=>{
   const ai=PLATFORMS.indexOf(a[0]),bi=PLATFORMS.indexOf(b[0]);
   return (ai<0?999:ai)-(bi<0?999:bi);
  }).map(([name,count])=>({name,count}));
  const categoryOptions=Object.entries(categories).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([name,count])=>({name,count}));
  memo={items,platformOptions,categoryOptions,liveCount:items.length,approvedCount:items.filter(s=>s.purchasable).length};
  expireAt=Date.now()+120000;
  return memo;
 })().finally(()=>{inFlight=null});
 return inFlight;
}
export async function GET(request){
 try{
  const p=new URL(request.url).searchParams;
  const q=clean(p.get("q"),120).toLowerCase().replace(/^litix_(\d+)$/,"boostero_$1"),platform=clean(p.get("platform"),80),
   category=clean(p.get("category"),120),kind=clean(p.get("kind"),45),
   onlyReady=p.get("ready")==="true";
  const numericPage=Number(p.get("page"));
  const page=Number.isSafeInteger(numericPage)&&numericPage>0?Math.min(numericPage,10000):1;
  const data=await directory();
  const filtered=data.items.filter(s=>(!q||[s.id,s.name,s.category,s.platform].some(x=>String(x||"").toLowerCase().includes(q)))&&
   (!platform||platform==="All platforms"||platform===s.platform)&&(!category||publicServiceCardName({name:s.category})===category)&&
   (!kind||(s.kind===kind&&matchesServiceQuickKind(s,kind)))&&(!onlyReady||s.purchasable===true));
  const pageSize=24;
  return Response.json({
   brand:"Litix",items:filtered.slice((page-1)*pageSize,page*pageSize).map(litixPublicCard).filter(Boolean),
   total:filtered.length,allCount:data.liveCount,page,pageSize,
   platforms:data.platformOptions,categories:data.categoryOptions,
   verifiedPurchasableCount:data.approvedCount,checkoutPath:"/#checkout",currency:"USD",
   notice:"Browse Litix services and review the final price before secure checkout."
  },{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
 }catch(err){
  console.error("Litix supplier directory error",String(err?.message||"unknown").slice(0,85));
  return Response.json({brand:"Litix",items:[],total:0,allCount:0,
   platforms:[],categories:[],error:"Litix catalog temporarily unavailable. No charge attempted."},
   {status:503,headers:{"cache-control":"no-store"}});
 }
}