import {boosteroSQL} from "../../../../lib/boosteroFulfillment.mjs";
import {ownerRequest,ownerResponse,safeOrigin} from "../../../../lib/ownerAuth.mjs";
import {readBoosteroSyncEvents,previewBoosteroRetention} from "../../../../lib/boosteroSyncEvents.mjs";
import {litixRecoveryEvidence} from "../../../../lib/litixRecoveryEvidence.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=45;
export async function GET(req){
 if(!ownerRequest(req))return ownerResponse({error:"Owner Auth0 session required"},401);
 if(!safeOrigin(req))return ownerResponse({error:"Invalid owner origin"},403);
 if(process.env.VERCEL_ENV!=="production")return ownerResponse({error:"production_only"},404);
 const query=new URL(req.url).searchParams;
 const page=Number(query.get("page")||1);
 if(!Number.isSafeInteger(page)||page<1||page>200)return ownerResponse({error:"invalid_page"},422);
 try{
  const sql=boosteroSQL();
  const [approved,orders,inventory,latest,retention]=await Promise.allSettled([
   sql.query(`select count(*)::integer as total,count(*) filter(where enabled)::integer as enabled
      from public.litix_boostero_services`),
   sql.query(`select
    count(*) filter(where payment_state='paid' and fulfillment_state in('not_started','queued','pending'))::integer as paid_awaiting,
    count(*) filter(where payment_state='paid' and fulfillment_state in('dispatching','processing','submitted','in_progress'))::integer as processing,
    count(*) filter(where payment_state='paid' and lower(fulfillment_state)='completed')::integer as completed,
    count(*) filter(where payment_state='paid' and fulfillment_state in('manual_review','failed','review'))::integer as recovery
    from public.litix_v2_orders`),
   sql.query(`select count(*)::integer as imported,
    count(*) filter(where active)::integer as active,
    count(*) filter(where validation_state='VERIFIED')::integer as verified,
    count(*) filter(where validation_state='PURCHASABLE')::integer as validated_purchasable,
    count(*) filter(where validation_state='UNSUPPORTED_TYPE')::integer as unsupported,
    count(*) filter(where validation_state='INVALID_METADATA')::integer as invalid,
    count(*) filter(where validation_state='PENDING_REVIEW')::integer as pending,
    max(refreshed_at) as last_sync
    from public.litix_boostero_inventory`),
   readBoosteroSyncEvents(sql,{page,pageSize:50}),
   previewBoosteroRetention(sql)
  ]);
  const val=(x)=>x.status==="fulfilled"?x.value:null;
  return ownerResponse({asOf:new Date().toISOString(),supplier:"boostero",
   recoveryEvidence:litixRecoveryEvidence(process.env),
   approvedServiceCount:val(approved)?.[0]||null,
   inventory:val(inventory)?.[0]||null,
   orderHealth:val(orders)?.[0]||null,
   log:val(latest)||{page,events:[],migrationPending:true},
   retentionPreview:val(retention)||{migrationPending:true,deletionEnabled:false},
   release:{backupVerified:process.env.LITIX_BOOSTERO_BACKUP_VERIFIED==="true",
    syncEnabled:process.env.LITIX_BOOSTERO_GLOBAL_SYNC_ENABLED==="true",
    typedPurchasingEnabled:process.env.LITIX_BOOSTERO_TYPED_ORDERS_ENABLED==="true"},
   unavailableSections:[["approvals",approved],["orders",orders],["inventory",inventory],
    ["events",latest],["retention",retention]].filter(([,v])=>v.status!=="fulfilled").map(([name])=>name),
   monitoringOnly:true,secretValuesNeverReturned:true});
 }catch{
  return ownerResponse({error:"Owner operations metrics temporarily unavailable"},503);
 }
}
export async function POST(){return ownerResponse({error:"Use authenticated private inventory sync endpoint"},405)}
