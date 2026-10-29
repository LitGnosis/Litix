/**
 * Full Boostero services inventory. Pure normalization: NO orders, DB writes,
 * gateway calls or public retail enablement. Boostero API v2 services is the
 * only source of supplier identifiers/availability/capabilities.
 */
const PLATFORMS=[
  ["Instagram",/\binstagram\b|\big\b/i],["TikTok",/\btik[ -]?tok\b/i],
  ["YouTube",/\byou[ -]?tube\b|\byt\b/i],["Facebook",/\bfacebook\b|\bfb\b/i],
  ["Spotify",/\bspotify\b/i],["Twitter/X",/\btwitter\b|\btwitter\s*\(x\)|\bx\.com\b/i],
  ["Telegram",/\btelegram\b/i],["LinkedIn",/\blinked[ -]?in\b/i],
  ["Snapchat",/\bsnapchat\b/i],["Discord",/\bdiscord\b/i],
  ["Twitch",/\btwitch\b/i],["Pinterest",/\bpinterest\b/i],
  ["Reddit",/\breddit\b/i],["Apple Music",/\bapple[ -]?music\b/i],
  ["Website Traffic",/\bwebsite\b|\bweb[ -]?traffic\b/i],
  ["Kick",/\bkick\b/i],["Trovo",/\btrovo\b/i],
  ["Rumble",/\brumble\b/i],["Bluesky",/\bbluesky\b/i],
  ["Truth Social",/\btruth[ -]?social\b/i],
  ["CoinMarketCap",/\bcoinmarketcap\b/i],["Clubhouse",/\bclubhouse\b/i],
  ["Shopee",/\bshopee\b/i]
];
const bool=x=>x===true||x===1||String(x).toLowerCase()==="true"||String(x)==="1";
const bounded=(v,n)=>String(v??"").trim().slice(0,n);
function classifyKind(name,type){
 const text=name+" "+type;
 for(const [kind,re] of [
  ["auto_engagement",/\bauto[ -]?(?:likes?|views?|engagement)|\bsubscription|\bmonthly\b/i],
  ["custom_comments",/\bcustom[ -]?comments?\b/i],
  ["comments",/\bcomments?\b|\brepl(?:y|ies)\b/i],
  ["followers",/\bfollowers?\b|\bsubscribers?\b|\bmembers?\b/i],
  ["likes",/\blikes?\b|\bfavorites?\b/i],
  ["views",/\bviews?\b|\bplays?\b|\bwatch[ -]?time\b/i],
  ["shares",/\bshares?\b|\breposts?\b|\bretweets?\b/i],
  ["saves",/\bsaves?\b|\bbookmarks?\b/i],
  ["impressions",/\bimpressions?\b|\breach\b/i],
  ["votes",/\bvotes?\b|\bpolls?\b/i]
 ])if(re.test(text))return kind;
 return "other";
}
export function normalizeBoosteroService(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
 const id=bounded(raw.service??raw.id,16);
 const name=bounded(raw.name,240),category=bounded(raw.category,180),type=bounded(raw.type||"Default",80);
 const wholesale=Number(raw.rate),min=Number(raw.min),max=Number(raw.max);
 if(!/^\d{1,12}$/.test(id)||!name||!Number.isFinite(wholesale)||wholesale<=0||wholesale>1e7||
  !Number.isSafeInteger(min)||min<1||!Number.isSafeInteger(max)||max<min||max>1e9)return null;
 const text=category+" "+name;
 const platform=PLATFORMS.find(([,regex])=>regex.test(text))?.[0]||"Other";
 const kind=classifyKind(name,type);
 const normalizedType=type.toLowerCase().replace(/[\s_-]+/g," ").trim();
 const isDefault=normalizedType==="default";
 const specialType=!isDefault||/\b(auto|subscription|monthly|drip[ -]?feed)\b/i.test(text);
 const refill=bool(raw.refill),cancel=bool(raw.cancel),dripfeed=bool(raw.dripfeed);
 const refillText=text.match(/\b(7|15|30|60|90|120|180|270|365)\s*(?:day|days|d)\b/i);
 const refillDays=refillText?Number(refillText[1]):null;
 // These are service-type candidates, never authorization for public checkout.
 const existingCheckoutShape=isDefault&&!specialType&&["Instagram","TikTok"].includes(platform)&&["followers","likes"].includes(kind);
 return {
  id,name,category,platform,kind,type,wholesalePer1000:wholesale,
  min,max,refill,cancel,dripfeed,refillDays,
  supportedInputShape:existingCheckoutShape,
  requiresImplementation:!existingCheckoutShape,
  // Deliberately omit any unknown source fields, including credentials.
  sourceFlags:{refill,cancel,dripfeed},
 };
}
export function normalizeBoosteroCatalog(raw){
 if(!Array.isArray(raw))throw Error("boostero_service_list_invalid");
 const byId=new Map();let invalid=0;
 for(const row of raw){const service=normalizeBoosteroService(row);if(!service){invalid++;continue;}byId.set(service.id,service);}
 const items=[...byId.values()];
 const byPlatform={},byKind={},byType={};
 for(const item of items){
  byPlatform[item.platform]=(byPlatform[item.platform]||0)+1;
  byKind[item.kind]=(byKind[item.kind]||0)+1;
  byType[item.type]=(byType[item.type]||0)+1;
 }
 return {items,stats:{
   retrieved:raw.length,valid:items.length,invalid,duplicates:Math.max(0,raw.length-invalid-items.length),
   supportedInputShape:items.filter(x=>x.supportedInputShape).length,
   requiringImplementation:items.filter(x=>x.requiresImplementation).length,
   platforms:Object.fromEntries(Object.entries(byPlatform).sort((a,b)=>a[0].localeCompare(b[0]))),
   kinds:Object.fromEntries(Object.entries(byKind).sort((a,b)=>a[0].localeCompare(b[0]))),
   types:Object.fromEntries(Object.entries(byType).sort((a,b)=>a[0].localeCompare(b[0])))
 }};
}
