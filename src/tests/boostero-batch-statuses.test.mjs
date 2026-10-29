import test from "node:test";
import assert from "node:assert/strict";
import {mapBoosteroBatchStatus,syncBoosteroStatusesBatch} from "../lib/boosteroBatchStatuses.mjs";
test("status mappings preserve partial and canceled outcomes",()=>{
 assert.equal(mapBoosteroBatchStatus({status:"Partial"}).customer,"partial");
 assert.equal(mapBoosteroBatchStatus({status:"In progress"}).customer,"in_progress");
 assert.equal(mapBoosteroBatchStatus({status:"Completed"}).state,"COMPLETED");
 assert.equal(mapBoosteroBatchStatus({status:"Canceled"}).customer,"canceled");
 assert.equal(mapBoosteroBatchStatus({error:"Invalid order"}),null);
 assert.equal(mapBoosteroBatchStatus({status:"Unknown"}),null);
});

test("status batch records per-order errors and never issues supplier adds",async()=>{
 const queries=[],actions=[];
 const db={query:async(q,args)=>{
  queries.push({q,args});
  if(q.includes("select litix_order_id,supplier_order_id"))
   return [{litix_order_id:"ltx2_a",supplier_order_id:"101"},
           {litix_order_id:"ltx2_b",supplier_order_id:"102"}];
  if(q.includes("returning litix_order_id"))return [{litix_order_id:"ltx2_a"}];
  return [];
 }};
 const op=async(action,params)=>{actions.push({action,params});return {
  "101":{status:"Partial",remains:"40"},
  "102":{error:"Incorrect order ID"}
 }};
 const result=await syncBoosteroStatusesBatch({sql:db,operation:op,enabled:true});
 assert.equal(result.checked,1);
 assert.equal(result.failed,1);
 assert.equal(result.loggingFailures,0);
 assert.deepEqual(actions.map(x=>x.action),["status"]);
 assert.deepEqual(actions[0].params.orders,["101","102"]);
 const issues=queries.filter(x=>x.q.includes("error_code=$2"));
 assert.equal(issues.length,1);
 assert.deepEqual(issues[0].args[0],["102"]);
 assert.equal(issues[0].args[1],"supplier_status_item_unavailable");
});
test("batch network failure is logged without altering payment or submitting new orders",async()=>{
 const queries=[];
 const db={query:async(q,args)=>{
  queries.push({q,args});
  return q.includes("select litix_order_id")?[{litix_order_id:"ltx2_a",supplier_order_id:"123"}]:[];
 }};
 const result=await syncBoosteroStatusesBatch({sql:db,operation:async()=>{throw Error("sensitive network detail")},enabled:true});
 assert.equal(result.checked,0);
 assert.equal(result.failed,1);
 assert.equal(result.error,"supplier_status_batch_unavailable");
 assert.equal(queries.at(-1).args[1],"supplier_status_batch_unavailable");
 assert.doesNotMatch(queries.map(x=>x.q).join(" "),/update public\.litix_v2_orders set payment_state/);
});
