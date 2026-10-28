import test from "node:test";
import assert from "node:assert/strict";
import {restrictedSocialKind,legacyPublicServiceAllowed} from "../lib/publicBoosteroOnly.mjs";
import {boosteroCompatibleServices,boosteroProduction} from "../lib/boosteroReadOnly.mjs";
import {boosteroQuote,boosteroDestination} from "../lib/boosteroFulfillment.mjs";
import {readFileSync} from "node:fs";
const saved=Object.fromEntries(["VERCEL_ENV","LITIX_BOOSTERO_ENABLED","BOOSTERO_API_KEY","BOOSTERO_API_URL","LITIX_BOOSTERO_DATABASE_URL"].map(x=>[x,process.env[x]]));
function enable(){Object.assign(process.env,{VERCEL_ENV:"production",LITIX_BOOSTERO_ENABLED:"true",BOOSTERO_API_URL:"https://boostero.com/api/v2",BOOSTERO_API_KEY:"TEST_KEY_ONLY",LITIX_BOOSTERO_DATABASE_URL:"postgres://example.invalid/test"})}
function restore(){for(const [k,v] of Object.entries(saved))v===undefined?delete process.env[k]:process.env[k]=v}
const samples=[
 {service:5461,name:"Instagram Followers Premium No Refill",category:"Instagram - Followers",type:"Default",rate:3,min:10,max:500000},
 {service:4751,name:"Instagram Likes Medium Quality Non Drop",category:"Instagram - Likes",type:"Default",rate:0.147,min:100,max:1000000},
 {service:5101,name:"TikTok Followers Low Quality No Refill",category:"TikTok - Followers",type:"Default",rate:2.095,min:10,max:1000000},
 {service:5251,name:"TikTok Likes High Quality No Refill",category:"TikTok - Likes",type:"Default",rate:0.68,min:10,max:100000},
 {service:2263,name:"Instagram Story Views",category:"Instagram Story Views & Likes",type:"Default",rate:0.005,min:10,max:10000},
 {service:5492,name:"TikTok Story Likes",category:"TikTok Story Likes",type:"Default",rate:0.63,min:10,max:30000},
 {service:1596,name:"TikTok Comment Likes",category:"TikTok - Comments",type:"Comment Likes",rate:0.431,min:10,max:100000},
];
const mapping=[
 ["5461","instagram","followers",1500,3],
 ["4751","instagram","likes",699,0.147],
 ["5101","tiktok","followers",1499,2.095],
 ["5251","tiktok","likes",699,0.68]
];
test("only four verified ordinary post-service kinds; never classify story/live/comment likes or story views as eligible",()=>{
 const items=boosteroCompatibleServices(samples);
 assert.deepEqual(items.map(x=>x.id),["5461","4751","5101","5251"]);
 assert.deepEqual(items.map(x=>x.kind),["followers","likes","followers","likes"]);
 assert.equal(items[1].apiRefillEligible,false);
 for(const bad of samples.slice(4))assert.equal(items.some(x=>x.id===String(bad.service)),false);
});
test("SMMGLOB numeric card detection covers all four targeted categories only",()=>{
 enable();try{
  for(const s of samples.slice(0,4))assert.ok(restrictedSocialKind(s));
  assert.equal(legacyPublicServiceAllowed({name:"IG 📸 Followers Instant",category:"Instagram Followers"}),false);
  assert.equal(legacyPublicServiceAllowed({name:"TikTok Likes High Quality",category:"TikTok Likes"}),false);
  assert.equal(legacyPublicServiceAllowed({name:"TikTok Views",category:"TikTok Views"}),true);
  assert.equal(legacyPublicServiceAllowed({name:"Instagram Story Views",category:"Instagram Story Views & Likes"}),true);
  assert.equal(legacyPublicServiceAllowed({name:"YouTube Likes",category:"YouTube"}),true);
 }finally{restore()}
});
test("all four allowlisted services preserve marked retail, $5 checkout minimum, current wholesale ceilings",()=>{
 const rows=boosteroCompatibleServices(samples);
 for(const [id,platform,kind,retail,cost] of mapping){
  const svc=rows.find(s=>s.id===id);
  const allow={supplier_service_id:id,platform,service_kind:kind,retail_per_1000_cents:retail,wholesale_ceiling_per_1000:cost,enabled:true};
  const qty=id==="5101"?478:id==="5461"?334:716;
  const quote=boosteroQuote({service:svc,approved:allow,quantity:qty});
  assert.equal(quote.kind,kind);assert.equal(quote.retailPer1000Cents,retail);
  assert.ok(quote.amountCents>=500);
  assert.throws(()=>boosteroQuote({service:svc,approved:{...allow,enabled:false},quantity:qty}),/not_approved/);
  assert.throws(()=>boosteroQuote({service:svc,approved:{...allow,service_kind:kind==="likes"?"followers":"likes"},quantity:qty}),/mapping_changed/);
  assert.throws(()=>boosteroQuote({service:{...svc,wholesalePer1000USD:cost+0.01},approved:allow,quantity:qty}),/wholesale_changed/);
 }
 const tik=rows.find(s=>s.id==="5101");
 const allow={supplier_service_id:"5101",platform:"tiktok",service_kind:"followers",retail_per_1000_cents:1499,wholesale_ceiling_per_1000:2.095,enabled:true};
 assert.throws(()=>boosteroQuote({service:tik,approved:allow,quantity:334}),/five_dollar_or_margin_floor/);
});
test("Likes accept ONLY direct canonical Instagram post/reel and TikTok video; Followers never accept posts",()=>{
 assert.equal(boosteroDestination("https://instagram.com/p/ABCdef123/","instagram","likes"),"https://www.instagram.com/p/ABCdef123/");
 assert.equal(boosteroDestination("https://www.instagram.com/reel/ABCdef123/","instagram","likes"),"https://www.instagram.com/reel/ABCdef123/");
 assert.equal(boosteroDestination("https://www.tiktok.com/@litixsocial/video/7463829101526372818","tiktok","likes"),"https://www.tiktok.com/@litixsocial/video/7463829101526372818");
 for(const invalid of ["@litixsocial","https://instagram.com/litixsocial/","https://instagram.com/p/ABCdef123/?igsh=test","https://evil.test/p/ABCdef123","https://www.instagram.com/stories/litixsocial/12345"]){
  assert.equal(boosteroDestination(invalid,"instagram","likes"),null);
 }
 assert.equal(boosteroDestination("https://instagram.com/p/ABCdef123/","instagram","followers"),null);
 assert.equal(boosteroDestination("https://www.tiktok.com/@litixsocial/video/7463829101526372818","tiktok","followers"),null);
});
test("public legacy checkout restricts four targeted kinds before card charge, without changing payment integration",()=>{
 const route=readFileSync(new URL("../app/api/[action]/route.js",import.meta.url),"utf8");
 const at=route.indexOf("if(!legacyPublicServiceAllowed(service))");
 assert.ok(at>0);assert.ok(at<route.indexOf("const orderId=",at));
 assert.ok(at<route.indexOf("fetch(gatewayUrl",at));
 assert.ok(route.includes('smm("add",'));
 const cards=readFileSync(new URL("../app/api/catalog/v1/route.js",import.meta.url),"utf8");
 assert.ok(cards.includes("filterBoosteroCards"));
 const checkout=readFileSync(new URL("../app/api/checkout/v1/route.js",import.meta.url),"utf8");
 assert.ok(checkout.includes("boostero_"));
});
test("supplier API cannot add without durable claim and never accepts invalid action",async()=>{
 enable();try{
  await assert.rejects(boosteroProduction("add",{service:"5251",link:"https://www.tiktok.com/@test/video/7463829101526372818",quantity:1000},{fetcher:async()=>{throw Error("NETWORK_UNEXPECTED")}}),/not_authorized/);
  await assert.rejects(boosteroProduction("cancel",{order:"1"}),/action_forbidden/);
 }finally{restore()}
});

