// Safe production smoke test: GETs and ONE intentionally invalid checkout request.
// No card token, no live payment, no supplier purchase, no authorization secrets.
import assert from "node:assert/strict";
const base="https://www.litix.net";
const results=[];
const http=async(path,options={})=>{
 const response=await fetch(base+path,{redirect:"follow",signal:AbortSignal.timeout(45000),cache:"no-store",...options});
 return response;
};
const check=async(name,action)=>{
 try{const description=await action();results.push({name,ok:true,description});console.log("PASS",name,description??"");}
 catch(error){results.push({name,ok:false});console.error("FAIL",name,String(error?.message||error).slice(0,280));}
};
for(const [path,phrase] of [
 ["/","Litix"],
 ["/shop/instagram/likes","Instagram Likes"],
 ["/shop/tiktok/likes","TikTok Likes"],
 ["/custom-likes","Custom Likes"],
 ["/track","Track your order"]
]){
 await check("GET "+path,async()=>{
  const r=await http(path,{headers:{accept:"text/html"}});
  assert.equal(r.status,200,"HTTP "+r.status);
  const text=await r.text();
  assert.ok(text.includes(phrase),"expected public page content unavailable");
  return "HTTP 200";
 });
}
await check("PayKings public readiness only",async()=>{
 const r=await http("/api/config",{headers:{accept:"application/json"}});
 assert.equal(r.status,200);
 const d=await r.json();
 assert.equal(d.ready,true,"gateway fields not ready; NO charge attempted");
 assert.ok(typeof d.publicKey==="string"&&d.publicKey.length>8,"public tokenization key missing");
 return "public tokenization configured; card transaction NOT tested";
});
await check("Bluevine published bundles readiness only",async()=>{
 const r=await http("/api/bundles",{headers:{accept:"application/json"}});
 assert.equal(r.status,200);
 const d=await r.json();
 assert.equal(d.bluevineEnabled,true,"bundle links not enabled");
 assert.ok(Array.isArray(d.packages)&&d.packages.length>=4);
 return "configured links available; settlement NOT tested";
});
for(const platform of ["Instagram","TikTok"]){
 await check("Catalog "+platform,async()=>{
  const params=new URLSearchParams({platform,kind:"likes",page:"1"});
  const r=await http("/api/catalog/v1?"+params,{headers:{accept:"application/json"}});
  assert.equal(r.status,200,"HTTP "+r.status);
  const data=await r.json();
  assert.ok(Array.isArray(data.items)&&data.items.length>0,"no eligible services");
  assert.ok(["live","cached"].includes(data.catalogStatus),"unverified catalog source");
  return data.items.length+" listings; source "+data.catalogStatus;
 });
}
await check("Invalid checkout rejected BEFORE payment",async()=>{
 // Service ID cannot pass the route's numeric ID guard. NO payment token
 // supplied and NO valid service selected; supplier cannot be contacted.
 const r=await http("/api/checkout/v1",{method:"POST",
  headers:{"content-type":"application/json","origin":base},
  body:JSON.stringify({serviceId:"invalid-safety-probe"})});
 assert.equal(r.status,409,"unsafe response HTTP "+r.status);
 const d=await r.json();
 assert.match(d.error||"",/No charge attempted/i);
 return "HTTP 409, no charge attempted";
});
await check("Unauthenticated supplier cron is closed",async()=>{
 const r=await http("/api/internal/boostero/cron",{headers:{accept:"application/json"}});
 assert.equal(r.status,401,"supplier cron should be private");
 return "HTTP 401";
});
const failures=results.filter(r=>!r.ok);
console.log("LITIX_READ_ONLY_SMOKE",JSON.stringify({checked:results.length,passed:results.length-failures.length,failed:failures.length}));
if(failures.length)process.exitCode=1;
