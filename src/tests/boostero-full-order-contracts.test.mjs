import test from "node:test";
import assert from "node:assert/strict";
import {supportedBoosteroType,boosteroOrderCapability,validateBoosteroOrderDraft} from "../lib/boosteroFullOrderContracts.mjs";
const s=(type="Default",platform="Instagram",extra={})=>({id:"5385",type,platform,min:10,max:10000,dripfeed:false,...extra});
test("recognizes actual Boostero v2 types and never assumes purchasing is approved",()=>{
 for(const type of ["Default","Package","SEO","Custom Comments","Mentions Custom List","Mentions","Mentions Hashtag","Mentions User Followers","Subscriptions","Comment Likes","Poll"]){
  assert.equal(supportedBoosteroType(type),type);
  assert.equal(boosteroOrderCapability(s(type)).purchasable,false);
 }
 assert.equal(boosteroOrderCapability(s("Auto Likes")).schemaSupported,false);
});
test("validates default Instagram and YouTube targets with supplier bounds",()=>{
 const valid=validateBoosteroOrderDraft(s(),{link:"https://www.instagram.com/litixsocial/",quantity:1000});
 assert.equal(valid.valid,true);
 assert.deepEqual(valid.params,{service:"5385",link:"https://www.instagram.com/litixsocial/",quantity:1000});
 assert.equal(valid.chargeAllowed,false);
 assert.equal(validateBoosteroOrderDraft(s(),{link:"http://www.instagram.com/litixsocial/",quantity:1000}).valid,false);
 assert.equal(validateBoosteroOrderDraft(s(),{link:"https://evil.example.com/secret",quantity:1000}).valid,false);
 assert.equal(validateBoosteroOrderDraft(s(),{link:"https://www.instagram.com/litixsocial/",quantity:10001}).valid,false);
 assert.equal(validateBoosteroOrderDraft(s("Default","YouTube"),{link:"https://www.youtube.com/watch?v=abcdefghijk",quantity:30}).valid,true);
});
test("validates drip feed with correctly multiplied total units and no surprise billing",()=>{
 const service=s("Default","TikTok",{dripfeed:true});
 const d=validateBoosteroOrderDraft(service,{link:"https://www.tiktok.com/@creator/video/12345678901234567",quantity:100,runs:5,interval:30});
 assert.equal(d.valid,true);assert.equal(d.estimatedTotalQuantity,500);
 assert.equal(d.params.quantity,100);assert.equal(d.params.runs,5);assert.equal(d.params.interval,30);
 assert.equal(validateBoosteroOrderDraft(s(),{link:"https://www.instagram.com/litixsocial/",quantity:100,runs:5,interval:30}).error,"dripfeed_not_supported_by_supplier");
});
test("package drafts omit numeric quantity and stay blocked until verified fixed-price quote",()=>{
 const v=validateBoosteroOrderDraft(s("Package"),{link:"https://www.instagram.com/litixsocial/"});
 assert.equal(v.valid,true);assert.equal("quantity" in v.params,false);
 assert.equal(v.reason,"package_price_not_verified");assert.equal(v.supplierDispatchAllowed,false);
});
test("custom comments match supplier contract without separate quantity",()=>{
 const v=validateBoosteroOrderDraft(s("Custom Comments","Instagram",{min:2}),{link:"https://www.instagram.com/p/ABCDE123/",comments:"Nice!\nGreat post!"});
 assert.equal(v.valid,true);assert.equal(v.params.comments,"Nice!\nGreat post!");
 assert.equal("quantity" in v.params,false);assert.equal(v.estimatedTotalQuantity,2);
 assert.equal(validateBoosteroOrderDraft(s("Custom Comments"),{link:"https://www.instagram.com/p/ABCDE123/",comments:""}).valid,false);
});
test("subscription requires post limit and exact supported delay, no direct one-time charge",()=>{
 const base={username:"litixsocial",min:100,max:500,posts:5,delay:60};
 const v=validateBoosteroOrderDraft(s("Subscriptions"),base);
 assert.equal(v.valid,true);assert.equal(v.params.username,"litixsocial");assert.equal(v.variableFutureCharge,true);
 assert.equal(v.chargeAllowed,false);
 assert.equal(validateBoosteroOrderDraft(s("Subscriptions"),{...base,delay:13}).valid,false);
 assert.equal(validateBoosteroOrderDraft(s("Subscriptions"),{...base,posts:""}).valid,false);
});
test("special types have correct extra fields without enabling any orders",()=>{
 const link="https://www.instagram.com/p/ABCDEFGH/";
 for(const [type,extra,expected] of [
  ["Mentions Custom List",{usernames:"@litixsocial\n@creator"},"usernames"],
  ["Mentions Hashtag",{hashtag:"#litix"},"hashtag"],
  ["Mentions User Followers",{username:"https://www.instagram.com/litixsocial/"},"username"],
  ["Comment Likes",{username:"litixsocial"},"username"],
  ["Poll",{answer_number:2},"answer_number"]
 ]){
  const v=validateBoosteroOrderDraft(s(type,"Instagram",{min:type==="Mentions Custom List"?2:10}),{link,quantity:50,...extra});
  assert.equal(v.valid,true,type);
  assert.ok(Object.hasOwn(v.params,expected),type);
  assert.equal(v.supplierDispatchAllowed,false);
 }
});
test("unknown platforms and invalid supplier identity always fail closed",()=>{
 assert.equal(validateBoosteroOrderDraft(s("Default","Other"),{link:"https://example.com",quantity:100}).valid,false);
 assert.equal(validateBoosteroOrderDraft({...s(),id:"bad"},{link:"https://www.instagram.com/test/",quantity:100}).valid,false);
});