test("four quick filters never call SMMGLOB and return only approved Boostero cards; absent service says temporarily unavailable",async()=>{
 const template=readFileSync(new URL("../app/api/catalog/v1/route.js",import.meta.url),"utf8");
 enable();
 let smmCalls=0;
 let active=true;
 const options={
  catalog:async()=>{smmCalls++;throw Error("SMMGLOB 525 MUST NOT BLOCK BOOSTERO-ONLY TAB")},
  cards:async()=>active?mapping.map(([id,platform,kind,retail])=>({
    id:"boostero_"+id,platform:platform==="instagram"?"Instagram":"TikTok",kind,
    category:(platform==="instagram"?"Instagram":"TikTok")+" "+(kind==="likes"?"Likes":"Followers"),per1000:retail/100
  })):[],
  filter:(all,p)=>all.filter(x=>(!p.get("kind")||x.kind===p.get("kind"))&&
     (!p.get("platform")||p.get("platform")==="All platforms"||x.platform===p.get("platform"))&&
     (!p.get("category")||x.category===p.get("category")))
 };
 globalThis.__fourKinds=options;
 try{
  const code=template.replace('import { GET as catalog } from "../../[action]/route.js";',
   "const catalog=globalThis.__fourKinds.catalog;")
   .replace('import {enabledBoosteroCards,filterBoosteroCards} from "../../../../lib/boosteroCatalog.mjs";',
    "const enabledBoosteroCards=globalThis.__fourKinds.cards;const filterBoosteroCards=globalThis.__fourKinds.filter;");
  const {GET}=await import("data:text/javascript,"+encodeURIComponent(code)+"#"+Date.now());
  for(const [id,platform,kind] of mapping){
   const res=await GET(new Request("https://litix.net/api/catalog/v1?platform="+(platform==="instagram"?"Instagram":"TikTok")+"&kind="+kind));
   assert.equal(res.status,200);
   const data=await res.json();
   assert.deepEqual(data.items.map(x=>x.id),["boostero_"+id]);
   assert.equal(data.boosteroOnly,true);
  }
  active=false;
  const res=await GET(new Request("https://litix.net/api/catalog/v1?platform=TikTok&kind=likes"));
  assert.equal((await res.json()).message,"Temporarily unavailable");
  assert.equal(smmCalls,0);
 }finally{delete globalThis.__fourKinds;restore()}
});
