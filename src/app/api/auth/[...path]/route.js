import { getNeonCustomerAuth } from "../../../../lib/neonCustomerAuth.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const notReady=()=>Response.json({error:"Neon customer authentication has not been enabled."},{status:503,headers:{"cache-control":"no-store"}});
export async function GET(req,ctx) {
 const auth=getNeonCustomerAuth();
 if(!auth)return notReady();
 return auth.handler().GET(req,ctx);
}
export async function POST(req,ctx) {
 const auth=getNeonCustomerAuth();
 if(!auth)return notReady();
 return auth.handler().POST(req,ctx);
}
