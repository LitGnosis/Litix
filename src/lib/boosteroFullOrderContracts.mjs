/**
 * Exact Boostero v2 order-type contracts for validation and capability gating.
 * Pure validation only. It never authorizes card capture, supplier dispatch,
 * service enablement or assumptions about package/subscription pricing.
 */
const KNOWN_TYPES = Object.freeze([
 "Default","Package","Custom Comments","Mentions Custom List",
 "Mentions Hashtag","Mentions User Followers","Subscriptions",
 "Comment Likes","Poll"
]);
const delayValues = new Set([0,5,10,15,20,30,40,50,60,90,120,150,180,210,240,270,300,360,420,480,540,600]);
const hosts = Object.freeze({
 Instagram:["instagram.com"],TikTok:["tiktok.com"],YouTube:["youtube.com","youtu.be"],
 Facebook:["facebook.com","fb.watch"],"Twitter/X":["x.com","twitter.com"],
 Spotify:["open.spotify.com"],Telegram:["t.me","telegram.me"],
 LinkedIn:["linkedin.com"],Discord:["discord.com","discord.gg"],
 Snapchat:["snapchat.com"],Pinterest:["pinterest.com","pin.it"],
 Twitch:["twitch.tv"],Reddit:["reddit.com"],"Website Traffic":[],
 "Apple Music":["music.apple.com"],Kick:["kick.com"],Rumble:["rumble.com"],
 Bluesky:["bsky.app"],"Truth Social":["truthsocial.com"],Clubhouse:["clubhouse.com"],
 Shopee:["shopee.com"],Trovo:["trovo.live"],CoinMarketCap:["coinmarketcap.com"]
});
const int=(v,min,max)=>Number.isSafeInteger(Number(v))&&Number(v)>=min&&Number(v)<=max?Number(v):null;
const fail=(code)=>({valid:false,error:code,chargeAllowed:false,supplierDispatchAllowed:false});
export function supportedBoosteroType(type){
 const value=String(type||"").trim().toLowerCase().replace(/[ _-]+/g," ");
 return KNOWN_TYPES.find(x=>x.toLowerCase()===value)||null;
}
function publicLink(input,platform){
 if(typeof input!=="string"||input.length>500)return null;
 let u;try{u=new URL(input.trim())}catch{return null}
 if(u.protocol!=="https:"||u.username||u.password||u.port||u.hash)return null;
 const host=u.hostname.toLowerCase().replace(/^www\./,"");
 if(!host||host==="localhost"||host.endsWith(".local")||
  /^(?:127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host))return null;
 const allow=hosts[platform];
 if(!allow)return null;
 if(platform==="Website Traffic"){
  if(!host.includes(".")||/^[0-9.]+$/.test(host)||host.endsWith(".internal")||host.endsWith(".test"))return null;
  return u.href.slice(0,500);
 }
 if(!allow.some(x=>host===x||host.endsWith("."+x)))return null;
 if(u.pathname.length<2)return null;
 if(u.search&&platform!=="YouTube"&&platform!=="Facebook"&&platform!=="Spotify")return null;
 return u.href.slice(0,500);
}
export function boosteroOrderCapability(service){
 const type=supportedBoosteroType(service?.type);
 const platform=String(service?.platform||"");
 const knownHost=Array.isArray(hosts[platform])&&(hosts[platform].length>0||platform==="Website Traffic");
 const reason=!type?"unknown_supplier_order_type":!knownHost?"unverified_platform_destination":
  type==="Subscriptions"?"requires_recurring_billing_and_supplier_lifecycle":
  type==="Package"?"package_fixed_price_quote_not_verified":
  type==="Custom Comments"?"comment_count_pricing_and_refund_review":
  type!=="Default"?"special_type_requires_dispatch_adapter":"default_type_eligible_for_validation";
 return {type,platform,recognized:!!type,destinationValidationAvailable:knownHost,
   schemaSupported:!!type&&knownHost,providerOrderDraftAvailable:!!type&&knownHost,
   purchasable:false,requiresOwnerPricingApproval:true,
   status:reason};
}
/**
 * Build a bounded supplier-parameter *draft*. Supplier IDs always come from
 * the freshly authenticated catalog; never trust a client-supplied service.
 * This object is not sent to Boostero by this module.
 */
