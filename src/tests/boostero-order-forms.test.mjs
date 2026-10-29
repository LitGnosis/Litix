import test from "node:test";
import assert from "node:assert/strict";
import {orderFormSchema,validateServiceDraft} from "../lib/boosteroOrderForms.mjs";
const service=(platform,kind,other={})=>({id:"5461",platform,kind,type:"Default",min:100,max:10000,...other});
test("follower usernames and public profiles are validated with no checkout permission",()=>{
 const s=service("Instagram","followers");
 const valid=validateServiceDraft(s,{profile:"@litixsocial",quantity:1000});
 assert.equal(valid.ok,true);assert.equal(valid.checkoutAuthorized,false);assert.equal(valid.supplierDispatchAuthorized,false);
 assert.equal(validateServiceDraft(s,{profile:"https://www.instagram.com/p/ABCDEF/",quantity:1000}).ok,false);
 assert.equal(validateServiceDraft(s,{profile:"https://example.com/steal",quantity:1000}).ok,false);
});
test("TikTok likes require video URLs; optional multi-post entries must all match platform",()=>{
 const s=service("TikTok","likes");
 const url="https://www.tiktok.com/@litixsocial/video/1234567890123456789";
 assert.equal(validateServiceDraft(s,{postUrl:url,quantity:1000}).ok,true);
 assert.equal(validateServiceDraft(s,{postUrl:url,additionalPostUrls:"https://www.instagram.com/p/ABCDEF/",quantity:1000}).ok,false);
});
test("YouTube views require canonical link with a single valid video ID",()=>{
 const s=service("YouTube","views",{min:10});
 assert.equal(validateServiceDraft(s,{postUrl:"https://www.youtube.com/watch?v=abcdefghijk",quantity:500}).ok,true);
 assert.equal(validateServiceDraft(s,{postUrl:"https://www.youtube.com/watch?v=abcdefghijk&token=bad",quantity:500}).ok,false);
});
test("custom comments require validated comments and destination",()=>{
 const s=service("Instagram","custom_comments",{type:"Custom Comments",min:1});
 const base={postUrl:"https://www.instagram.com/p/ABCDE123/",quantity:25};
 assert.equal(validateServiceDraft(s,{...base,comments:"nice\ngreat"}).ok,true);
 assert.equal(validateServiceDraft(s,{...base,comments:""}).ok,false);
});
test("drip-feed orders require bounded intervals and runs",()=>{
 const s=service("Instagram","views",{dripfeed:true});
 const base={postUrl:"https://www.instagram.com/reel/ABCDEFG/",quantity:1000};
 assert.equal(validateServiceDraft(s,{...base,runs:5,intervalMinutes:30}).ok,true);
 assert.equal(validateServiceDraft(s,{...base,runs:0,intervalMinutes:30}).ok,false);
});
test("automatic subscription fields require bounded monitoring parameters",()=>{
 const s=service("TikTok","auto_engagement",{type:"Subscriptions"});
 const base={profile:"@litixsocial",quantity:1000};
 assert.equal(validateServiceDraft(s,{...base,posts:10,intervalMinutes:60}).ok,true);
 assert.equal(validateServiceDraft(s,{...base,posts:500,intervalMinutes:60}).ok,false);
});
test("unknown service kinds remain unavailable for purchase",()=>{
 const r=validateServiceDraft(service("Other","other"),{quantity:1000});
 assert.equal(r.ok,false);assert.equal(r.schema.publicCheckoutEnabled,false);
});
