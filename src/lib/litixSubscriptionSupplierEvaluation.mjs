// Candidate reseller API evaluation ONLY. Not part of public checkout.
 // New AutoLikes payments remain disabled in litixAutoLikesSalesGate.mjs.
 // Supplier's documentation is NOT proof that an eligible service is currently active.
export const RESELLER_CANDIDATES=Object.freeze({
 zorasmm: Object.freeze({id:"zorasmm",url:"https://zorasmm.com/api/v2",keyEnv:"LITIX_ZORASMM_API_KEY"}),
 joysmm: Object.freeze({id:"joysmm",url:"https://joysmm.net/api/v2",keyEnv:"LITIX_JOYSMM_API_KEY"}),
 zosmm: Object.freeze({id:"zosmm",url:"https://zosmm.com/api/v2",keyEnv:"LITIX_ZOSMM_API_KEY"})
});
const trim=s=>typeof s==="string"?s.trim():"";
const positive=n=>Number.isFinite(n)&&n>0;
const platformFor=s=>{
 const text=(trim(s.name)+" "+trim(s.category)).toLowerCase();
 if(/\binstagram\b|\binsta\b/.test(text))return "instagram";
 if(/\btiktok\b|\btik tok\b/.test(text))return "tiktok";
 return null;
};
export function eligibleFuturePostLikes(services){
 if(!Array.isArray(services))throw Error("Supplier did not return a service list.");
 return services.filter(row=>{
  if(!row||typeof row!=="object")return false;
  if(!/^subscriptions?$/i.test(trim(row.type)))return false;
  if(!platformFor(row)||!/\blikes?\b/i.test(trim(row.name)+" "+trim(row.category)))return false;
  const id=Number(row.service),rate=Number(row.rate),min=Number(row.min),max=Number(row.max);
  return Number.isSafeInteger(id)&&id>0&&positive(rate)&&Number.isSafeInteger(min)&&min>0&&Number.isSafeInteger(max)&&max>=min;
 }).map(row=>Object.freeze({
  id:Number(row.service),platform:platformFor(row),name:trim(row.name),
  category:trim(row.category),type:"Subscriptions",ratePer1000:Number(row.rate),
  min:Number(row.min),max:Number(row.max)
 }));
}
export function buildFuturePostSubscription({service,username,likesPerPost,postCount,days=30,delayMinutes=0,now=new Date()}){
 // This function only BUILDS a request. It must never send it to a supplier by itself.
 if(!service||service.type!=="Subscriptions"||!["instagram","tiktok"].includes(service.platform))throw Error("An active, verified Subscription Likes service is required.");
 const user=trim(username).replace(/^@/,"");
 if(!/^[A-Za-z0-9._]{2,30}$/.test(user))throw Error("Invalid public profile username.");
 if(!Number.isSafeInteger(likesPerPost)||likesPerPost<service.min||likesPerPost>service.max)throw Error("Likes per post outside supplier limits.");
 if(!Number.isSafeInteger(postCount)||postCount<1||postCount>10)throw Error("Post count out of bounds.");
 if(days!==30)throw Error("Only the agreed 30-day plan is supported.");
 if(![0,5,10,15,20,30,40,50,60,90,120].includes(delayMinutes))throw Error("Invalid supplier delay.");
 const expiry=new Date(now.getTime()+days*86400000);
 if(!Number.isFinite(expiry.getTime()))throw Error("Invalid start date.");
 const dd=String(expiry.getUTCDate()).padStart(2,"0"),mm=String(expiry.getUTCMonth()+1).padStart(2,"0");
 return Object.freeze({action:"add",service:service.id,username:user,
  min:likesPerPost,max:likesPerPost,posts:postCount,old_posts:0,
  delay:delayMinutes,expiry:dd+"/"+mm+"/"+expiry.getUTCFullYear()});
}
export function createReadOnlySubscriptionSupplierClient({provider,key,fetcher=fetch}){
 const meta=RESELLER_CANDIDATES[provider];
 if(!meta)throw Error("Unknown provider.");
 if(!key||typeof key!=="string"||key.length<8)throw Error("Missing private supplier API key.");
 const api=async values=>{
  if(values.action!=="services"&&values.action!=="status")throw Error("Candidate API client is read-only until authorization.");
  const form=new URLSearchParams({key,...values});
  const res=await fetcher(meta.url,{method:"POST",body:form,
   headers:{"content-type":"application/x-www-form-urlencoded"},signal:AbortSignal.timeout(12000),cache:"no-store",redirect:"error"});
  if(!res.ok)throw Error("Supplier API returned status "+res.status);
  const json=await res.json();
  if(json?.error)throw Error("Supplier returned an API error.");
  return json;
 };
 return Object.freeze({
  async listEligibleServices(){return eligibleFuturePostLikes(await api({action:"services"}));},
  async getStatus(orderId){
   if(!/^\d{1,15}$/.test(String(orderId)))throw Error("Invalid supplier order ID.");
   const result=await api({action:"status",order:String(orderId)});
   return {status:trim(result?.status),remains:result?.remains??null,charge:result?.charge??null};
  }
 });
}
