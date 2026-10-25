import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const src=readFileSync(new URL("../app/api/account/autolikes/route.js",import.meta.url),"utf8")
 .replace('import { neon } from "@neondatabase/serverless";','const neon=()=>({query:globalThis.__litixSql});')
 .replace('import { authenticatedCustomer, customerAuthConfigured } from "../../../../lib/customerAuth.js";','const authenticatedCustomer=async()=>globalThis.__litixUser;const customerAuthConfigured=()=>globalThis.__litixEnabled;')
 .replace('import { accountDatabaseURL, fetchLikesServices, presentLikesService, draftPayload } from "../../../../lib/autolikes.mjs";',`const accountDatabaseURL=()=> "fake-in-memory";
 const fetchLikesServices=async()=>globalThis.__litixServices;
 const presentLikesService=s=>({id:String(s.service),name:s.name,min:s.min,max:s.max,per1000:7});
 const draftPayload=(raw,services)=>({ok:true,platform:raw.platform,target:raw.target,serviceId:String(raw.serviceId),quantityPerPost:raw.quantityPerPost,maxPostsPerMonth:raw.maxPostsPerMonth,oneTimeEstimateCents:700});`);
const mod=await import("data:text/javascript;base64,"+Buffer.from(src).toString("base64"));
const url="https://qa.litix.net/api/account/autolikes";
const userA={id:"auth0|customer-a",email:"a@example.test",name:"A"},userB={id:"auth0|customer-b",email:"b@example.test",name:"B"};
function req(method,body,origin="https://qa.litix.net"){return new Request(url,{method,headers:{...(method!=="GET"?{"content-type":"application/json",...(origin?{origin}:{})}:{} )},body:method==="GET"?undefined:JSON.stringify(body)})}
const rows=new Map();
globalThis.__litixServices=[{service:33588,name:"Instagram Likes",min:100,max:50000}];
globalThis.__litixEnabled=true;globalThis.__litixUser=userA;
globalThis.__litixSql=async(sql,p)=>{
 if(sql.startsWith("select count(*)"))return [{total:[...rows.values()].filter(x=>x.customer_id===p[0]&&["draft","paused"].includes(x.status)).length}];
 if(sql.startsWith("select id,customer_id")&&sql.includes("where id=$1 and customer_id=$2")){const row=rows.get(p[0]);return row&&row.customer_id===p[1]?[row]:[]}
 if(sql.startsWith("select id,customer_id")&&sql.includes("where id=$1"))return rows.has(p[0])?[rows.get(p[0])]:[];
 if(sql.startsWith("select id,platform,account_ref")&&sql.includes("where customer_id=$1"))return [...rows.values()].filter(x=>x.customer_id===p[0]);
 if(sql.startsWith("insert into")){
  const [id,customer_id,email,platform,account_ref,service_catalog_id,quantity_per_post,max_posts_per_month]=p;
  if(rows.has(id))return [];
  const row={id,customer_id,email,platform,account_ref,service_catalog_id,quantity_per_post,max_posts_per_month,status:"draft",created_at:"2026-10-25T00:00:00Z",next_check_at:null,posts_processed_this_month:0};
  rows.set(id,row);return [row];
 }
 if(sql.startsWith("update litix_auto_boost_campaigns")){
  const [id,userId,v3,v4,v5]=p;const row=rows.get(id);
  if(!row||row.customer_id!==userId||!["draft","paused"].includes(row.status))return [];
  if(sql.includes("set status=$3"))row.status=v3;else{row.account_ref=v3;row.quantity_per_post=v4;row.max_posts_per_month=v5}
  row.next_check_at=null;return [row];
 }
 throw Error("Unexpected SQL: "+sql);
};

test("Autolikes unauthenticated requests fail closed",async()=>{
 globalThis.__litixEnabled=false;
 const response=await mod.GET(req("GET"));assert.equal(response.status,503);
 globalThis.__litixEnabled=true;globalThis.__litixUser=null;
 const missing=await mod.GET(req("GET"));assert.equal(missing.status,401);
 globalThis.__litixUser=userA;
});
test("POST blocks cross-site requests before writing",async()=>{
 const input={platform:"instagram",target:"@testuser",serviceId:"33588",quantityPerPost:1000,maxPostsPerMonth:12,requestKey:"a36a09b5-6d0b-4b1e-8b3f-48faf9da375d"};
 const denied=await mod.POST(req("POST",input,"https://attacker.test"));assert.equal(denied.status,403);assert.equal(rows.size,0);
 const missing=await mod.POST(req("POST",input,null));assert.equal(missing.status,403);assert.equal(rows.size,0);
});
test("POST saves draft once and never sends payment or supplier requests",async()=>{
 const payload={platform:"instagram",target:"@testing",serviceId:"33588",quantityPerPost:1000,maxPostsPerMonth:10,requestKey:"a36a09b5-6d0b-4b1e-8b3f-48faf9da375d"};
 const created=await mod.POST(req("POST",payload));assert.equal(created.status,201);
 const data=await created.json();assert.equal(data.campaign.status,"draft");assert.equal(rows.size,1);
 const repeated=await mod.POST(req("POST",payload));assert.equal(repeated.status,200);assert.equal((await repeated.json()).reused,true);assert.equal(rows.size,1);
});
test("GET cannot disclose another customer's drafts; PATCH enforces ownership",async()=>{
 const id=[...rows.keys()][0];
 globalThis.__litixUser=userB;
 const listing=await mod.GET(req("GET"));assert.equal(listing.status,200);assert.equal((await listing.json()).campaigns.length,0);
 const attempt=await mod.PATCH(req("PATCH",{id,action:"cancel"}));assert.equal(attempt.status,404);
 assert.equal(rows.get(id).status,"draft");
 globalThis.__litixUser=userA;
});
test("PATCH pause/resume/discard cannot activate supplier delivery or billing",async()=>{
 const id=[...rows.keys()][0];
 for(const [action,status] of [["pause","paused"],["resume","draft"],["cancel","cancelled"]]){
  const res=await mod.PATCH(req("PATCH",{id,action}));
  assert.equal(res.status,200);
  const body=await res.json();
  assert.equal(body.campaign.status,status);assert.equal(body.charged,false);assert.equal(body.fulfillmentTriggered,false);
 }
 const denied=await mod.PATCH(req("PATCH",{id,action:"resume"}));assert.equal(denied.status,409);
});
