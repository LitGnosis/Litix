import test,{after} from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
const original=Object.fromEntries(["VERCEL_ENV","BOOSTERO_API_URL","BOOSTERO_API_KEY","LITIX_BOOSTERO_ENABLED"].map(n=>[n,process.env[n]]));
process.env.VERCEL_ENV="preview";
process.env.BOOSTERO_API_KEY="FAKE_LOCAL_QUOTE_TEST_KEY";
process.env.BOOSTERO_API_URL="https://boostero.com/api/v2";
process.env.LITIX_BOOSTERO_ENABLED="true";
const mockServices=Array.from({length:150},(_,i)=>({service:i+100,name:"Instagram Followers "+i,category:"Instagram Followers",rate:"10.00",min:"50",max:"10000",type:"Default",refill:false,dripfeed:false}));
mockServices[1]={service:101,name:"Instagram Ultimate Starter Plan",category:"Instagram Packages",rate:"21.25",min:"1",max:"1",type:"Package",refill:false};
mockServices[2]={service:102,name:"Instagram New Post Auto Likes",category:"Instagram Subscriptions",rate:"15",min:"100",max:"1000",type:"Subscriptions",refill:false};
const priorFetch=globalThis.fetch;
let calls=0;
globalThis.fetch=async (url,opts)=>{
 assert.equal(url,"https://boostero.com/api/v2");
 assert.equal(new URLSearchParams(opts.body).get("action"),"services");
 calls++;return Response.json(mockServices);
};
const {POST}=await import("../app/api/catalog/global/quote/route.js");
const opaque=id=>"service_"+createHmac("sha256",process.env.BOOSTERO_API_KEY).update(String(id)).digest("hex").slice(0,24);
const quote=async(id,input)=>POST(new Request("https://preview.example.test/api/catalog/global/quote",{
 method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:opaque(id),input})
}));
test("real supplier rate is quoted as 60 percent markup server-side and not charged",async()=>{
  const r=await quote(100,{link:"https://www.instagram.com/testprofile/",quantity:1000});
  assert.equal(r.status,200);const data=await r.json();
  assert.equal(data.customerAmountCents,1600);
  assert.equal(data.retailPer1000Cents,1600);
  assert.equal(data.validInput,true);assert.equal(data.canPurchase,false);
  assert.equal(data.noPaymentAttempted,true);
  for(const secret of ["wholesale","rate","supplierCost","FAKE_LOCAL_QUOTE_TEST_KEY"]){
   assert.equal(JSON.stringify(data).includes(secret),false);
  }
 });
 test("$5 minimum and actual supplier quantity bounds enforced",async()=>{
  const min=await (await quote(100,{link:"https://www.instagram.com/testprofile/",quantity:100})).json();
  assert.equal(min.validInput,true);assert.equal(min.reason,"below_five_dollar_minimum");
  assert.ok(min.smallestEligibleQuantity>100);
  const bad=await (await quote(100,{link:"https://www.instagram.com/testprofile/",quantity:10001})).json();
  assert.equal(bad.canPurchase,false);assert.equal(bad.validInput,false);
 });
 test("known package and subscription types never produce false checkout prices",async()=>{
  const pack=await (await quote(101,{link:"https://www.instagram.com/testprofile/"})).json();
  assert.equal(pack.validInput,true);assert.equal(pack.canPurchase,false);
  assert.equal(pack.reason,"package_fixed_price_contract_not_verified");
  assert.equal("customerAmountCents" in pack,false);
  const sub=await (await quote(102,{username:"testprofile",min:100,max:1000,posts:5,delay:60})).json();
  assert.equal(sub.validInput,true);assert.equal(sub.canPurchase,false);
  assert.equal(sub.reason,"recurring_future_post_billing_not_verified");
 });
 test("unknown opaque service ID is never quoted",async()=>{
  const r=await POST(new Request("https://preview.example.test/api/catalog/global/quote",{method:"POST",
   body:JSON.stringify({id:"service_000000000000000000000000",input:{quantity:1000}})}));
  assert.equal(r.status,409);
 });
after(()=>{
 globalThis.fetch=priorFetch;
 for(const [k,v] of Object.entries(original)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
