import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {syncBoosteroStatuses} from "../lib/boosteroFulfillment.mjs";
const source=readFileSync(new URL("../app/api/catalog/v1/route.js",import.meta.url),"utf8");
const prev={VERCEL_ENV:process.env.VERCEL_ENV,LITIX_BOOSTERO_ENABLED:process.env.LITIX_BOOSTERO_ENABLED,
 BOOSTERO_API_KEY:process.env.BOOSTERO_API_KEY,BOOSTERO_API_URL:process.env.BOOSTERO_API_URL,LITIX_BOOSTERO_DATABASE_URL:process.env.LITIX_BOOSTERO_DATABASE_URL};
function setFlag(on=true){Object.assign(process.env,{VERCEL_ENV:"production",LITIX_BOOSTERO_ENABLED:String(on),BOOSTERO_API_KEY:"FAKE_KEY",BOOSTERO_API_URL:"https://boostero.com/api/v2",LITIX_BOOSTERO_DATABASE_URL:"postgresql://fake:fake@example.invalid/postgres"})}
function restore(){for(const [k,v] of Object.entries(prev))v===undefined?delete process.env[k]:process.env[k]=v}
const boosteroCard={id:"boostero_5461",name:"Instagram Followers No Refill",category:"Instagram Followers",platform:"Instagram",
 min:334,max:500000,per1000:15,startingAmountCents:501,purchasable:true};
function runCatalog(originalResponse,serviceCards=[boosteroCard]){
 const modified=source.replace('import { GET as catalog } from "../../[action]/route.js";',"const catalog=globalThis.__boosteroCatalogMock.catalog;")
 .replace('import {enabledBoosteroCards,filterBoosteroCards} from "../../../../lib/boosteroCatalog.mjs";',
  "const enabledBoosteroCards=globalThis.__boosteroCatalogMock.cards;const filterBoosteroCards=globalThis.__boosteroCatalogMock.filter;");
 globalThis.__boosteroCatalogMock={
  catalog:async()=>originalResponse,
  cards:async()=>serviceCards,
  filter:(cards,params)=>cards.filter(c=>!params.has("platform")||params.get("platform")===c.platform)
 };
 return import("data:text/javascript,"+encodeURIComponent(modified)+"#"+Math.random());
}
test("Boostero remains invisible when global rollout disabled; SMMGLOB response unchanged",async()=>{
 setFlag(false);
 try{
  const original=Response.json({items:[{id:"33559",name:"Old SMMGLOB service"}],total:1});
  const {GET}=await runCatalog(original);
  const res=await GET(new Request("https://litix.net/api/catalog/v1?platform=Instagram"));
  assert.equal(res,original);
  assert.equal((await res.json()).items[0].id,"33559");
 }finally{restore();delete globalThis.__boosteroCatalogMock}
});
test("SMMGLOB HTTP 525 / 503 fallback lists ONLY separately approved Boostero products and no invented SMMGLOB entries",async()=>{
 setFlag(true);
 try{
  const {GET}=await runCatalog(Response.json({error:"SMMGLOB 525"},{status:503}));
  const res=await GET(new Request("https://litix.net/api/catalog/v1?platform=Instagram&page=1"));
  assert.equal(res.status,200);
  const body=await res.json();
  assert.deepEqual(body.items.map(x=>x.id),["boostero_5461"]);
  assert.equal(body.total,1);assert.equal(body.supplierOutage,true);
  assert.equal(body.catalogStatus,"smmglob_unavailable");
  assert.equal(body.items[0].per1000,15);
  assert.ok(!JSON.stringify(body).includes("FAKE_KEY"));
 }finally{restore();delete globalThis.__boosteroCatalogMock}
});
test("Healthy catalog preserves numeric SMMGLOB products and appends only namespaced Boostero SKUs",async()=>{
 setFlag(true);
 try{
  const {GET}=await runCatalog(Response.json({items:[{id:"33559",per1000:12.89}],total:1,categories:["IG"]}));
  const data=await(await GET(new Request("https://litix.net/api/catalog/v1?platform=Instagram"))).json();
  assert.deepEqual(data.items.map(x=>x.id),["33559","boostero_5461"]);
  assert.equal(data.items[0].per1000,12.89);
  assert.equal(data.items[1].per1000,15);
 }finally{restore();delete globalThis.__boosteroCatalogMock}
});
test("supplier status sync updates Boostero AND matching customer order, without claiming zero remains means delivered",async()=>{
 setFlag(true);
 let calls=[];
 const sql={query:async(query,params=[])=>{
  calls.push({query,params});
  if(query.startsWith("select litix_order_id"))return [{litix_order_id:"ltx2_11111111-1111-4111-8111-111111111111",supplier_order_id:"987654",attempted_at:new Date().toISOString()}];
  return [];
 }};
 try{
  const operation=async(action,params)=>{
   assert.equal(action,"status");assert.equal(params.order,"987654");
   return {status:"Processing",remains:"0"};
  };
  const result=await syncBoosteroStatuses({sql,operation});
  assert.equal(result.checked,1);assert.equal(result.failed,0);
  const parent=calls.find(c=>c.query.startsWith("update public.litix_v2_orders"));
  assert.ok(parent,"generic Litix tracking table updated");
  assert.equal(parent.params[1],"987654");
  assert.equal(parent.params[2],"processing");
  assert.equal(JSON.parse(parent.params[3]).remains,"0");
  assert.equal(parent.query.includes("payment_state='paid'"),true);
  assert.ok(!calls.some(c=>/add|refill/.test(new URLSearchParams(c.query).get("action")||"")));
 }finally{restore()}
});
test("legacy email and order tracking lookup checks Boostero ownership BEFORE any SMMGLOB status query",()=>{
 const src=readFileSync(new URL("../app/api/[action]/route.js",import.meta.url),"utf8");
 const start=src.indexOf("async function refreshSupplierOrder");
 const end=src.indexOf("const truth =",start);
 const snippet=src.slice(start,end);
 assert.ok(snippet.includes("public.litix_boostero_fulfillment"));
 assert.ok(snippet.indexOf("select state,supplier_order_id")<snippet.indexOf('await smm("status"'));
 assert.ok(snippet.includes("if(provider.length)"));
 assert.ok(snippet.includes('return {live:false,warning:"Showing the last saved Boostero'));
});
