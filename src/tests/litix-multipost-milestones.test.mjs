import test from "node:test";
import assert from "node:assert/strict";
import {multiPostMilestone} from "../lib/litixMultiPostMilestones.mjs";
import {queueMultiPostDeliveryMilestone} from "../lib/litixCustomerUpdates.mjs";
const id="ltx2_12345678-1234-4234-8234-123456789abc";
const children=(remains,state="SUBMITTED")=>remains.map(x=>({
 quantity:100,state,supplier_status:{status:state==="COMPLETED"?"Completed":state==="PENDING"?"Pending":"In progress",remains:x}
}));
test("five-post delivery email sends only start, 25/50/75% and completion milestones",()=>{
 const a=children([98,98,99,99,99]);
 assert.equal(multiPostMilestone(a).phase,"started");
 assert.equal(multiPostMilestone(children([75,75,75,75,75])).phase,"25");
 assert.equal(multiPostMilestone(children([50,50,50,50,50])).phase,"50");
 assert.equal(multiPostMilestone(children([25,25,25,25,25])).phase,"75");
 assert.deepEqual(multiPostMilestone(children([0,0,0,0,0],"COMPLETED")).phase,"complete");
});
test("unknown supplier count is never presented as confirmed zero",()=>{
 const a=children([null,70,90,90,90]);
 assert.equal(multiPostMilestone(a).remaining,null);
 assert.equal(multiPostMilestone(children([100,100,100,100,100],"PENDING")),null);
 assert.equal(multiPostMilestone(children([70,70],"MANUAL_REVIEW")).phase,"needs_support");
});
test("durable milestone queue deduplicates and authenticates paid parent in SQL",async()=>{
 let seen=null;const writes=[];const sql={query:async(query,args)=>{
  assert.match(query,/payment_state='paid'/);
  assert.match(query,/on conflict\(order_id,fingerprint\) do nothing/);
  writes.push(args);
  if(args[2]===seen)return [];
  seen=args[2];return [{id:"event-1"}];
 }};
 const a=children([90,90,90,90,90]);
 assert.equal(await queueMultiPostDeliveryMilestone({sql,orderId:id,children:a}),true);
 assert.equal(await queueMultiPostDeliveryMilestone({sql,orderId:id,children:a}),false);
 assert.equal(writes[0][2],writes[1][2]);
 assert.equal(writes[0][0],id);
 assert.equal(JSON.parse(writes[0][3]).total,500);
});
