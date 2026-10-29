import {createHash,createHmac,createPublicKey,randomBytes,timingSafeEqual,verify as verifySignature} from "node:crypto";
const sessionName="__Host-litix-wholesale-session";
const flowName="__Host-litix-wholesale-flow";
const base=(s)=>Buffer.from(s).toString("base64url");
const unbase=s=>Buffer.from(String(s),"base64url").toString("utf8");
export const ownerCookie=sessionName;
export const ownerFlowCookie=flowName;
export const ownerCookieOptions={httpOnly:true,secure:true,sameSite:"lax",path:"/"};
const secret=()=>{const x=process.env.AUTH0_SECRET;if(!x||x.length<32)throw Error("owner_auth_secret_missing");return x};
export const ownerConfig=()=>{
 const domain=String(process.env.AUTH0_DOMAIN||"").replace(/^https?:\/\//,"").replace(/\/$/,"");
 const client=String(process.env.AUTH0_CLIENT_ID||"");
 const privateSecret=String(process.env.AUTH0_CLIENT_SECRET||"");
 const sub=String(process.env.LITIX_OWNER_AUTH0_SUB||"");
 const origin=String(process.env.LITIX_OWNER_ALLOWED_ORIGIN||"");
 if(!/^[a-z0-9][a-z0-9.-]+\.auth0\.com$/i.test(domain)||
    !client||!privateSecret||!/^auth0\|[A-Za-z0-9_-]+$|^[A-Za-z0-9|._:-]{5,150}$/.test(sub)||
    !/^https:\/\/(?:[a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}(?::\d{2,5})?$/i.test(origin))throw Error("owner_auth_unconfigured");
 secret();
 return {issuer:"https://"+domain+"/",domain,client,privateSecret,sub,origin};
};
function sign(value,purpose){
 return createHmac("sha256",secret()).update(purpose+"|"+value).digest("base64url");
}
function compare(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y)}
export const seal=(data,purpose)=>{
 const data64=base(JSON.stringify(data));return data64+"."+sign(data64,purpose);
};
export function unseal(cookie,purpose){
 try{
  const [data64,mac,extra]=String(cookie||"").split(".");
  if(!data64||!mac||extra||!compare(sign(data64,purpose),mac))return null;
  return JSON.parse(unbase(data64));
 }catch{return null}
}
export function createOwnerLoginFlow(){
 const now=Date.now(),state=base(randomBytes(32)),nonce=base(randomBytes(32)),verifier=base(randomBytes(48));
 return {state,nonce,verifier,iat:now,expires:now+10*60*1000};
}
export const challenge=verifier=>createHash("sha256").update(verifier).digest("base64url");
export function validateFlow(cookie,state){
 const x=unseal(cookie,"flow");
 return x&&Date.now()<x.expires&&Date.now()>=x.iat&&compare(x.state,state)?x:null;
}
export async function exchangeOwnerCode(code,flow){
 const cfg=ownerConfig();
 const r=await fetch(cfg.issuer+"oauth/token",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({grant_type:"authorization_code",client_id:cfg.client,client_secret:cfg.privateSecret,
   code,redirect_uri:cfg.origin+"/owner/wholesale/callback",code_verifier:flow.verifier}),
  redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000)
 });
 if(!r.ok)throw Error("auth0_exchange_rejected");
 const payload=await r.json();
 if(!payload.id_token||typeof payload.id_token!=="string")throw Error("auth0_id_token_missing");
 return verifyOwnerIdToken(payload.id_token,cfg,flow.nonce);
}
export async function verifyOwnerIdToken(token,cfg,nonce,{fetcher=fetch}={}){
 const [a,b,s,...extra]=String(token||"").split(".");
 if(!a||!b||!s||extra.length)throw Error("invalid_id_token");
 let header,claims;
 try{header=JSON.parse(unbase(a));claims=JSON.parse(unbase(b))}catch{throw Error("invalid_id_token")}
 if(header.alg!=="RS256"||typeof header.kid!=="string"||header.kid.length>120||!header.kid||
    header.typ&&header.typ!=="JWT")throw Error("unsupported_id_token");
 const now=Math.floor(Date.now()/1000);
 if(claims.iss!==cfg.issuer||claims.aud!==cfg.client||claims.sub!==cfg.sub||
    !compare(claims.nonce||"",nonce)||!Number.isInteger(claims.exp)||claims.exp<=now||
    !Number.isInteger(claims.iat)||claims.iat>now+60||claims.iat<now-3600)throw Error("owner_identity_denied");
 const jwks=await fetcher(cfg.issuer+".well-known/jwks.json",{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(10000)});
 if(!jwks.ok)throw Error("auth0_keys_unavailable");
 const keys=await jwks.json();
 const jwk=(keys.keys||[]).find(x=>x.kid===header.kid&&x.kty==="RSA"&&x.use==="sig"&&x.alg==="RS256");
 if(!jwk)throw Error("auth0_signing_key_missing");
 let valid=false;
 try{valid=verifySignature("RSA-SHA256",Buffer.from(a+"."+b),
   createPublicKey({key:jwk,format:"jwk"}),Buffer.from(s,"base64url"))}catch{}
 if(!valid)throw Error("invalid_id_signature");
 return {sub:claims.sub,iat:now,exp:Math.min(claims.exp,now+3600)};
}
export function ownerSession(cookie){
 const claims=unseal(cookie,"session");if(!claims)return null;
 let cfg;try{cfg=ownerConfig()}catch{return null}
 const now=Math.floor(Date.now()/1000);
 if(claims.sub!==cfg.sub||!Number.isInteger(claims.exp)||claims.exp<=now||claims.exp>now+3600||
    !Number.isInteger(claims.iat)||claims.iat>now||claims.iat<now-3600)return null;
 return claims;
}
export function ownerRequest(req){
 const match=(req.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(ownerCookie+"="));
 return ownerSession(match?decodeURIComponent(match.slice(ownerCookie.length+1)):null);
}
export const ownerResponse=(payload,status=200)=>Response.json(payload,{status,headers:{
 "cache-control":"private, no-store, max-age=0","referrer-policy":"no-referrer","x-robots-tag":"noindex, nofollow","x-content-type-options":"nosniff"}});
export const safeOrigin=req=>{
 try{
 const u=new URL(req.url);const cfg=ownerConfig();
 return u.origin===cfg.origin&&(!req.headers.get("origin")||req.headers.get("origin")===cfg.origin);
 }catch{return false}
};
