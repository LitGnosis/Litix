import {timingSafeEqual} from "node:crypto";
import {syncBoosteroStatuses,boosteroProductionReady,deliverLitixCustomerUpdates} from "../../../../../lib/boosteroFulfillment.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export function authorized(req){
 const expected=String(process.env.CRON_SECRET||"");
 const bearer=String(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 return expected.length>=24&&expected.length===bearer.length&&timingSafeEqual(Buffer.from(expected),Buffer.from(bearer));
}
export async function GET(req){
 if(!authorized(req))return Response.json({error:"Unauthorized"},{status:401,headers:{"cache-control":"no-store"}});
 if(process.env.VERCEL_ENV!=="production")return Response.json({ok:true,skipped:"preview_not_scheduled"});
 if(!boosteroProductionReady())return Response.json({ok:true,skipped:"boostero_disabled"});
 // Regular order status polling is independent of multi-post continuation,
 // multi-post status reads and customer email retries.
 const results=await Promise.allSettled([
  syncBoosteroStatuses({limit:3}),
  deliverLitixCustomerUpdates({limit:3})
 ]);
 const [status,notifications]=results.map(r=>r.status==="fulfilled"?r.value:{failed:1,error:"WORKER_OPERATION_UNAVAILABLE"});
 return Response.json({ok:results.every(r=>r.status==="fulfilled"),
  regularOrderStatuses:status,customerNotifications:notifications,
  multiPostStatuses:{skipped:"dedicated_cron"},
  multiPostContinuation:{skipped:"dedicated_cron"}},
  {status:results.every(r=>r.status==="fulfilled")?200:503,headers:{"cache-control":"no-store"}});
}
