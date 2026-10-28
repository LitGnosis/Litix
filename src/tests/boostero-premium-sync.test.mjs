import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {syncPremiumCatalog} from "../lib/boosteroPremiumSync.mjs";
test("supplier sync is read-only and imports only eligible Default services as disabled, with bound JSON",async()=>{
 const queries=[];
 const sql={query:async(query,args)=>{queries.push({query,args});return []}};
 const raw=[
  {service:5461,name:"Instagram Premium Followers",category:"Instagram Followers",type:"Default",rate:3,min:10,max:500000,refill:false},
  {service:5251,name:"TikTok Likes",category:"TikTok Likes",type:"Default",rate:0.68,min:10,max:100000,refill:false},
  {service:9999,name:"Instagram Custom Comments",category:"Instagram",type:"Custom Comments",rate:1,min:10,max:1000}
 ];
 const result=await syncPremiumCatalog({raw,sql,batchSize:1});
 assert.deepEqual(result,{eligible:2,staged:2,purchasingEnabled:false});
 assert.equal(queries.length,2);
 assert.ok(queries.every(q=>q.query.includes("where public.litix_boostero_premium_catalog.enabled=false")));
 assert.ok(queries.every(q=>q.query.includes("jsonb_to_recordset($1::jsonb)")));
 const imported=queries.flatMap(q=>JSON.parse(q.args[0]));
 assert.deepEqual(imported.map(x=>x.id),["5461","5251"]);
 assert.equal(imported[0].wholesale,3);
 assert.equal(imported[0].retail,15);
 assert.ok(!JSON.stringify(imported).includes("BOOSTERO_API_KEY"));
});
test("empty or invalid catalog never overwrites existing mappings",async()=>{
 const sql={query:async()=>{throw Error("MUST NOT TOUCH DATABASE")}};
 await assert.rejects(syncPremiumCatalog({raw:[],sql}),/no_eligible_supplier_catalog/);
 await assert.rejects(syncPremiumCatalog({raw:"bad",sql}),/invalid_supplier_catalog/);
});
test("cron sync requires a server secret and production feature gate before supplier import",()=>{
 const s=readFileSync(new URL("../app/api/internal/premium/catalog-sync/route.js",import.meta.url),"utf8");
 assert.match(s,/timingSafeEqual/);
 assert.match(s,/LITIX_PREMIUM_BOOSTERO_LIVE/);
 assert.match(s,/boosteroReadOnly\("services"\)/);
 assert.doesNotMatch(s,/boosteroProduction\("add"/);
});
