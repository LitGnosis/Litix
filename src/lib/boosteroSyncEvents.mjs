import {randomUUID} from "node:crypto";
const ops=new Set(["SYNC_STARTED","SYNC_SUCCESS","SYNC_PARTIAL","VALIDATION_FAILED","SUPPLIER_ERROR","CATALOG_PUBLISHED","RECOVERY_REQUIRED","SYNC_FAILED","MAINTENANCE_COMPLETED"]);
const levels=new Set(["INFO","WARN","ERROR"]);
export const newSyncRunId=()=>randomUUID();
const count=n=>Number.isSafeInteger(Number(n))&&Number(n)>=0?Number(n):0;
const code=value=>String(value||"").toUpperCase().replace(/[^A-Z0-9_]/g,"_").slice(0,64)||null;
/** Only aggregate counters and fixed error codes are persisted. Never raw API error text. */
export async function logBoosteroSyncEvent(sql,{runId,level="INFO",operation,received=0,processed=0,
 activated=0,rejected=0,deactivated=0,durationMs=null,errorCode=null,reasons={}}){
 if(!ops.has(operation)||!levels.has(level)||!/^[-0-9a-f]{36}$/.test(String(runId||"")))
  throw Error("invalid_sync_event");
 const safeReasons={};
 for(const [key,val] of Object.entries(reasons||{}).slice(0,50)){
  if(/^[a-z0-9_]{1,64}$/.test(key))safeReasons[key]=count(val);
 }
 const dur=durationMs===null?null:count(Math.round(durationMs));
 await sql.query(`insert into public.litix_boostero_sync_events
 (event_id,run_id,event_level,operation,supplier_total,processed,activated,rejected,
  deactivated,elapsed_ms,error_code,reason_counts,protected_incident)
 values($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)`,
 [randomUUID(),runId,level,operation,count(received),count(processed),count(activated),
  count(rejected),count(deactivated),dur,code(errorCode),JSON.stringify(safeReasons),
  level==="ERROR"||operation==="RECOVERY_REQUIRED"]);
}
export async function readBoosteroSyncEvents(sql,{page=1,pageSize=50}={}){
 const p=Math.max(1,Math.min(200,Number(page)||1));
 const size=Math.max(1,Math.min(50,Number(pageSize)||50));
 const rows=await sql.query(`select event_id,run_id,created_at,event_level,operation,
   supplier_total,processed,activated,rejected,deactivated,elapsed_ms,error_code,reason_counts
   from public.litix_boostero_sync_events
   order by created_at desc,event_id desc limit $1 offset $2`,[size,(p-1)*size]);
 return {page:p,pageSize:size,events:rows};
}
/** Preview-only. Never deletes logs; retention eligibility and protected events are separated. */
export async function previewBoosteroRetention(sql,{days=14}={}){
 const d=Math.max(14,Math.min(365,Number(days)||14));
 const r=await sql.query(`select count(*)::integer as candidates,min(created_at) as oldest
 from public.litix_boostero_sync_events
 where created_at < now()-($1::integer * interval '1 day')
 and event_level='INFO' and operation in('SYNC_STARTED','SYNC_SUCCESS')
 and protected_incident=false`,[d]);
 return {days:d,candidates:Number(r[0]?.candidates||0),oldest:r[0]?.oldest||null,
  deletionEnabled:false,securityFinancialAuditPreserved:true};
}

/** Bounded real maintenance. Deletes only unprotected routine success/start logs.
 * Critical failures, recovery events, and any run involved in an incident survive.
 * Summary records and customer/financial tables are never touched.
 */
export async function pruneBoosteroRoutineLogs(sql,{days=14,batch=100,authorized=false}={}){
 if(authorized!==true||process.env.LITIX_BOOSTERO_BACKUP_VERIFIED!=="true"||
    process.env.LITIX_BOOSTERO_LOG_RETENTION_APPROVED!=="true")
  return {deleted:0,skipped:"maintenance_release_not_approved"};
 const d=Math.max(14,Math.min(365,Number.isSafeInteger(days)?days:14));
 const cap=Math.max(1,Math.min(200,Number.isSafeInteger(batch)?batch:100));
 const rows=await sql.query(`
 WITH doomed AS (
   SELECT e.event_id FROM public.litix_boostero_sync_events e
   WHERE e.created_at < now()-($1::integer * interval '1 day')
    AND e.protected_incident=false AND e.event_level='INFO'
    AND e.operation IN ('SYNC_STARTED','SYNC_SUCCESS')
    AND NOT EXISTS (
     SELECT 1 FROM public.litix_boostero_sync_events risk
     WHERE risk.run_id=e.run_id
       AND (risk.protected_incident=true OR risk.event_level='ERROR'
          OR risk.operation IN ('RECOVERY_REQUIRED','SYNC_FAILED','VALIDATION_FAILED'))
    )
   ORDER BY e.created_at ASC,e.event_id ASC LIMIT $2
 ), removed AS (
  DELETE FROM public.litix_boostero_sync_events old
   USING doomed WHERE old.event_id=doomed.event_id
   RETURNING old.event_id
 ) SELECT count(*)::integer AS deleted FROM removed`,[d,cap]);
 return {days:d,deleted:Number(rows[0]?.deleted||0),batchLimit:cap,
  customerRecordsChanged:0,criticalIncidentEventsPreserved:true};
}
