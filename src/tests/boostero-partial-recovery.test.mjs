import test from "node:test";
import assert from "node:assert/strict";
import {reconciledMultiPostState} from "../lib/boosteroPartialRecovery.mjs";
import {normalizeBoosteroStatus} from "../lib/boosteroStatusBatch.mjs";
test("existing supplier partial does not automatically reopen or repurchase",()=>{
 for(const raw of [
  {status:"Partial",remains:888},
  {status:"In progress",remains:860},
  {status:"Pending",remains:860},
  {status:"Completed",remains:888},
  {status:"Completed"}]){
  assert.equal(reconciledMultiPostState("MANUAL_REVIEW",normalizeBoosteroStatus(raw)),"MANUAL_REVIEW");
 }
});
test("verified complete with zero remains is the ONLY automatic review recovery",()=>{
 assert.equal(reconciledMultiPostState("MANUAL_REVIEW",normalizeBoosteroStatus({status:"Completed",remains:0})),"COMPLETED");
 assert.equal(reconciledMultiPostState("SUBMITTED",normalizeBoosteroStatus({status:"Completed",remains:0})),"COMPLETED");
 assert.equal(reconciledMultiPostState("SUBMITTED",normalizeBoosteroStatus({status:"Partial",remains:888})),"MANUAL_REVIEW");
 assert.equal(reconciledMultiPostState("SUBMITTED",normalizeBoosteroStatus({status:"Completed",remains:null})),"MANUAL_REVIEW");
});
test("recovery worker retains only status/read-only actions and original supplier ids",async()=>{
 const {readFileSync}=await import("node:fs");
 const src=readFileSync(new URL("../lib/boosteroMultiPostFulfillment.mjs",import.meta.url),"utf8");
 const start=src.indexOf("export async function syncBoosteroMultiStatuses");
 const end=src.indexOf("// Scheduled continuation",start);
 const sync=src.slice(start,end);
 assert.match(sync,/state in \('SUBMITTED','MANUAL_REVIEW'\)/);
 assert.match(sync,/reconciledMultiPostState\(item.state,snapshot\)/);
 assert.match(sync,/operation\("status"/);
 assert.doesNotMatch(sync,/operation\("(?:add|cancel|refill)"/);
 assert.doesNotMatch(sync,/dispatchBoostero/);
 assert.match(sync,/supplier_order_id=\$3/);
});
