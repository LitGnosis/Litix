import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {growthBundle} from "../lib/growthBundles.mjs";
import {splitFixedBundle,quoteFixedBundle,chooseBundleBoosteroService} from "../lib/growthBundleRouting.mjs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const services=platform=>[
 {service:"101",name:platform+" Followers",category:platform+" Followers",type:"Default",rate:1,min:10,max:1000000},
 {service:"102",name:platform+" Likes",category:platform+" Likes",type:"Default",rate:.2,min:10,max:1000000},
 {service:"103",name:platform+" Views",category:platform+" Views",type:"Default",rate:.05,min:10,max:1000000},
 {service:"104",name:platform+" Shares",category:platform+" Shares",type:"Default",rate:.35,min:10,max:1000000}
];
const posts=(platform,n)=>Array.from({length:n},(_,i)=>platform==="Instagram"
 ?"https://www.instagram.com/p/BundleQA"+i+"/"
 :"https://www.tiktok.com/@litixqa/video/"+String(7700000000000000000n+BigInt(i)));
for(const platform of ["Instagram","TikTok"]){
 for(const tier of ["launch","momentum","power","apex"]){
  test(platform+" "+tier+" fixed totals split exactly over ten posts with one follower allocation",()=>{
   const bundle=growthBundle((platform==="Instagram"?"ig_":"tt_")+tier);
   const allocations=splitFixedBundle(bundle,"@litixqa",posts(platform,10));
   assert.equal(allocations.length,31);
   for(const kind of ["Likes","Views","Shares","Followers"]){
    const group=allocations.filter(x=>x.kind===kind);
    assert.equal(group.reduce((n,x)=>n+x.quantity,0),bundle.items[kind]);
    assert.equal(group.length,kind==="Followers"?1:10);
   }
   const quote=quoteFixedBundle(bundle,"@litixqa",posts(platform,10),services(platform),{balanceUSD:100000});
   assert.equal(quote.legs.length,31);
   assert.equal(quote.priceCents,bundle.priceCents);
   assert.ok(quote.wholesaleCents*160<=quote.priceCents*100);
  });
 }
}
test("invalid/duplicated, cross-account and non-public post URLs never get supplier plans",()=>{
 const bundle=growthBundle("tt_launch");
 assert.throws(()=>splitFixedBundle(bundle,"@litixqa",posts("TikTok",0)),/one_to_ten_posts_required/);
 assert.throws(()=>splitFixedBundle(bundle,"@litixqa",[posts("TikTok",1)[0],posts("TikTok",1)[0]]),/duplicate_post/);
 assert.throws(()=>splitFixedBundle(bundle,"@litixqa",["https://www.tiktok.com/@different/video/7700000000000000000"]),/post_owner_mismatch/);
 assert.throws(()=>splitFixedBundle(bundle,"@litixqa",["https://example.com/post/123"]),/invalid_public_post_url/);
 assert.throws(()=>splitFixedBundle(bundle,"@litixqa",posts("TikTok",11)),/one_to_ten_posts_required/);
});
test("mixed, story, livestream, subscription and nonstandard supplier services are excluded",()=>{
 const s=services("Instagram");
 assert.equal(chooseBundleBoosteroService([...s,{service:200,name:"Instagram Story Views",category:"Instagram",rate:.001,min:1,max:100000,type:"Default"}],"Instagram",{kind:"Views",quantity:1000}).id,"103");
 assert.equal(chooseBundleBoosteroService([{service:200,name:"Instagram Likes and Views",category:"Instagram",rate:.001,min:1,max:100000,type:"Default"}],"Instagram",{kind:"Likes",quantity:1000}),null);
 assert.equal(chooseBundleBoosteroService([{service:200,name:"TikTok Likes",category:"TikTok",rate:.001,min:1,max:100000,type:"Subscriptions"}],"TikTok",{kind:"Likes",quantity:1000}),null);
});
test("wholesale increases, insufficient funds and incompatible services fail before charging any card",()=>{
 const pkg=growthBundle("ig_launch");
 assert.throws(()=>quoteFixedBundle(pkg,"@litixqa",posts("Instagram",1),services("Instagram"),{balanceUSD:0}),/supplier_wallet_insufficient/);
 const costly=services("Instagram").map(x=>({...x,rate:100}));
 assert.throws(()=>quoteFixedBundle(pkg,"@litixqa",posts("Instagram",1),costly,{balanceUSD:1000000}),/bundle_cost_exceeds_approved_margin/);
 assert.throws(()=>quoteFixedBundle(pkg,"@litixqa",posts("Instagram",1),services("TikTok"),{balanceUSD:1000000}),/supplier_likes_unavailable/);
});
test("PayKings bundle checkout stages children before charging and dispatches only after verified settlement",()=>{
 const checkout=read("app/api/bundles/checkout/route.js");
 const cron=read("app/api/bundles/cron/route.js");
 const ledger=read("lib/growthBundleAutoDispatch.mjs");
 const tracking=read("app/api/bundles/order/route.js");
 const client=read("app/bundles/checkout/page.jsx");
 assert.ok(checkout.indexOf("stagePaidBundlePlan(id,plan")<checkout.indexOf('type:"sale"'));
 assert.ok(checkout.indexOf("verifyNmiSettlement(")<checkout.indexOf("dispatchPaidBundleBatch(id"));
 assert.match(ledger,/auto_fulfillment_enabled=true and o.payment_state='settled'/);
 assert.match(ledger,/attempt_id is null and d.supplier_order_id is null/);
 assert.match(ledger,/UNKNOWN_OUTCOME/);
 assert.match(cron,/resumeSettledBundles/);
 assert.match(tracking,/auto_fulfillment_enabled/);
 assert.match(client,/autoFulfill:autoSelected/);
 assert.match(client,/gallery\.map\(p=>/);
 assert.match(client,/selectedPostLinks\.length/);
 assert.doesNotMatch(client,/Boostero/);
});
test("manual Bluevine checkout and old bundle amounts remain intact",()=>{
 const source=read("lib/growthBundles.mjs");
 const b=read("app/bundles/checkout/page.jsx");
 for(const [tier,cents] of [["launch",5382],["momentum",10782],["power",19782],["apex",35982]]){
  assert.equal(growthBundle("ig_"+tier).priceCents,cents);
  assert.equal(growthBundle("tt_"+tier).priceCents,cents);
 }
 assert.match(b,/\/api\/bundles\/bluevine/);
 assert.match(b,/bluevineBundleLink/);
 assert.match(b,/method==="bluevine"/);
 assert.match(source,/manualApprovalRequired:true/);
});
