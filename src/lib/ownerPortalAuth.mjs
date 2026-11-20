// Isolated owner Auth0 OpenID Connect verification; never authorize with email or UI state alone.
import {createHmac,createHash,createPublicKey,randomBytes,timingSafeEqual,verify as verifyRsa} from "node:crypto";

export const SESSION_COOKIE="__Host-litix-owner-portal";
export const LOGIN_COOKIE="__Host-litix-owner-login";
const b64=v=>Buffer.from(v).toString("base64url");
const fromB64=v=>Buffer.from(v,"base64url").toString("utf8");
const safeEq=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y)};
const cookie=(h,k)=>String(h?.get?.("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(k+"="))?.slice(k.length+1)||"";
const secret=()=>{const v=process.env.LITIX_OWNER_SESSION_SECRET||"";if(v.length<48)throw Error("owner_session_secret_unavailable");return v};
export function ownerConfig(){
 const domain=String(process.env.LITIX_OWNER_AUTH0_DOMAIN||"").trim().toLowerCase();
 const sub=String(process.env.LITIX_OWNER_AUTH0_SUB||"");
 const clientId=String(process.env.LITIX_OWNER_AUTH0_CLIENT_ID||"");
 const clientSecret=String(process.env.LITIX_OWNER_AUTH0_CLIENT_SECRET||"");
 const origin=String(process.env.LITIX_OWNER_PORTAL_ORIGIN||"https://www.litix.net").replace(/\/$/,"");
 if(!/^[a-z0-9][a-z0-9.-]{2,250}$/.test(domain)||!domain.includes(".")||
    !/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(origin)||!clientId||clientSecret.length<16||
    !/^[A-Za-z0-9_|.-]{5,255}$/.test(sub))throw Error("owner_auth0_not_configured");
 secret();
 return {domain,issuer:"https://"+domain+"/",sub,clientId,clientSecret,origin,
   callback:origin+"/owner/auth/callback"};
}
const sign=(purpose,data)=>{
 const body=b64(JSON.stringify(data));
 const mac=createHmac("sha256",secret()).update("litix-owner:"+purpose+":"+body).digest("base64url");
 return body+"."+mac;
};
const unsign=(purpose,token)=>{
 try{
  const [body,mac,extra]=String(token||"").split(".");
  if(!body||!mac||extra||body.length>4096)return null;
  const expected=createHmac("sha256",secret()).update("litix-owner:"+purpose+":"+body).digest("base64url");
  return safeEq(mac,expected)?JSON.parse(fromB64(body)):null;
 }catch{return null}
};
export const signOwner=(purpose,data)=>sign(purpose,data);
export const verifyOwner=(purpose,token)=>unsign(purpose,token);
export function readOwnerSession(headers){
 try{
  const cfg=ownerConfig();
  const x=unsign("session",cookie(headers,SESSION_COOKIE));
  const now=Math.floor(Date.now()/1000);
  if(x?.sub!==cfg.sub||x?.iss!==cfg.issuer||x?.aud!==cfg.clientId||
    !Number.isInteger(x.exp)||x.exp<=now||x.exp>now+43200||
    !Number.isInteger(x.iat)||x.iat>now||x.iat<now-43200||
    !/^[0-9a-f]{64}$/.test(String(x.csrf||"")))return null;
  return {sub:x.sub,csrf:x.csrf,exp:x.exp};
 }catch{return null}
}
export function newLogin(){
 const state=b64(randomBytes(32)),nonce=b64(randomBytes(32)),verifier=b64(randomBytes(32));
 return {state,nonce,verifier,exp:Date.now()+600000};
}
export function authRedirect(info){
 const c=ownerConfig();
 const challenge=b64(createHash("sha256").update(info.verifier).digest());
 const u=new URL("https://"+c.domain+"/authorize");
 for(const [k,v] of Object.entries({client_id:c.clientId,response_type:"code",redirect_uri:c.callback,
  scope:"openid profile email",state:info.state,nonce:info.nonce,code_challenge:challenge,
  code_challenge_method:"S256",prompt:"login"}))u.searchParams.set(k,v);
 return u.toString();
}
export async function validateAuth0Code({code,nonce,verifier}){
 const c=ownerConfig();
 if(!/^[A-Za-z0-9._~+/-]{10,3000}$/.test(code))throw Error("invalid_auth_code");
 const r=await fetch("https://"+c.domain+"/oauth/token",{method:"POST",redirect:"error",
   headers:{"content-type":"application/json"},cache:"no-store",signal:AbortSignal.timeout(12000),
   body:JSON.stringify({grant_type:"authorization_code",client_id:c.clientId,client_secret:c.clientSecret,
    redirect_uri:c.callback,code,code_verifier:verifier})});
 if(!r.ok)throw Error("auth0_token_exchange_rejected");
 const response=await r.json(),jwt=String(response.id_token||"");
 const parts=jwt.split(".");
 if(parts.length!==3||parts.some(p=>p.length>12000))throw Error("invalid_owner_id_token");
 const header=JSON.parse(fromB64(parts[0])),claims=JSON.parse(fromB64(parts[1]));
 if(header.alg!=="RS256"||!header.kid||header.typ&&!["JWT","jwt"].includes(header.typ))throw Error("invalid_owner_signature_algorithm");
 const now=Math.floor(Date.now()/1000);
 if(claims.iss!==c.issuer||claims.sub!==c.sub||claims.aud!==c.clientId||
    claims.nonce!==nonce||!Number.isInteger(claims.exp)||claims.exp<=now||
    !Number.isInteger(claims.iat)||claims.iat>now+60||claims.iat<now-600||
    claims.email_verified!==true)throw Error("owner_identity_not_authorized");
 const jwks=await fetch("https://"+c.domain+"/.well-known/jwks.json",{
    redirect:"error",cache:"no-store",signal:AbortSignal.timeout(10000)});
 if(!jwks.ok)throw Error("auth0_jwks_unavailable");
 const keys=(await jwks.json()).keys;
 const jwk=Array.isArray(keys)?keys.find(k=>k.kid===header.kid&&k.kty==="RSA"&&k.use==="sig"&&(!k.alg||k.alg==="RS256")):null;
 if(!jwk)throw Error("unknown_owner_signing_key");
 const key=createPublicKey({key:jwk,format:"jwk"});
 if(!verifyRsa("RSA-SHA256",Buffer.from(parts[0]+"."+parts[1]),key,Buffer.from(parts[2],"base64url")))
   throw Error("owner_token_signature_invalid");
 return {sub:claims.sub,iss:claims.iss,aud:claims.aud,iat:now,exp:now+3600,
   csrf:randomBytes(32).toString("hex")};
}
export function assertOwnerMutation(request){
 const user=readOwnerSession(request.headers);
 if(!user)throw Error("owner_session_required");
 const expected=ownerConfig().origin;
 if(new URL(request.url).origin!==expected||request.headers.get("origin")!==expected||
   request.headers.get("sec-fetch-site")==="cross-site"||
   !safeEq(request.headers.get("x-litix-owner-csrf")||"",user.csrf))throw Error("owner_csrf_rejected");
 return user;
}
export function assertOwnerRead(request){
 const user=readOwnerSession(request.headers);
 if(!user||new URL(request.url).origin!==ownerConfig().origin)throw Error("owner_session_required");
 return user;
}
export const ownerNoStore={"cache-control":"private, no-store, max-age=0",
 "x-robots-tag":"noindex, nofollow","referrer-policy":"no-referrer",
 "x-content-type-options":"nosniff","content-security-policy":"frame-ancestors 'none'"};
