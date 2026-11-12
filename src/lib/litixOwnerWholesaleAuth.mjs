// Secure, email-verified owner wholesale access. Retail customers cannot see costs.
import {createHmac,randomInt,randomUUID,timingSafeEqual} from "node:crypto";
import {neon} from "@neondatabase/serverless";
export const OWNER_SESSION="__Host-litix-owner-wholesale-session";
export const OWNER_CHALLENGE="__Host-litix-owner-wholesale-challenge";
export const COOKIE_OPTIONS={httpOnly:true,secure:true,sameSite:"strict",path:"/"};
export const ownerDB=()=>{
 const url=process.env.LITIX_BOOSTERO_DATABASE_URL||process.env.LITIX_V2_DATABASE_URL||process.env.DATABASE_URL;
 if(!url)throw Error("owner_database_unavailable");
 return neon(url);
};
const signingKey=()=>{
 const v=String(process.env.LITIX_BOOSTERO_ADMIN_TOKEN||"");
 if(v.length<40)throw Error("owner_signing_unavailable");
 return v;
};
export const ownerEmail=()=>{
 const v=String(process.env.LITIX_OWNER_WHOLESALE_EMAIL||"").trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)||v.length>254)throw Error("owner_email_unconfigured");
 return v;
};
const mac=(purpose,value)=>createHmac("sha256",signingKey()).update("litix-owner-wholesale-v1:"+purpose+":"+value).digest("base64url");
const equal=(a,b)=>{
 const x=Buffer.from(String(a)),y=Buffer.from(String(b));
 return x.length===y.length&&timingSafeEqual(x,y);
};
export const seal=(purpose,value)=>{
 const payload=Buffer.from(JSON.stringify(value)).toString("base64url");
 return payload+"."+mac(purpose,payload);
};
export const open=(purpose,text)=>{
 try{
  const [payload,signature,rest]=String(text||"").split(".");
  if(!payload||!signature||rest||payload.length>2000||!equal(signature,mac(purpose,payload)))return null;
  return JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
 }catch{return null}
};
const cookie=(request,name)=>{
 const value=(request.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="));
 return value?decodeURIComponent(value.slice(name.length+1)):null;
};
export function authenticatedOwner(request){
 const value=open("session",cookie(request,OWNER_SESSION));
 const now=Math.floor(Date.now()/1000);
 return value?.kind==="wholesale"&&Number.isInteger(value?.exp)&&
  value.exp>now&&value.exp<=now+3600&&value.iat<=now&&value.iat>=now-3600;
}
export function ownerOrigin(request){
 const url=new URL(request.url);
 return process.env.VERCEL_ENV==="production"&&
  ["https://www.litix.net","https://litix.net"].includes(url.origin)&&
  (!request.headers.get("origin")||request.headers.get("origin")===url.origin);
}
export const ownerPostOrigin=request=>
 ownerOrigin(request)&&request.headers.get("origin")===new URL(request.url).origin;
export function ownerChallenge(request){
 const value=open("challenge",cookie(request,OWNER_CHALLENGE));
 return value&&/^[0-9a-f-]{36}$/.test(String(value.id||""))&&
  Number.isInteger(value.expires)&&value.expires>Date.now()?value:null;
}
export const issueCode=()=>{
 const code=String(randomInt(0,100000000)).padStart(8,"0");
 return {code,id:randomUUID(),expiresAt:new Date(Date.now()+10*60*1000)};
};
export const hashCode=(id,code)=>mac("code",id+"|"+code);
export const ownerHeaders={"cache-control":"private, no-store, max-age=0",
 "referrer-policy":"no-referrer","x-robots-tag":"noindex, nofollow",
 "x-content-type-options":"nosniff","content-security-policy":"frame-ancestors 'none'"};
