import {db,cronAuth,dispatchLivePost} from "../../../../lib/liveAutoLikes.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
async function refreshSupplierStatuses(sql){
 const key=process.env.SMMGLOB_API_KEY;
 if(!key)return 0;
 const candidates=await sql.query(
  "select id,supplier_order_id from litix_autolikes_live_posts where state='SUBMITTED' and supplier_order_id is not null and (last_status_checked_at is null or last_status_checked_at<now()-interval '30 minutes') order by last_status_checked_at nulls first,created_at asc limit 5");
 let refreshed=0;
 for(const p of candidates){
  try{
   const res=await fetch("https://smmglob.com/api/v2",{
    method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({key,action:"status",order:String(p.supplier_order_id)}),
    cache:"no-store",signal:AbortSignal.timeout(9000)
   });
   if(!res.ok)continue;
   const data=await res.json();
   if(data?.error||typeof data?.status!=="string")continue;
   const allowed=["pending","in progress","completed","partial","canceled","processing"];
   const status=data.status.trim().toLowerCase();
   if(!allowed.includes(status))continue;
   const remains=Number(data.remains);
   await sql.query(
    "update litix_autolikes_live_posts set supplier_status=$2,supplier_remains=$3,last_status_checked_at=now() where id=$1",
    [p.id,status,Number.isSafeInteger(remains)&&remains>=0?remains:null]);
   refreshed++;
  }catch{ /* Read-only status failures never cause paid order retries. */ }
 }
 return refreshed;
}
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
  const statusesUpdated=await refreshSupplierStatuses(sql);
  return Response.json({ok:true,processed:confirmed+unknown+declined,confirmed,unknown,declined,statusesUpdated},{headers:{"cache-control":"no-store"}});
 }catch(e){
  console.error("AutoLikes cron error",String(e?.code||"database_unavailable"));
  return Response.json({error:"AutoLikes worker unavailable"},{status:503});
 }
}