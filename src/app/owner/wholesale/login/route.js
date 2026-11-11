import {NextResponse} from "next/server";
import {ownerConfig,createOwnerLoginFlow,seal,challenge,ownerFlowCookie,ownerCookieOptions} from "../../../../lib/ownerAuth.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req){
 try{
  const cfg=ownerConfig();if(new URL(req.url).origin!==cfg.origin)throw Error();
  const flow=createOwnerLoginFlow();
  const url=new URL(cfg.issuer+"authorize");
  Object.entries({response_type:"code",client_id:cfg.client,redirect_uri:cfg.origin+"/owner/wholesale/callback",
   scope:"openid profile email",state:flow.state,nonce:flow.nonce,code_challenge:challenge(flow.verifier),
   code_challenge_method:"S256",prompt:"login"}).forEach(([key,value])=>url.searchParams.set(key,value));
  const response=NextResponse.redirect(url,{status:303});
  response.cookies.set(ownerFlowCookie,seal(flow,"flow"),{...ownerCookieOptions,maxAge:600});
  response.headers.set("cache-control","private, no-store");return response;
 }catch{return new Response("Owner sign-in is not configured.",{status:503,headers:{"cache-control":"no-store"}})}
}
