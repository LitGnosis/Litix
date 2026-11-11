import {NextResponse} from "next/server";
import {ownerCookie,ownerFlowCookie,ownerConfig} from "../../../../lib/ownerAuth.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req){
 const cfg=ownerConfig();
 const origin=req.headers.get("origin");
 if(new URL(req.url).origin!==cfg.origin||origin!==cfg.origin)return new Response("Denied",{status:403});
 const res=NextResponse.redirect(cfg.origin+"/",{status:303});
 res.cookies.delete(ownerCookie);res.cookies.delete(ownerFlowCookie);res.headers.set("cache-control","no-store");return res;
}
