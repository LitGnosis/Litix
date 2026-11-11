import {NextResponse} from "next/server";
import {ownerConfig,ownerFlowCookie,ownerCookie,ownerCookieOptions,validateFlow,exchangeOwnerCode,seal} from "../../../../lib/ownerAuth.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req){
 let cfg;try{cfg=ownerConfig()}catch{return new Response("Owner authentication unavailable",{status:503})}
 const url=new URL(req.url);
 if(url.origin!==cfg.origin)return new Response("Invalid callback host",{status:403});
 const flow=validateFlow(req.cookies.get(ownerFlowCookie)?.value,url.searchParams.get("state")||"");
 const code=url.searchParams.get("code")||"";
 if(!flow||!code||code.length>2048)return new Response("Invalid or expired login attempt",{status:401,headers:{"cache-control":"no-store"}});
 try{
  const claims=await exchangeOwnerCode(code,flow);
  const res=NextResponse.redirect(cfg.origin+"/owner/wholesale",{status:303});
  res.cookies.delete(ownerFlowCookie);
  res.cookies.set(ownerCookie,seal(claims,"session"),{...ownerCookieOptions,maxAge:3600});
  res.headers.set("cache-control","private, no-store");return res;
 }catch{
  const res=new Response("Owner identity could not be verified",{status:403,headers:{"cache-control":"no-store"}});
  res.headers.append("set-cookie",ownerFlowCookie+"=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax");
  return res;
 }
}
