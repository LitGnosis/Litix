import { priceCatalog, retailPer1000 } from "./pricing.mjs";

export const autolikesBillingAvailable = () => false;
// AutoLikes is draft-only until paid subscription reconciliation and supplier fulfillment are verified.
export const accountDatabaseURL = () => process.env.LITIX_V2_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || "";

export function parseProfileTarget(raw,platform) {
 const p=String(platform||"").toLowerCase();
 if(!["instagram","tiktok"].includes(p))return {ok:false,error:"Select Instagram or TikTok."};
 const v=String(raw||"").trim();
 if(v.length<2||v.length>170)return {ok:false,error:"Enter a valid public profile username."};
 let handle=v.replace(/^@/,"");
 if(/^https?:\/\//i.test(v)){
  try{
   const u=new URL(v);
   const allowed=p==="instagram"?["instagram.com","www.instagram.com"]:["tiktok.com","www.tiktok.com"];
   if(u.protocol!=="https:"||!allowed.includes(u.hostname.toLowerCase())||u.username||u.password||u.search||u.hash)return {ok:false,error:"Use a direct public profile URL."};
   const parts=u.pathname.split("/").filter(Boolean);
   if(parts.length!==1)return {ok:false,error:"Enter a profile, not a post URL."};
   handle=parts[0].replace(/^@/,"");
  }catch{return {ok:false,error:"Enter a valid HTTPS profile URL."}}
 }
 const regex=p==="instagram"?/^(?!.*\.\.)(?!\.)(?!.*\.$)[a-zA-Z0-9._]{1,30}$/:/^[a-zA-Z0-9._]{2,24}$/;
 if(!regex.test(handle))return {ok:false,error:"The username format is not supported."};
 const profileUrl=p==="instagram"?"https://www.instagram.com/"+handle+"/":"https://www.tiktok.com/@"+handle;
 return {ok:true,handle:"@"+handle,profileUrl,platform:p};
}

export function isEligibleLikesService(raw,platform) {
 const text=String(raw?.name||"")+" "+String(raw?.category||"");
 const plat=String(platform||"").toLowerCase();
 if(!["instagram","tiktok"].includes(plat))return false;
 const matchesPlatform=plat==="instagram"?/\binstagram\b|\big\b/i.test(text):/\btik\s*tok\b/i.test(text);
 const likes=/\blikes?\b/i.test(text);
 const nonLikes=/\b(?:followers?|comments?|shares?|reposts?|views?|saves?|subscriptions?)\b/i.test(text);
 return matchesPlatform&&likes&&!nonLikes&&/^(default|regular|standard)$/i.test(String(raw?.type||"Default"))&&
   Number.isFinite(Number(raw.rate))&&Number(raw.rate)>0&&Number(raw.min)>0&&Number(raw.max)>=Number(raw.min);
}

const cache={at:0,items:[]};
export async function fetchLikesServices(platform){
 if(!["instagram","tiktok"].includes(String(platform||"").toLowerCase()))throw Error("Invalid platform");
 const now=Date.now();
 if(cache.items.length&&now-cache.at<180000)return cache.items.filter(x=>isEligibleLikesService(x,platform));
 const key=process.env.SMMGLOB_API_KEY;
 if(!key)throw Error("SMMGLOB services are not configured");
 const u=new URL(process.env.SMMGLOB_API_URL||"https://smmglob.com/api/v2");
 if(u.protocol!=="https:"||!["smmglob.com","www.smmglob.com"].includes(u.hostname))throw Error("Invalid supplier host");
 const response=await fetch(u,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({key,action:"services"}),cache:"no-store",signal:AbortSignal.timeout(9000)});
 if(!response.ok)throw Error("Supplier service listing is unavailable");
 const data=await response.json();
 if(!Array.isArray(data))throw Error("Invalid supplier service response");
 const priced=priceCatalog(data).items.filter(x=>!["33771","33772","33773"].includes(String(x.service)));
 cache.items=priced;cache.at=now;
 return priced.filter(x=>isEligibleLikesService(x,platform));
}
export function presentLikesService(s) {
 const n=Number(retailPer1000(s));
 return {id:String(s.service),name:String(s.name||"Likes service").slice(0,180),min:Number(s.min),max:Number(s.max),per1000:Math.round(n*100)/100,refill:Boolean(s.refill),type:String(s.type||"Default")};
}
export function draftPayload(raw,services) {
 const platform=String(raw?.platform||"").toLowerCase();
 const target=parseProfileTarget(raw?.target,platform);
 if(!target.ok)return {ok:false,error:target.error};
 const service=services.find(s=>String(s.service)===String(raw?.serviceId));
 if(!service||!isEligibleLikesService(service,platform))return {ok:false,error:"Choose an available SMMGLOB Likes service."};
 const quantity=Number(raw?.quantityPerPost);
 const maxPosts=Number(raw?.maxPostsPerMonth);
 if(!Number.isSafeInteger(quantity)||quantity<Number(service.min)||quantity>Number(service.max))return {ok:false,error:"Quantity must match the selected supplier service limits."};
 if(!Number.isSafeInteger(maxPosts)||maxPosts<1||maxPosts>60)return {ok:false,error:"Choose 1–60 posts per month."};
 const per1000=Number(retailPer1000(service));
 if(!Number.isFinite(per1000)||per1000<=0)return {ok:false,error:"This supplier service cannot be priced."};
 const oneTimeEstimateCents=Math.ceil(per1000*100*quantity/1000);
 return {ok:true,platform,target:target.handle,profileUrl:target.profileUrl,quantityPerPost:quantity,maxPostsPerMonth:maxPosts,serviceId:String(service.service),serviceName:String(service.name),oneTimeEstimateCents};
}
