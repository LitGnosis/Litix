// Litix fixed-price bundle routing. Server-side only: no supplier details on public pages.
import {growthBundle,validPost} from "./growthBundles.mjs";
import {boosteroProfile} from "./boosteroFulfillment.mjs";
import {litixPlatform} from "./litixServiceClassify.mjs";

const TYPES=["Likes","Views","Shares"];
const KIND_PATTERN={
 Likes:/\blikes?\b/i,Views:/\bviews?\b/i,Shares:/\bshares?\b/i,
 Followers:/\bfollowers?\b/i
};
const OTHER_KINDS=/\b(?:followers?|likes?|views?|shares?|subscribers?|comments?|saves?|reposts?|retweets?|listeners?|members?|polls?|votes?)\b/gi;
const UNSUPPORTED=/\b(?:story|stories|live|livestream|comments?|custom|auto|automatic|monthly|subscription|bundle|package|refill\s+only|reels?\s+and|poll|spaces?|shorts?|channel|trial|free)\b/i;
export function canonicalBundleTargets(pkg,profile,postUrls){
 if(!pkg||!["Instagram","TikTok"].includes(pkg.platform))throw Error("invalid_bundle");
 const destination=boosteroProfile(profile,pkg.platform.toLowerCase());
 if(!destination)throw Error("invalid_public_profile");
 if(!Array.isArray(postUrls)||postUrls.length<1||postUrls.length>10)throw Error("one_to_ten_posts_required");
 const set=new Set(),urls=[];
 const profileHandle=(pkg.platform==="TikTok"?destination.split("/@")[1]:destination.split("/")[3])?.replace(/\/$/,"").toLowerCase();
 for(const value of postUrls){
  const raw=String(value||"").trim();
  if(!validPost(raw,pkg.platform))throw Error("invalid_public_post_url");
  const u=new URL(raw);u.hash="";u.search="";
  const url="https://www." + u.hostname.replace(/^www\./,"")+u.pathname.replace(/\/$/,"");
  if(pkg.platform==="TikTok"&&u.pathname.split("/")[1].replace(/^@/,"").toLowerCase()!==profileHandle)
   throw Error("post_owner_mismatch");
  if(set.has(url))throw Error("duplicate_post");
  set.add(url);urls.push(url);
 }
 return {profile:destination,posts:urls};
}
export function splitFixedBundle(pkg,profile,postUrls){
 const {profile:target,posts}=canonicalBundleTargets(pkg,profile,postUrls);
 const legs=[];
 for(const kind of TYPES){
  const total=Number(pkg.items[kind]);
  if(!Number.isSafeInteger(total)||total<posts.length)throw Error("invalid_bundle_total");
  const whole=Math.floor(total/posts.length);
  posts.forEach((destination,i)=>{
   const quantity=whole+(i<total%posts.length?1:0);
   if(quantity>0)legs.push({kind,destination,quantity});
  });
 }
 const followers=Number(pkg.items.Followers);
 if(!Number.isSafeInteger(followers)||followers<1)throw Error("invalid_followers_total");
 legs.push({kind:"Followers",destination:target,quantity:followers});
 if(legs.length>31)throw Error("too_many_bundle_legs");
 return legs;
}
export function chooseBundleBoosteroService(services,platform,leg){
 const candidates=[];
 for(const s of Array.isArray(services)?services:[]){
  const title=String(s?.name||"");
  if(!KIND_PATTERN[leg.kind].test(title)||UNSUPPORTED.test(title))continue;
  const kinds=(title.match(OTHER_KINDS)||[]).map(x=>x.toLowerCase());
  if(kinds.length!==1)continue;
  if(litixPlatform(title,s?.category)!==platform)continue;
  if(String(s.type||"Default").toLowerCase()!=="default")continue;
  const id=String(s.service??s.id??"");
  const rate=Number(s.rate),min=Number(s.min),max=Number(s.max);
  if(!/^\d{1,12}$/.test(id)||!Number.isFinite(rate)||rate<=0||
    !Number.isSafeInteger(min)||!Number.isSafeInteger(max)||leg.quantity<min||leg.quantity>max)continue;
  // Prefer standard/regular global services before country-specific or special-quality variants.
  const geographic=/\b(?:usa|american|turkish|french|indian|brazilian|arab|russian|mexican|german|pakistan|canadian|uk|united states)\b/i.test(title)?1:0;
  candidates.push({id,rate,min,max,geographic,title});
 }
 candidates.sort((a,b)=>a.geographic-b.geographic||a.rate-b.rate||b.max-a.max);
 return candidates[0]||null;
}
export function quoteFixedBundle(pkg,profile,posts,services,{balanceUSD,requireWallet=true}={}){
 if(!pkg?.id||growthBundle(pkg.id)?.priceCents!==pkg.priceCents)throw Error("unknown_bundle");
 const legs=splitFixedBundle(pkg,profile,posts);
 const assigned=legs.map((leg,ordinal)=>{
  const option=chooseBundleBoosteroService(services,pkg.platform,leg);
  if(!option)throw Error("supplier_"+leg.kind.toLowerCase()+"_unavailable");
  const wholesaleCents=Math.ceil(option.rate*100*leg.quantity/1000-1e-8);
  if(!Number.isSafeInteger(wholesaleCents)||wholesaleCents<=0)throw Error("invalid_wholesale");
  return {...leg,ordinal:ordinal+1,serviceId:option.id,wholesaleCents};
 });
 const wholesaleCents=assigned.reduce((sum,leg)=>sum+leg.wholesaleCents,0);
 if(wholesaleCents*160>pkg.priceCents*100)throw Error("bundle_cost_exceeds_approved_margin");
 if(requireWallet&&(!Number.isFinite(Number(balanceUSD))||Number(balanceUSD)<wholesaleCents/100))
  throw Error("supplier_wallet_insufficient");
 return {legs:assigned,wholesaleCents,priceCents:pkg.priceCents};
}
export const isBundleAutoEnabled=()=>process.env.VERCEL_ENV==="production"&&
 process.env.LITIX_BUNDLE_AUTO_FULFILL_ENABLED==="true"&&process.env.LITIX_BOOSTERO_ENABLED==="true";
