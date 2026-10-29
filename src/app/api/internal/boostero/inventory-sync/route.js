import {timingSafeEqual} from "node:crypto";
import {boosteroProduction} from "../../../../../lib/boosteroReadOnly.mjs";
import {boosteroSQL} from "../../../../../lib/boosteroFulfillment.mjs";
import {importBoosteroInventory} from "../../../../../lib/boosteroInventorySync.mjs";
import {alertBoosteroInventorySync} from "../../../../../lib/boosteroInventoryAlerts.mjs";
import {ownerRequest,safeOrigin} from "../../../../../lib/ownerAuth.mjs";
import {newSyncRunId,logBoosteroSyncEvent} from "../../../../../lib/boosteroSyncEvents.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const respond=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store",
 "x-content-type-options":"nosniff","x-robots-tag":"noindex"}});
const cronAllowed=req=>{
 const given=(req.headers.get("authorization")||"").replace(/^Bearer /,"");
 const expected=String(process.env.CRON_SECRET||"");
 return expected.length>=24&&given.length===expected.length&&timingSafeEqual(Buffer.from(given),Buffer.from(expected));
};
export async function performBoosteroInventorySync({sql=boosteroSQL(),operation=boosteroProduction}={}){
 const runId=newSyncRunId(),start=Date.now();
 const claimed=await sql.query(`insert into public.litix_boostero_sync_lock(lock_id,run_id,expires_at)
 values('global',$1::uuid,now()+interval '5 minutes')
 on conflict(lock_id) do update set run_id=excluded.run_id,expires_at=excluded.expires_at
 where public.litix_boostero_sync_lock.expires_at<now()
 returning lock_id`,[runId]);
 if(!claimed.length)return {ok:true,skipped:"synchronization_already_running"};
 try{
  await logBoosteroSyncEvent(sql,{runId,operation:"SYNC_STARTED"});
  const source=await operation("services");
  const result=await importBoosteroInventory(sql,source,{force:true});
  await logBoosteroSyncEvent(sql,{runId,operation:"SYNC_SUCCESS",received:result.retrieved,
   processed:result.imported,rejected:result.invalid,activated:result.publicNewServicesEnabled,
   deactivated:result.markedUnavailable,durationMs:Date.now()-start,reasons:result.reasonCounts});
  return {ok:true,supplier:"boostero",runId,...result};
 }catch(error){
  const raw=String(error?.message||"");
  const errorCode=/^inventory_[a-z0-9_]+$/.test(raw)?raw:"inventory_sync_failed";
  await logBoosteroSyncEvent(sql,{runId,level:"ERROR",operation:"SYNC_FAILED",
   durationMs:Date.now()-start,errorCode}).catch(()=>{});
  await alertBoosteroInventorySync(errorCode).catch(()=>{});
  return {ok:false,error:errorCode};
 }finally{
  await sql.query(`update public.litix_boostero_sync_lock
    set expires_at=now() where lock_id='global' and run_id=$1::uuid`,[runId]).catch(()=>{});
 }
}
async function refresh(req,owner){
 if(process.env.VERCEL_ENV!=="production")return respond({error:"production_only"},404);
 if(owner){
  if(!ownerRequest(req))return respond({error:"authenticated_owner_session_required"},401);
  if(!safeOrigin(req))return respond({error:"invalid_owner_origin"},403);
 }else if(!cronAllowed(req))return respond({error:"unauthorized"},401);
 // No inventory writes until actual isolated recovery has been verified.
 if(process.env.LITIX_BOOSTERO_BACKUP_VERIFIED!=="true")
  return respond({ok:true,skipped:"production_backup_not_verified"});
 if(process.env.LITIX_BOOSTERO_GLOBAL_SYNC_ENABLED!=="true")
  return respond({ok:true,skipped:"global_sync_release_not_enabled"});
 if(process.env.LITIX_BOOSTERO_ENABLED!=="true")
  return respond({ok:false,error:"boostero_disabled"},503);
 try{
  const result=await performBoosteroInventorySync();
  return respond(result,result.ok?200:503);
 }catch{
  return respond({ok:false,error:"sync_schema_or_database_unavailable"},503);
 }
}
export async function GET(req){return refresh(req,false)}
export async function POST(req){return refresh(req,true)}
