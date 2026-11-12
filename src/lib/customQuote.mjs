// Shared public price-preview arithmetic for Litix Custom Likes and Followers.
// A preview is never authorization to charge: the checkout server independently
// re-quotes from the active supplier before obtaining a PayKings payment.
const safeInteger=n=>Number.isSafeInteger(n);
export const CUSTOM_DRAFT_PREFIX="litix:custom-quote:";
export const CUSTOM_DRAFT_MAX_AGE_MS=30*60*1000;
export function customLineCents(per1000,quantity){
 const rate=Number(per1000),q=Number(quantity);
 if(!Number.isFinite(rate)||rate<=0||!safeInteger(q)||q<1||q>1_000_000)return null;
 const cents=Math.ceil(rate*q/10-1e-8);
 return safeInteger(cents)&&cents>0?cents:null;
}
export function customQuote(service,kind,quantity,posts=[]){
 if(!service||service.purchasable!==true)return {valid:false,code:"unavailable",totalCents:null};
 const min=Number(service.min),max=Number(service.max),step=Number(service.unitStep||1);
 if(!safeInteger(min)||min<1||!safeInteger(max)||max<min||!safeInteger(step)||step<1)
  return {valid:false,code:"limits",totalCents:null};
 const items=kind==="likes"?(Array.isArray(posts)?posts.map(p=>Number(p.quantity)):[]):[Number(quantity)];
 if(!items.length||items.length>5||(kind!=="likes"&&kind!=="followers"))
  return {valid:false,code:"posts",totalCents:null};
 let totalQty=0,totalCents=0;
 const lines=[];
 for(const q of items){
  const cents=customLineCents(service.per1000,q);
  if(!safeInteger(q)||q<min||q>max||(q-min)%step!==0||cents===null||cents<100)
   return {valid:false,code:"quantity",totalCents:null};
  totalQty+=q;totalCents+=cents;lines.push({quantity:q,cents});
 }
 if(totalQty>1_000_000||!safeInteger(totalCents))return {valid:false,code:"maximum",totalCents:null};
 return {valid:true,code:"ready",quantity:totalQty,totalCents,lines};
}
const safePostLink=(value,platform)=>{
 if(typeof value!=="string"||value.trim().length<1||value.length>1100)return false;
 try{
  const u=new URL(value);
  const host=u.hostname.toLowerCase();
  return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&
   (platform==="Instagram"?["instagram.com","www.instagram.com"].includes(host):
    ["tiktok.com","www.tiktok.com","m.tiktok.com","vm.tiktok.com","vt.tiktok.com"].includes(host));
 }catch{return false}
};
export function readCustomDraft(data,service,now=Date.now()){
 if(!data||data.version!==1||typeof data.serviceId!=="string"||data.serviceId!==service?.id||
  data.kind!=="likes"||!["Instagram","TikTok"].includes(service?.platform)||
  !safeInteger(data.createdAt)||data.createdAt>now+60_000||
  now-data.createdAt>CUSTOM_DRAFT_MAX_AGE_MS||
  !Array.isArray(data.posts)||data.posts.length<1||data.posts.length>5)return null;
 const out=[];
 for(const post of data.posts){
  const q=Number(post?.quantity),link=typeof post?.link==="string"?post.link.trim():"";
  if(!safeInteger(q)||q<1||!safeInteger(Number(service.min))||q<Number(service.min)||
   q>Number(service.max)||typeof post?.verifiedUrl!=="string"||
   typeof post?.verifiedInput!=="string"||link.length>1100||post.verifiedUrl.length>1100||
   post.verifiedInput.length>1100)return null;
  const trustedPreview=link===post.verifiedInput.trim()&&
   safePostLink(link,service.platform)&&safePostLink(post.verifiedUrl,service.platform);
  out.push({link,quantity:q,verifiedUrl:trustedPreview?post.verifiedUrl:"",verifiedInput:trustedPreview?link:"",status:trustedPreview?"verified":"idle"});
 }
 return customQuote(service,"likes",0,out).valid?out:null;
}
