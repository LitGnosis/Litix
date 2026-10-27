import {calculateOrderCents,minimumRetailCentsForWholesale,retailPer1000} from "./pricing.mjs";
export const MAX_POSTS=8;
export function instagramUsername(input){
 const raw=String(input||"").trim();
 let name=raw.replace(/^@/,"");
 if(/^https?:\/\//i.test(raw)){
  try{const u=new URL(raw);if(u.protocol!=="https:"||!["www.instagram.com","instagram.com"].includes(u.hostname)||u.search||u.hash)return null;name=u.pathname.replace(/^\/|\/$/g,"");}
  catch{return null;}
 }
 return /^[A-Za-z0-9._]{1,30}$/.test(name)&&!["p","reel","tv","stories","explore"].includes(name.toLowerCase())?name:null;
}
export function canonicalPostURL(input){
 try{
  const u=new URL(String(input||"").trim());
  if(u.protocol!=="https:"||!["instagram.com","www.instagram.com"].includes(u.hostname)||u.username||u.password||u.port)return null;
  const m=u.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]{5,40})\/?$/);
  return m?"https://www.instagram.com/"+m[1]+"/"+m[2]+"/":null;
 }catch{return null;}
}
export function normalizePosts(values){
 if(!Array.isArray(values)||!values.length||values.length>MAX_POSTS)throw Error("Choose between 1 and "+MAX_POSTS+" Instagram posts.");
 const urls=values.map(x=>canonicalPostURL(x));
 if(urls.some(x=>!x))throw Error("Use direct public Instagram post or reel URLs.");
 if(new Set(urls).size!==urls.length)throw Error("Remove duplicate posts before checkout.");
 return urls;
}
export function isInstagramLikes(service){
 const name=String(service?.name||""),category=String(service?.category||"");
 const label=name+" "+category;
 return /instagram|\big\b|🇺🇸\s*ig/i.test(label)&&/\blikes?\b/i.test(label)&&!/followers?|comments?|shares?|views?|stories?|auto.?likes?|subscription/i.test(name)&&/^(default|regular|standard)$/i.test(String(service?.type||"Default"));
}
export function quoteSelectedPosts({service,quantityEach,postURLs,checkWholesale=true}){
 if(!isInstagramLikes(service))throw Error("Choose a regular Instagram Likes service.");
 const posts=normalizePosts(postURLs);
 const q=Number(quantityEach),min=Number(service.min),max=Number(service.max);
 const step=Number(service.quantity_step??service.quantityStep??service.step??service.increment??service.unitStep??1);
 if(!Number.isSafeInteger(q)||!Number.isFinite(min)||!Number.isFinite(max)||!Number.isSafeInteger(step)||step<1||q<min||q>max||(q-min)%step!==0)
  throw Error("Likes per post must meet the supplier minimum, maximum and step.");
 const rate=Number(service.pricedRetail??service.per1000??retailPer1000(service));
 if(!Number.isFinite(rate)||rate<5)throw Error("Live retail rate unavailable.");
 const eachCents=calculateOrderCents(q,rate);
 if(!Number.isSafeInteger(eachCents)||eachCents<1)throw Error("Invalid line amount.");
 const totalCents=eachCents*posts.length;
 if(!Number.isSafeInteger(totalCents)||totalCents<500||totalCents>100000000)
  throw Error("Minimum $5 USD checkout total required.");
 if(checkWholesale){
  const supplierRate=Number(service.rate);
  if(!Number.isFinite(supplierRate)||supplierRate<=0)throw Error("Verified wholesale pricing unavailable.");
  const floor=minimumRetailCentsForWholesale(supplierRate*q/1000);
  if(floor===null||eachCents<floor)throw Error("Supplier cost protection failed; no payment submitted.");
 }
 return {posts,quantityEach:q,eachCents,totalCents,per1000:rate,supplierCostCents:checkWholesale?Math.ceil(Number(service.rate)*q/10)*posts.length:null};
}
export function statusOfItems(items){
 if(!items?.length)return "pending";
 if(items.every(x=>x.state==="SUBMITTED"||x.state==="COMPLETED"))return "submitted";
 if(items.some(x=>["UNKNOWN_OUTCOME","RETRYABLE","MANUAL_REVIEW"].includes(x.state)))return "manual_review";
 if(items.some(x=>x.state==="SUBMITTED"))return "partial";
 return "dispatching";
}
