import {NextResponse} from "next/server";
import {ownerConfig,newLogin,authRedirect,validateAuth0Code,signOwner,verifyOwner,
  LOGIN_COOKIE,SESSION_COOKIE,readOwnerSession,ownerNoStore} from "../../../../lib/ownerPortalAuth.mjs";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=30;
const props={secure:true,httpOnly:true,sameSite:"lax",path:"/"};
const err=(status=503)=>NextResponse.json({error:"Owner authentication unavailable"},{status,headers:ownerNoStore});
export async function GET(request,{params}){
 let config;try{config=ownerConfig()}catch{return err()}
 const {action}=await params;
 if(new URL(request.url).origin!==config.origin)return err(403);
 if(action==="login"){
  const info=newLogin(),r=NextResponse.redirect(authRedirect(info),302);
  r.cookies.set(LOGIN_COOKIE,signOwner("login",info),{...props,maxAge:600});
  r.headers.set("cache-control","no-store");return r;
 }
 if(action==="callback"){
  const p=new URL(request.url).searchParams;
  const value=(request.headers.get("cookie")||"").split(";").map(s=>s.trim())
   .find(s=>s.startsWith(LOGIN_COOKIE+"="))?.slice(LOGIN_COOKIE.length+1);
  const x=verifyOwner("login",value);
  if(!x||x.exp<Date.now()||p.get("state")!==x.state||!p.get("code")||p.get("error"))return err(401);
  try{
   const session=await validateAuth0Code({code:p.get("code"),nonce:x.nonce,verifier:x.verifier});
   const out=NextResponse.redirect(config.origin+"/owner",303);
   out.cookies.set(LOGIN_COOKIE,"",{...props,maxAge:0});
   out.cookies.set(SESSION_COOKIE,signOwner("session",session),{...props,maxAge:3600});
   out.headers.set("cache-control","no-store");return out;
  }catch{return err(403)}
 }
 return err(404);
}
export async function POST(request,{params}){
 const {action}=await params;if(action!=="logout")return err(404);
 try{
  const c=ownerConfig();
  if(new URL(request.url).origin!==c.origin||request.headers.get("origin")!==c.origin||
   !readOwnerSession(request.headers))return err(403);
  const r=NextResponse.json({ok:true},{headers:ownerNoStore});
  r.cookies.set(SESSION_COOKIE,"",{...props,maxAge:0});
  r.cookies.set(LOGIN_COOKIE,"",{...props,maxAge:0});
  return r;
 }catch{return err(403)}
}
