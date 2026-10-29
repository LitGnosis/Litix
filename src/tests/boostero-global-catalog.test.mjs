import test from "node:test";
import assert from "node:assert/strict";
import {normalizeBoosteroService,normalizeBoosteroCatalog} from "../lib/boosteroGlobalCatalog.mjs";
import {importBoosteroInventory} from "../lib/boosteroInventorySync.mjs";
const service=(id,overrides={})=>({
 service:id,name:"Instagram Followers - Premium",type:"Default",category:"Instagram Followers",
 rate:"2.50",min:"10",max:"20000",refill:false,cancel:true,...overrides
});
test("normalizes provider catalog without hardcoded count or wholesale leakage into public view",()=>{
 const rows=[
  service(5461),
  service(9001,{name:"YouTube Views",category:"YouTube",rate:"0.99",dripfeed:true}),
  service(9002,{name:"Telegram Custom Comments",type:"Custom Comments",category:"Telegram"}),
  service(9003,{name:"Discord members",category:"Discord"}),
  service(9004,{name:"Auto Likes Instagram",type:"Subscriptions",category:"Instagram"}),
  service(9005,{name:"Rumble views",category:"Rumble"}),
  service(9006,{rate:"invalid"}),
  service(9007,{min:"-1"}),
 ];
 const {stats,items}=normalizeBoosteroCatalog(rows);
 assert.equal(stats.retrieved,8);assert.equal(stats.valid,6);assert.equal(stats.invalid,2);
 assert.equal(items.find(x=>x.id==="5461").supportedInputShape,true);
 assert.equal(items.find(x=>x.id==="9001").platform,"YouTube");
 assert.equal(items.find(x=>x.id==="9001").dripfeed,true);
 assert.equal(items.find(x=>x.id==="9001").requiresImplementation,true);
 assert.equal(items.find(x=>x.id==="9002").kind,"custom_comments");
 assert.equal(items.find(x=>x.id==="9004").requiresImplementation,true);
 assert.equal(stats.platforms.Rumble,1);
});
test("rejects zero, nonnumeric and invalid service limits",()=>{
 assert.equal(normalizeBoosteroService(service("abc")),null);
 assert.equal(normalizeBoosteroService(service(99,{rate:0})),null);
 assert.equal(normalizeBoosteroService(service(99,{max:1,min:2})),null);
});
test("full inventory import is disabled for small or malformed snapshots",async()=>{
 let writes=0;
 const sql={query:async()=>{writes++;return [];}};
 await assert.rejects(()=>importBoosteroInventory(sql,[service(1)]),/snapshot_incomplete/);
 assert.equal(writes,0);
});
test("full inventory import does not enable public services or write orders",async()=>{
 const calls=[];
 const sql={query:async(text,params=[])=>{
  calls.push({text,params});
  return text.startsWith("select count")?[{n:0,last_sync:null}]:[{imported:140,marked_unavailable:0,audit_records:1}];
 }};
 const list=Array.from({length:140},(_,i)=>service(6000+i));
 const out=await importBoosteroInventory(sql,list,{now:new Date("2026-10-28T12:00:00Z"),force:true});
 assert.equal(out.imported,140);
 assert.equal(out.publicNewServicesEnabled,0);
 assert.equal(calls.filter(x=>x.text.includes("INSERT INTO public.litix_boostero_inventory(")).length,1);
 assert.ok(calls.some(x=>x.text.includes("WITH incoming AS MATERIALIZED")));
 assert.ok(calls.every(x=>!/\b(insert|update|delete)\s+(?:into\s+)?(?:public\.)?(litix_v2_orders|litix_boostero_services|litix_growth_bundle_orders|litix_paykings_checkout_orders)\b/i.test(x.text)));
 assert.ok(calls.every(x=>!x.text.includes("delete from")));
 assert.ok(calls.some(x=>x.text.includes("UPDATE public.litix_boostero_inventory AS old")));
 assert.equal(out.atomicCommitVerified,true);
});
test("supplier snapshot shrink fails closed before writes",async()=>{
 let calls=0;const sql={query:async()=>{calls++;return [{n:2000,last_sync:null}]}};
 const list=Array.from({length:140},(_,i)=>service(8000+i));
 await assert.rejects(()=>importBoosteroInventory(sql,list,{force:true}),/catalog_shrink/);
 assert.equal(calls,1);
});
