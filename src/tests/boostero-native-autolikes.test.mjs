import test from "node:test";
import assert from "node:assert/strict";
import {eligibleNativeAutoLikes,nativeAutoLikesCatalog,nativeAutoLikesQuote,
 nativeAutoLikesExpiry,nativeAutoLikesSupplierParams} from "../lib/boosteroNativeAutoLikes.mjs";

const ig={service:"9841",name:"Instagram Auto Likes",category:"Instagram Services",
 type:"Subscriptions",rate:"1.00",min:"100",max:"10000"};
const tk={service:"9842",name:"TikTok Likes for New Posts",category:"TikTok",
 type:"Subscriptions",rate:"1.20",min:"100",max:"5000"};
const other={service:"9843",name:"Instagram Followers",category:"Instagram",
 type:"Subscriptions",rate:"1.00",min:"100",max:"10000"};

test("only supplier-native future-post Likes services qualify",()=>{
 assert.equal(eligibleNativeAutoLikes(ig,"instagram"),true);
 assert.equal(eligibleNativeAutoLikes(tk,"tiktok"),true);
 assert.equal(eligibleNativeAutoLikes(ig,"tiktok"),false);
 assert.equal(eligibleNativeAutoLikes(other,"instagram"),false);
 assert.equal(eligibleNativeAutoLikes({...ig,type:"Default"},"instagram"),false);
 assert.deepEqual(nativeAutoLikesCatalog([other,tk,ig],"instagram").map(x=>x.serviceId),["9841"]);
});
test("30-post maximum, supplier limits and 60 percent markup are enforced",()=>{
 const q=nativeAutoLikesQuote({service:ig,platform:"instagram",profile:"@litixsocial",quantityPerPost:1000,posts:10});
 assert.equal(q.totalCents,6000);
 assert.equal(q.wholesaleCents,1000);
 assert.equal(q.username,"litixsocial");
 assert.throws(()=>nativeAutoLikesQuote({service:ig,platform:"instagram",profile:"@litixsocial",quantityPerPost:1000,posts:31}));
 assert.throws(()=>nativeAutoLikesQuote({service:ig,platform:"instagram",profile:"@litixsocial",quantityPerPost:1,posts:2}));
 assert.throws(()=>nativeAutoLikesQuote({service:ig,platform:"instagram",profile:"https://evil.example",quantityPerPost:1000,posts:2}));
});
test("native subscription has strict expiry and no historic posts",()=>{
 const now=new Date("2026-11-01T12:00:00Z"),end="2026-11-29T12:00:00Z";
 const quote=nativeAutoLikesQuote({service:tk,platform:"tiktok",profile:"@litixsocial",quantityPerPost:1000,posts:3});
 const params=nativeAutoLikesSupplierParams({quote,periodEnd:end,now});
 assert.deepEqual(params,{service:"9842",username:"litixsocial",min:"1000",max:"1000",
  posts:"3",old_posts:"0",delay:"0",expiry:"29/11/2026"});
 assert.equal(nativeAutoLikesExpiry(end,now),"29/11/2026");
 assert.throws(()=>nativeAutoLikesExpiry("2027-02-01T00:00:00Z",now));
});
test("read-only public catalog cannot charge or submit supplier add",()=>{
 const s=await import("node:fs").then(x=>x.readFileSync(new URL("../app/api/autolikes/catalog/route.js",import.meta.url),"utf8"));
 assert.match(s,/boosteroProduction\("services"\)/);
 assert.match(s,/checkoutEnabled=false/);
 assert.doesNotMatch(s,/boosteroProduction\("add"\)|startPaymentRequest|add_subscription/);
});