test("Website Traffic supports valid public HTTPS homepages and rejects private-network destinations",()=>{
 const valid=validateBoosteroOrderDraft(s("Default","Website Traffic"),{link:"https://example.com/",quantity:1000});
 assert.equal(valid.valid,true);
 for(const link of ["http://example.com/","https://localhost/","https://127.0.0.1/","https://192.168.1.3/"]){
  assert.equal(validateBoosteroOrderDraft(s("Default","Website Traffic"),{link,quantity:1000}).valid,false);
 }
});
test("Mentions User Followers uses follower-source profile URL exactly as Boostero documents",()=>{
 const valid=validateBoosteroOrderDraft(s("Mentions User Followers"),{link:"https://www.instagram.com/p/ABCDE123/",username:"https://www.instagram.com/litixsocial/",quantity:100});
 assert.equal(valid.valid,true);assert.equal(valid.params.username,"https://www.instagram.com/litixsocial/");
 assert.equal(validateBoosteroOrderDraft(s("Mentions User Followers"),{link:"https://www.instagram.com/p/ABCDE123/",username:"litixsocial",quantity:100}).valid,false);
});
test("SEO draft uses public site URL, quantity and keywords; never auto-approves purchase",()=>{
 const draft=validateBoosteroOrderDraft(s("SEO","Other"),{link:"https://litix.net/",quantity:1000,keywords:"marketing\nsocial media"});
 assert.equal(draft.valid,true);
 assert.equal(draft.params.keywords,"marketing\nsocial media");
 assert.equal(draft.params.quantity,1000);
 assert.equal(draft.chargeAllowed,false);
 assert.equal(validateBoosteroOrderDraft(s("SEO","Other"),{link:"https://127.0.0.1/",quantity:1000,keywords:"marketing"}).valid,false);
 assert.equal(validateBoosteroOrderDraft(s("SEO","Other"),{link:"https://litix.net/",quantity:1000}).valid,false);
});
test("Mentions without quantity and Mentions Custom List with quantity both follow Boostero v2",()=>{
 const service=s("Mentions","Instagram",{min:2,max:100});
 const draft=validateBoosteroOrderDraft(service,{link:"https://www.instagram.com/p/ABCDEFGH/",usernames:"@litixsocial\n@creator"});
 assert.equal(draft.valid,true);assert.equal(draft.estimatedTotalQuantity,2);
 assert.equal("quantity" in draft.params,false);
 assert.equal(draft.params.usernames,"@litixsocial\n@creator");
 assert.equal(draft.supplierDispatchAllowed,false);
});

test("Mentions Custom List supplies both quantity and usernames under v2",()=>{
 const service=s("Mentions Custom List","Instagram",{min:2,max:100});
 const input={link:"https://www.instagram.com/p/ABCDEFGH/",quantity:50,usernames:"@litixsocial\n@creator"};
 const draft=validateBoosteroOrderDraft(service,input);
 assert.equal(draft.valid,true);assert.equal(draft.estimatedTotalQuantity,50);
 assert.equal(draft.params.quantity,50);
 assert.equal(draft.params.usernames,"@litixsocial\n@creator");
 assert.equal(validateBoosteroOrderDraft(service,{...input,quantity:1}).valid,false);
 assert.equal(validateBoosteroOrderDraft(service,{link:input.link,usernames:input.usernames}).valid,false);
});
