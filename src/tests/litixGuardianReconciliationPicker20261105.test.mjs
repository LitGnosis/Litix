import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {mapOwnerTriage,loadGuardianOwnerTriage} from "../lib/guardianTriage.mjs";

import {regularOrderHealthSignal,multiPostHealthSignal,paymentOutboxHealthSignal} from "../lib/guardianSignals.mjs";

const oldId="ltx_4eaa0734-4d5f-47f8-b86c-ecfad400407d";
const v2Id="ltx2_29b23819-db7a-46b8-8d74-aee4589f70c2";

test("Previously fulfilled PayKings event is actionable but NOT silently cleared",()=>{
 const items=mapOwnerTriage("outbox",[{
  order_id:oldId,supplier_order_id:"1604221",created_at:"2026-10-19T04:30:00Z",
  settled_match:true,supplier_match:true,notification_sent:true,supplier_fulfillment_state:"completed"
 }]);
 assert.equal(items.length,1);
 assert.equal(items[0].orderId,oldId);
 assert.equal(items[0].code,"SETTLED_EVENT_ALREADY_REFLECTED");
 assert.match(items[0].action,/audit.*mark the EVENT processed/i);
 assert.doesNotMatch(JSON.stringify(items),/token|email|gateway_transaction_id|card_number/);
});
test("A paid outbox event without supplier delivery cannot be hidden",()=>{
 const r=mapOwnerTriage("outbox",[{
  order_id:"ltx_b26ad791-ffc5-47ed-936a-d79a1d543488",
  supplier_order_id:null,settled_match:true,supplier_match:true,
  notification_sent:false,supplier_fulfillment_state:"pending"
 }]);
 assert.equal(r[0].code,"SETTLED_EVENT_NEEDS_RECONCILIATION");
 assert.match(r[0].action,/do not clear event or repurchase/);
 assert.equal(paymentOutboxHealthSignal({pending:1}).ok,false);
});
test("Older orders with no established provider remain historical, not reassigned Boostero",()=>{
 const items=mapOwnerTriage("legacy",[
  {order_id:"ltx2_f4d0f584-060b-412c-a088-e64bd48f2a77",
   supplier_order_id:"1691102",supplier_code:null,created_at:"2026-10-25T21:31:56Z"},
  {order_id:v2Id,supplier_order_id:null,supplier_code:"boostero"}
 ]);
 assert.equal(items.length,2);
 assert.equal(items[0].code,"HISTORICAL_PAID_ORDER_UNRESOLVED");
 assert.match(items[0].action,/never dispatch to Boostero as a replacement/);
 assert.equal(items[1].code,"BOOSTERO_PAID_ORDER_UNRESOLVED");
 assert.equal(regularOrderHealthSignal({stale:0,unresolved:2,overdue:5}).ok,false);
 assert.equal(multiPostHealthSignal({stale:0,unresolved:5,queued:0}).ok,false);
});
test("Admin reconciliation runs only SELECT statements and bounds all results",async()=>{
 const queries=[];
 const sql={query:async q=>{
  queries.push(q);
  assert.match(q.trim(),/^select /i);
  assert.doesNotMatch(q,/insert into|update public|delete from|truncate|boosteroProduction\(/i);
  if(q.includes("from public.litix_paykings_outbox"))return [{
   order_id:oldId,supplier_order_id:"1604221",
   settled_match:true,supplier_match:true,notification_sent:true,supplier_fulfillment_state:"completed"
  }];
  return [];
 }};
 const result=await loadGuardianOwnerTriage(sql);
 assert.equal(result.readOnly,true);
 assert.equal(result.unavailableChecks,0);
 assert.equal(result.items.length,1);
 assert.equal(result.items[0].code,"SETTLED_EVENT_ALREADY_REFLECTED");
 assert.equal(queries.length,7);
});
test("Owner triage refuses malformed ID and does not expose customer PII",()=>{
 const rows=[
  {order_id:"invalid",supplier_order_id:"1604221",email:"private@example.com"},
  {order_id:oldId,supplier_order_id:"1604221",email:"private@example.com"}
 ];
 const out=mapOwnerTriage("outbox",rows);
 assert.equal(out.length,1);
 assert.doesNotMatch(JSON.stringify(out),/private@example.com/);
});
test("Choose Your Posts manual and TikTok gallery entries stay verifiable without payment",()=>{
 const chooser=readFileSync(new URL("../components/SocialMultiPostChooser.jsx",import.meta.url),"utf8");
 const hub=readFileSync(new URL("../components/LitixCustomHub.jsx",import.meta.url),"utf8");
 const checkout=readFileSync(new URL("../app/page.jsx",import.meta.url),"utf8");
 const pickerRoute=readFileSync(new URL("../app/api/post-picker/route.js",import.meta.url),"utf8");
 const sample="https://www.tiktok.com/@litgnosis/video/7502974458643090734";
 const factory=readFileSync(new URL("../components/TikTokMultiPostChooser.jsx",import.meta.url),"utf8");
 assert.match(factory,/verifiedInput:verifiedUrl\?link\.trim\(\):""/);
 assert.match(factory,/status:verifiedUrl\?"verified":"idle"/);
 assert.match(chooser,/newTikTokPost\(\{link:post\.url,quantity:minimum,verifiedUrl:post\.url\}\)/);
 assert.match(chooser,/Choose Your Posts/);
 assert.match(chooser,/lastAutomaticLookup\.current=""/);
 assert.match(chooser,/posts\.length<5/);
 assert.match(chooser,/add direct post links below/i);
 assert.match(hub,/sessionStorage\.setItem\(CUSTOM_DRAFT_PREFIX/);
 assert.match(hub,/&draft=/);
 assert.match(checkout,/SocialMultiPostChooser/);
 assert.match(pickerRoute,/LITIX_POST_PICKER_ENABLED/);
 assert.doesNotMatch(chooser,/card_purchase|Boostero.*add/);
});
