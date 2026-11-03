import {randomUUID} from "node:crypto";
import {db} from "./db.js";
import {balanceCents,notifyAlert} from "./provider.js";
import {dispatchQueue,syncOpen,quarantineLostReceipts,reconcileMissingCredits} from "./engine.js";

export async function runWarriorCycle() {
  const owner=randomUUID();
  const sql='INSERT INTO "CronLease" ("key","holder","expiresAt") '+
    "VALUES ('warrior',$1,now()+interval '110 seconds') "+
    'ON CONFLICT ("key") DO UPDATE SET "holder"=EXCLUDED."holder",'+
    '"expiresAt"=EXCLUDED."expiresAt" WHERE "CronLease"."expiresAt" < now() RETURNING "key"';
  const lease=await db.$queryRawUnsafe<Array<{key:string}>>(sql,owner);
  if(!lease.length)return {acquired:false};
  try {
    const suppliers=await db.supplier.findMany({where:{approved:true,state:{not:"INACTIVE"}}});
    const balances=await Promise.allSettled(suppliers.map(async s=>{
      try {
        const cents=await balanceCents(s), low=cents<5000;
        await db.supplier.update({where:{id:s.id},data:{
          walletBalanceCents:cents,balanceCheckedAt:new Date(),failures:0,
          state:low?"DEGRADED":"ACTIVE",circuitUntil:null}});
        if(low)await notifyAlert("SUPPLIER_LOW_BALANCE",{supplier:s.id,cents}).catch(()=>{});
        return {supplier:s.id,ok:!low};
      }catch {
        const failures=s.failures+1;
        await db.supplier.update({where:{id:s.id},data:{
          failures,state:failures>=3?"DEGRADED":s.state,
          circuitUntil:failures>=3?new Date(Date.now()+15*60*1000):s.circuitUntil}});
        if(failures>=3)await notifyAlert("SUPPLIER_FAILURE",{supplier:s.id}).catch(()=>{});
        return {supplier:s.id,ok:false};
      }
    }));
    const [quarantined,synced,dispatched,credits]=await Promise.allSettled([
      quarantineLostReceipts(),syncOpen(12),dispatchQueue(4),reconcileMissingCredits()
    ]);
    return {acquired:true,
      balances:balances.map(x=>x.status==="fulfilled"?x.value:{ok:false}),
      quarantined:quarantined.status==="fulfilled"?quarantined.value:null,
      synced:synced.status==="fulfilled"?synced.value:null,
      dispatched:dispatched.status==="fulfilled"?dispatched.value:null,
      credits:credits.status==="fulfilled"?credits.value:null,
      failedTasks:[quarantined,synced,dispatched,credits].filter(x=>x.status==="rejected").length};
  } finally {
    await db.cronLease.deleteMany({where:{key:"warrior",holder:owner}}).catch(()=>{});
  }
}
