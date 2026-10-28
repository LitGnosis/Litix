// Read-only supplier-backed catalog used for a safely staged migration.
// Supported orders require a separately verified payment+dispatch release.
const PLATFORMS=[
 ["Instagram",/\binstagram\b|\big\b/i,["instagram.com"]],
 ["TikTok",/\btik[\s-]*tok\b/i,["tiktok.com"]],
 ["YouTube",/\byou[\s-]*tube\b|\byoutube\b/i,["youtube.com","youtu.be"]],
 ["Facebook",/\bfacebook\b|\bfb\b/i,["facebook.com","fb.com"]],
 ["X",/\btwitter\b|\bx[\s-]*twitter\b/i,["x.com","twitter.com"]],
 ["Spotify",/\bspotify\b/i,["open.spotify.com"]],
 ["Telegram",/\btelegram\b/i,["t.me"]],
 ["Snapchat",/\bsnapchat\b/i,["snapchat.com"]],
 ["LinkedIn",/\blinkedin\b/i,["linkedin.com"]],
 ["Discord",/\bdiscord\b/i,["discord.gg","discord.com"]],
 ["Pinterest",/\bpinterest\b/i,["pinterest.com","pin.it"]],
 ["Twitch",/\btwitch\b/i,["twitch.tv"]],
 ["Reddit",/\breddit\b/i,["reddit.com"]],
 ["Kick",/\bkick\.?com\b|\bkick\b/i,["kick.com"]],
];
const KINDS=[
 ["Followers",/\bfollowers?\b/i],["Likes",/\blikes?\b/i],
 ["Views",/\bviews?\b/i],["Subscribers",/\bsubscribers?\b/i],
 ["Members",/\bmembers?\b/i],["Reactions",/\breactions?\b/i],
 ["Shares",/\bshares?\b/i],["Reposts",/\breposts?\b/i],
 ["Plays",/\bplays?\b/i]
];
const safeText=(x,n=180)=>String(x||"").replace(/&amp;/g,"&").replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim().slice(0,n);
export const PREMIUM_CATALOG_PRIORITY=["Instagram Followers","Instagram Likes","TikTok Followers","TikTok Likes"];
export function safeBoosteroLink(input,platform,kind){
 let u;try{u=new URL(String(input||"").trim())}catch{return null}
 if(u.protocol!=="https:"||u.username||u.password||u.port||u.hash)return null;
 if(u.search&&!(platform==="YouTube"&&u.hostname.replace(/^www\./,"")==="youtube.com"&&u.pathname==="/watch"&&
    [...u.searchParams.keys()].length===1&&/^[A-Za-z0-9_-]{11}$/.test(u.searchParams.get("v")||"")))return null;
 const known=PLATFORMS.find(p=>p[0]===platform);
 if(!known)return null;
 const host=u.hostname.toLowerCase().replace(/^www\./,"");
 if(!known[2].includes(host))return null;
 const path=u.pathname;
 if(!path||path==="/"||path.length>350||/[\s<>]/.test(path))return null;
 if(platform==="Instagram"){
  if(kind==="Followers")return /^\/[A-Za-z0-9._]{1,30}\/?$/.test(path)&&!/^\/(?:p|reel|stories|explore|api)\b/i.test(path)?"https://www.instagram.com"+(path.endsWith("/")?path:path+"/"):null;
  return /^\/(?:p|reel)\/[A-Za-z0-9_-]{5,32}\/?$/.test(path)?"https://www.instagram.com"+(path.endsWith("/")?path:path+"/"):null;
 }
 if(platform==="TikTok"){
  if(kind==="Followers")return /^\/@[A-Za-z0-9._]{2,24}\/?$/.test(path)?"https://www.tiktok.com"+(path.endsWith("/")?path:path+"/"):null;
  return /^\/@[A-Za-z0-9._]{2,24}\/video\/\d{10,30}\/?$/.test(path)?"https://www.tiktok.com"+path.replace(/\/$/,""):null;
 }
 if(/\/(?:login|settings|admin|account)\b/i.test(path))return null;
 if(platform==="YouTube"&&host==="youtu.be"&&!/^\/[A-Za-z0-9_-]{6,20}$/.test(path))return null;
 return "https://"+u.hostname.toLowerCase()+path+(platform==="YouTube"&&u.search?u.search:"");
}
export function priceAt60Percent(wholesaleRate,quantity){
 const rate=Number(wholesaleRate),qty=Number(quantity);
 if(!Number.isFinite(rate)||rate<=0||!Number.isSafeInteger(qty)||qty<=0)throw Error("supplier_price_or_quantity_invalid");
 const per1000=Number((rate*1.6).toFixed(8));
 const retailCents=Math.ceil(rate*qty/1000*160-1e-9);
 return {per1000,retailCents,minimumCents:500};
}
export function premiumDefaultServices(raw){
 if(!Array.isArray(raw))throw Error("boostero_catalog_invalid");
 const seen=new Set(),out=[];
 for(const item of raw){
  if(String(item?.type||"")!=="Default")continue;
  const id=String(item.service??item.id??"");
  if(!/^\d{1,12}$/.test(id)||seen.has(id))continue;
  const title=safeText(item.name),sourceCategory=safeText(item.category,110);
  const match=PLATFORMS.filter(([_,re])=>re.test(title+" "+sourceCategory));
  if(match.length!==1)continue;
  const platform=match[0][0];
  if(/\b(?:title search|keyword search|ctr search|custom|manual entry|drip[ -]?feed|poll|mentions?|auto likes|subscriptions?|live stream|watch hours)\b/i.test(title))continue;
  const kinds=KINDS.filter(([_,re])=>re.test(title));
  if(kinds.length!==1)continue;
  const kind=kinds[0][0];
  const name=title.replace(/\s*[-—–]?\s*Boostero[’']?s?\s*Top Pick\b/gi,"").trim();
  const min=Number(item.min),max=Math.min(Number(item.max),1000000);
  const step=Number(item.quantity_step??item.step??1),rate=Number(item.rate);
  if(!Number.isSafeInteger(min)||min<1||!Number.isSafeInteger(max)||max<min||
     !Number.isSafeInteger(step)||step<1||!Number.isFinite(rate)||rate<=0||rate>1e6)continue;
  const minimumQty=min+Math.max(0,Math.ceil((Math.ceil(500000/(rate*160))-min)/step))*step;
  if(!Number.isSafeInteger(minimumQty)||minimumQty>max)continue;
  const refillAPI=item.refill===true||item.refill==="1"||item.refillable===true;
  const noRefill=/\b(?:no|non|without)\s*-?\s*refill\b/i.test(name);
  const advertisedRefill=!noRefill&&/\brefill\b/i.test(name);
  const days=[...name.matchAll(/\b(\d{1,3})\s*(?:days?|d)\b/gi)].map(m=>Number(m[1]));
  const refillDays=(refillAPI||advertisedRefill)&&days.length?Math.max(...days):null;
  const price=priceAt60Percent(rate,minimumQty),category=platform+" "+kind;
  seen.add(id);
  out.push({id:"boostero_"+id,name,category,platform,kind,
   type:"Default",min:minimumQty,supplierMin:min,max,unitStep:step,
   per1000:price.per1000,startingAmountCents:price.retailCents,
   refill:refillAPI,refillDays,refillClaim:advertisedRefill,
   noDrop:/\b(?:non|no)[-\s]?drop\b/i.test(name),
   purchasable:false,previewOnly:true});
 }
 const priority=x=>{const index=PREMIUM_CATALOG_PRIORITY.indexOf(x.category);return index<0?4:index};
 return out.sort((a,b)=>priority(a)-priority(b)||a.per1000-b.per1000||a.id.localeCompare(b.id));
}
export function filterPremiumCards(cards,query){
 const p=new URLSearchParams(query),platform=p.get("platform"),cat=p.get("category"),term=(p.get("q")||"").toLowerCase();
 const page=Math.min(10000,Math.max(1,Number(p.get("page")||1)));
 const all=cards.filter(s=>(!platform||platform==="All platforms"||s.platform===platform)&&
  (!cat||s.category===cat)&&(!term||[s.name,s.category,s.id].some(x=>x.toLowerCase().includes(term))));
 return {items:all.slice((page-1)*24,page*24),total:all.length,page,
  categories:[...new Set(cards.map(s=>s.category))].sort((a,b)=>{
   const i=PREMIUM_CATALOG_PRIORITY.indexOf(a),j=PREMIUM_CATALOG_PRIORITY.indexOf(b);
   return (i<0?4:i)-(j<0?4:j)||a.localeCompare(b)}),
  platforms:[...new Set(cards.map(s=>s.platform))].sort((a,b)=>{
   const order=x=>x==="Instagram"?0:x==="TikTok"?1:2;
   return order(a)-order(b)||a.localeCompare(b)})};
}