export function validateBoosteroOrderDraft(service,input={}){
 const cap=boosteroOrderCapability(service);
 if(!cap.schemaSupported)return fail(cap.status);
 const id=String(service?.id??service?.service??"");
 if(!/^\d{1,12}$/.test(id))return fail("invalid_supplier_service");
 const type=cap.type,params={service:id},platform=cap.platform;
 if(type==="Subscriptions"){
  const username=String(input.username||"").trim().replace(/^@/,"");
  if(!/^[A-Za-z0-9._]{2,40}$/.test(username))return fail("invalid_subscription_username");
  const min=int(input.min,1,1000000),max=int(input.max,1,1000000);
  if(min===null||max===null||max<min||min<Number(service.min)||max>Number(service.max))
   return fail("subscription_quantity_out_of_range");
  const delay=int(input.delay,0,600);
  if(!delayValues.has(delay))return fail("unsupported_subscription_delay");
  const posts=input.posts===undefined||input.posts===""?null:int(input.posts,1,10000);
  const old=input.old_posts===undefined||input.old_posts===""?null:int(input.old_posts,0,10000);
  if((input.posts!==undefined&&input.posts!==""&&posts===null)||(input.old_posts!==undefined&&input.old_posts!==""&&old===null))return fail("invalid_subscription_posts");
  // Ongoing, unbounded subscriptions are not safely prepayable.
  if(posts===null)return fail("subscription_post_limit_required");
  Object.assign(params,{username,min,max,posts,delay});
  if(old!==null)params.old_posts=old;
  if(input.expiry){
   const date=String(input.expiry);
   if(!/^\d{2}\/\d{2}\/20\d{2}$/.test(date))return fail("invalid_expiry");
   const [day,month,year]=date.split("/").map(Number);
   const epoch=Date.UTC(year,month-1,day);
   if(!Number.isFinite(epoch)||new Date(epoch).toISOString().slice(0,10)!==
     [year,String(month).padStart(2,"0"),String(day).padStart(2,"0")].join("-")||
     epoch<=Date.now())return fail("invalid_expiry");
   params.expiry=date;
  }
  return {valid:true,type,params,estimatedTotalQuantity:null,variableFutureCharge:true,
   chargeAllowed:false,supplierDispatchAllowed:false,reason:"subscription_billing_not_implemented"};
 }
 const link=publicLink(input.link,platform);
 if(!link)return fail("invalid_platform_target");
 params.link=link;
 if(type==="Package"){
  return {valid:true,type,params,estimatedTotalQuantity:null,variableFutureCharge:false,
   chargeAllowed:false,supplierDispatchAllowed:false,reason:"package_price_not_verified"};
 }
 if(type==="Custom Comments"){
  const comments=String(input.comments||"").split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
  if(!comments.length||comments.length>500||comments.some(x=>x.length>500)||
     comments.length<Number(service.min)||comments.length>Number(service.max))return fail("invalid_custom_comments");
  params.comments=comments.join("\n");
  return {valid:true,type,params,estimatedTotalQuantity:comments.length,
   variableFutureCharge:false,chargeAllowed:false,supplierDispatchAllowed:false,
   reason:"custom_comment_dispatch_not_verified"};
 }
 const quantity=int(input.quantity,Number(service.min),Math.min(Number(service.max),1000000));
 if(quantity===null)return fail("quantity_out_of_supplier_range");
 if(type==="Default"){
  params.quantity=quantity;
  if(input.runs!==undefined||input.interval!==undefined){
   if(service.dripfeed!==true)return fail("dripfeed_not_supported_by_supplier");
   const runs=int(input.runs,2,100),interval=int(input.interval,1,10080);
   if(runs===null||interval===null||quantity*runs>100000000)return fail("invalid_dripfeed");
   params.runs=runs;params.interval=interval;
  }
 }else if(type==="Mentions Custom List"){
  const list=String(input.usernames||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(!list.length||list.length>quantity||list.some(x=>!/^@?[A-Za-z0-9._]{2,40}$/.test(x)))return fail("invalid_usernames");
  params.usernames=list.join("\n");params.quantity=quantity;
 }else if(type==="Mentions Hashtag"){
  if(!/^#[A-Za-z0-9_]{2,60}$/.test(String(input.hashtag||"")))return fail("invalid_hashtag");
  params.hashtag=String(input.hashtag);params.quantity=quantity;
 }else if(type==="Mentions User Followers"){
  // Boostero documents this field as the URL to scrape followers from.
  const username=publicLink(String(input.username||""),platform);
  if(!username)return fail("invalid_follower_source_url");
  params.username=username;params.quantity=quantity;
 }else if(type==="Comment Likes"){
  if(!/^@?[A-Za-z0-9._]{2,40}$/.test(String(input.username||"")))return fail("invalid_comment_owner");
  params.username=String(input.username).replace(/^@/,"");params.quantity=quantity;
 }else if(type==="Poll"){
  const answer=int(input.answer_number,1,100);
  if(answer===null)return fail("invalid_poll_answer");
  params.answer_number=answer;params.quantity=quantity;
 }else return fail("unknown_supplier_order_type");
 const total=quantity*(params.runs||1);
 return {valid:true,type,params,estimatedTotalQuantity:total,variableFutureCharge:false,
  chargeAllowed:false,supplierDispatchAllowed:false,reason:"supplier_compatibility_and_pricing_not_verified"};
}
