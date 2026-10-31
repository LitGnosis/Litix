import {guardianDb,bearerAuthorized} from "../../../../lib/guardianRuntime.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=15;
export async function GET(req){
 const token=process.env.LITIX_GUARDIAN_ADMIN_TOKEN||process.env.ADMIN_SECRET;
 if(!bearerAuthorized(req,token))return Response.json({error:"Owner authorization required"},{status:401,headers:{"cache-control":"no-store"}});
 try{
  const db=guardianDb();
  const [components,incidents,runs,alerts]=await Promise.all([
   db.query("select component,status,consecutive_failures,consecutive_successes,checked_at,last_healthy_at,last_result,active_incident_id from public.litix_guardian_components where component<>'smmglob' order by component"),
   db.query("select id,component,started_at,confirmed_at,resolved_at,severity,cause_code,summary from public.litix_guardian_incidents order by started_at desc limit 60"),
   db.query("select id,started_at,finished_at,component_count,unhealthy_count,diag from public.litix_guardian_runs order by started_at desc limit 25"),
   db.query("select component,kind,status,created_at,sent_at,attempts from public.litix_guardian_alert_outbox order by created_at desc limit 50")
  ]);
  return Response.json({components,incidents,runs,alerts,readOnly:true},{
   headers:{"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"}});
 }catch{return Response.json({error:"Guardian dashboard storage unavailable"},{status:503});}
}
