import {createHash,createHmac,randomUUID,timingSafeEqual} from "node:crypto";
import {neon} from "@neondatabase/serverless";
export const reviewDb=()=>neon(process.env.LITIX_PREMIUM_DATABASE_URL||"");
export const reviewReady=()=>!!process.env.LITIX_PREMIUM_DATABASE_URL&&
 !!process.env.LITIX_REVIEWS_HMAC_KEY&&process.env.LITIX_REVIEWS_HMAC_KEY.length>=32&&
 (process.env.VERCEL_ENV==="preview"||
  (process.env.VERCEL_ENV==="production"&&process.env.LITIX_PREMIUM_BOOSTERO_LIVE==="true"));
export const sanitizeReview=x=>String(x||"").trim().replace(/\s+/g," ");
export function validateReview(body){
 const name=sanitizeReview(body?.displayName),category=sanitizeReview(body?.serviceCategory),
  review=sanitizeReview(body?.reviewText),rating=Number(body?.rating);
 if(name.length<2||name.length>60||category.length<3||category.length>100||
   review.length<20||review.length>1200||!Number.isSafeInteger(rating)||rating<1||rating>5)
  throw Error("invalid_review_fields");
 if(body?.companyWebsite)throw Error("review_spam_rejected"); // honeypot
 let image=null;
 if(body?.imageUrl){
  const allow=String(process.env.LITIX_REVIEWS_IMAGE_HOST||"");
  let u;try{u=new URL(body.imageUrl)}catch{throw Error("review_image_host_not_authorized")}
  if(!allow||u.protocol!=="https:"||u.hostname!==allow||u.username||u.password||
    u.search||u.hash||u.port||u.pathname.length>300)
   throw Error("review_image_host_not_authorized");
  image=u.href;
 }
 return {displayName:name,serviceCategory:category,reviewText:review,rating,imageUrl:image};
}
export function reviewFingerprint(ip,userAgent,secret=process.env.LITIX_REVIEWS_HMAC_KEY){
 if(!secret||secret.length<32)throw Error("review_secret_unavailable");
 return createHmac("sha256",secret).update(String(ip||"unknown")+"|"+String(userAgent||"").slice(0,150)).digest("hex");
}
export const reviewTokenHash=token=>createHash("sha256").update(String(token||"")).digest("hex");
export function reviewAdmin(auth,expected=process.env.LITIX_BOOSTERO_ADMIN_TOKEN){
 const input=String(auth||"").replace(/^Bearer /,""),secret=String(expected||"");
 return secret.length>=40&&input.length===secret.length&&timingSafeEqual(Buffer.from(input),Buffer.from(secret));
}
export async function submitReview(input,{sql=reviewDb(),ip="unknown",ua=""}={}){
 const details=validateReview(input);
 const fingerprint=reviewFingerprint(ip,ua);
 const orderId=String(input?.orderId||"");
 let verified=false,category=details.serviceCategory,matched=null;
 if(/^ltx2_[a-f0-9-]{36}$/.test(orderId)&&
    /^[a-zA-Z0-9-]{20,160}$/.test(String(input?.trackingToken||""))){
  const found=await sql.query(
   "select id,category,payment_state,fulfillment_state from public.litix_v2_orders where id=$1 and tracking_token_hash=$2",
   [orderId,reviewTokenHash(input.trackingToken)]);
  if(found.length===1&&found[0].payment_state==="paid"&&found[0].fulfillment_state==="completed"){
   verified=true;matched=orderId;category=String(found[0].category||category).slice(0,100);
  }
 }
 const id=randomUUID();
 await sql.query("insert into public.litix_premium_reviews(id,display_name,service_category,stars,body,image_url,purchase_order_id,verified_purchase,fingerprint,status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')",
  [id,details.displayName,category,details.rating,details.reviewText,details.imageUrl,matched,verified,fingerprint]);
 return {submitted:true,status:"pending",verifiedPurchase:verified};
}
