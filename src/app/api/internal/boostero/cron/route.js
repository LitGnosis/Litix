import {timingSafeEqual} from "node:crypto";
import {syncBoosteroMultiStatuses,resumeBoosteroMultiQueue} from "../../../../../lib/boosteroMultiPostFulfillment.mjs";
import {boosteroCronPhase,BOOSTERO_CRON_PHASE_LABELS} from "../../../../../lib/litixOperationalSchedule.mjs";
import {syncBoosteroStatuses,boosteroProductionReady,deliverLitixCustomerUpdates} from "../../../../../lib/boosteroFulfillment.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

const send=(v,status=200)=>Response.json(v,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});

export async function GET(req){
 const expected=String(process.env.CRON_SECRET||"");
 const bearer=String(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(expected.length<24||expected.length!==bearer.length||
  !timingSafeEqual(Buffer.from(expected),Buffer.from(bearer)))return send({error:"Unauthorized"},401);
 if(process.env.VERCEL_ENV!=="production")return send({ok:true,skipped:"not_production"});
 if(!boosteroProductionReady())return send({ok:true,skipped:"boostero_disabled"});
 // Each five-minute tick handles a bounded class of work. The old route
 // sequentially ran four supplier/database/email batches in one 60s request.
 // Only status lookups operate in phases 0/1; phase 2 resumes ONLY unpaid-to-
 // paid-verified, previously queued children through existing atomic claims.
 const phase=boosteroCronPhase();
 try{
  const sendUpdates=deliverLitixCustomerUpdates({limit:2});
  const task=phase===0?syncBoosteroStatuses({limit:3}):
   phase===1?syncBoosteroMultiStatuses({limit:5}):
   process.env.LITIX_MULTIPOST_AUTO_FULFILL_ENABLED==="true"?
    resumeBoosteroMultiQueue({limitParents:1}):
    Promise.resolve({skipped:"multi_post_disabled"});
  const outcomes=await Promise.allSettled([task,sendUpdates]);
  const work=outcomes[0].status==="fulfilled"?outcomes[0].value:{failed:1};
  const customerNotifications=outcomes[1].status==="fulfilled"?outcomes[1].value:{failed:1};
  if(outcomes.some(x=>x.status==="rejected"))return send({
   ok:false,phase:BOOSTERO_CRON_PHASE_LABELS[phase],work,customerNotifications,
   error:"Litix supplier reconciliation temporarily unavailable"
  },503);
  return send({ok:true,phase:BOOSTERO_CRON_PHASE_LABELS[phase],work,customerNotifications});
 }catch{
  return send({ok:false,error:"Private supplier polling unavailable"},503);
 }
}
