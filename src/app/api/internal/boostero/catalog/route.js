import {authorizedCron,cronReply} from "../../../../../lib/litixCronAuth.mjs";
import {synchronizeCatalog} from "../../../../../lib/boosteroMonitor.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(req){
 if(!authorizedCron(req))return cronReply({error:"Unauthorized"},401);
 if(process.env.VERCEL_ENV!=="production")return cronReply({skipped:"not_production"});
 if(process.env.LITIX_BOOSTERO_MONITOR_V2_ENABLED!=="true")return cronReply({skipped:"monitor_not_enabled"});
 try{return cronReply({ok:true,...await synchronizeCatalog()});}
 catch(error){console.error("litix_boostero_cron_error",{task:"synchronizeCatalog",code:String(error?.message||"worker").slice(0,64)});
  return cronReply({ok:false,error:"Supplier reconciliation currently unavailable"},503);}
}
