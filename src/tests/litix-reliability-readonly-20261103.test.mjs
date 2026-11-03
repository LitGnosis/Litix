import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {readExistingBoosteroStatuses,normalizeBoosteroStatus} from "../lib/boosteroStatusBatch.mjs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const IDS=["12977366","12977367","12977368","12977369","12977370"];

test("supplier status lookup uses one read-only batch when available",async()=>{
 const calls=[];
 const response=Object.fromEntries(IDS.map(id=>[id,{status:"Canceled",remains:"15"}]));
 const result=await readExistingBoosteroStatuses(async(action,args)=>{
  calls.push({action,args});
  return response;
 },IDS);
 assert.equal(result.batched,1);
 assert.equal(calls.length,1);
 assert.equal(calls[0].action,"status");
 assert.deepEqual(calls[0].args,{orders:IDS});
 for(const id of IDS)assert.deepEqual(normalizeBoosteroStatus(result.byId.get(id)),{status:"Canceled",remains:15});
});

test("incompatible batch falls back to status-only calls with bounded concurrency",async()=>{
 let active=0,maxActive=0;
 const calls=[];
 const result=await readExistingBoosteroStatuses(async(action,args)=>{
  calls.push({action,args});
  assert.equal(action,"status");
  if(args.orders)throw Error("provider does not support batch");
  active++;maxActive=Math.max(active,maxActive);
  await new Promise(resolve=>setTimeout(resolve,5));
  active--;
  return {status:"Canceled",remains:args.order==="12977366"?0:null};
 },IDS,{concurrency:3});
 assert.equal(result.batched,0);
 assert.equal(result.byId.size,5);
 assert.equal(calls.length,6); // one batch + five existing order reads
 assert.ok(maxActive<=3);
 assert.ok(maxActive>=2);
 for(const id of IDS)assert.equal(result.byId.get(id)?.status,"Canceled");
 assert.ok(calls.every(x=>x.action==="status"));
});

test("unknown status stays unknown, malformed IDs never hit provider",async()=>{
 const result=await readExistingBoosteroStatuses(async(_action,args)=>{
  if(args.orders)throw Error("unavailable batch");
  if(args.order==="12977368")throw Error("temporary status timeout");
  return {status:"Pending"};
 },IDS);
 assert.equal(result.byId.get("12977368"),null);
 const fn=async()=>{throw Error("SHOULD_NOT_CALL")};
 await assert.rejects(()=>readExistingBoosteroStatuses(fn,["123","invalid"]),/boostero_batch_ids_invalid/);
});

test("catalog read routes cache only public availability data and keep failures uncacheable",()=>{
 const v1=read("app/api/catalog/v1/route.js");
 const choices=read("app/api/catalog/checkout-choices/route.js");
 const global=read("app/api/catalog/global/route.js");
 for(const s of [v1,choices,global]){
  assert.match(s,/s-maxage=30/);
  assert.match(s,/stale-while-revalidate=60/);
  assert.match(s,/no-store/);
  assert.doesNotMatch(s,/paymentToken|NMI_SECURITY_KEY|tracking_token_hash/);
 }
 assert.match(v1,/data\.allCount>0/);
 assert.match(choices,/if\(!choices\.items\.length\)/);
 assert.match(global,/sourceStatus:snapshot\.status/);
});

test("supplier status worker is bounded and cannot submit duplicates",()=>{
 const cron=read("app/api/internal/boostero/cron/route.js");
 const multipost=read("lib/boosteroMultiPostFulfillment.mjs");
 assert.match(cron,/syncBoosteroMultiStatuses\(\{limit:5\}\)/);
 assert.match(multipost,/readExistingBoosteroStatuses\(operation,ids,\{concurrency:3\}\)/);
 assert.match(multipost,/state in \('SUBMITTED','MANUAL_REVIEW'\)/);
 assert.match(multipost,/supplier_order_id is not null/);
});
