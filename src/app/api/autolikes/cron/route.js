import {db,cronAuth,dispatchLivePost} from "../../../../lib/liveAutoLikes.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(req){
 if(!cronAuth(req))return Response.json({error:"Unauthorized"},{status:401});
 if(process.env.LITIX_AUTOLIKES_DISPATCH_ENABLED!=="true")return Response.json({enabled:false},{status:503});
 try{
  const sql=db();
  const queued=await sql.query(
   "select p.id from litix_autolikes_live_posts p join litix_autolikes_live_subscriptions s on s.id=p.subscription_id where p.state='QUEUED' and s.status='ACTIVE' and s.payment_status='PAID' and s.billing_cycle_end>now() and s.posts_remaining>0 order by p.created_at asc limit 5");
  let confirmed=0,unknown=0,declined=0;
  for(const p of queued){
   const result=await dispatchLivePost(p.id);
   if(result.state==="SUBMITTED")confirmed++;
   else if(result.state==="UNKNOWN_OUTCOME")unknown++;
   else if(result.state==="DECLINED")declined++;
  }
  return Response.json({ok:true,processed:confirmed+unknown+declined,confirmed,unknown,declined},{headers:{"cache-control":"no-store"}});
 }catch(e){
  console.error("AutoLikes cron error",String(e?.code||"database_unavailable"));
  return Response.json({error:"AutoLikes worker unavailable"},{status:503});
 }
}