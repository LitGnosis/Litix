import test from "node:test";
import assert from "node:assert/strict";
import {
 NATIVE_SUPPLY_KINDS,NATIVE_SUPPLY_CHANNELS,
 verifyNativeSupplyOffer,legacyServiceNativeStatus,litixNativeSupplySnapshot
} from "../lib/litixNativeSupplyCapacity.mjs";
import {buildLitixPublisherInquiry} from "../lib/litixNativePublisherInquiry.mjs";
import {GET as capacityGet,POST as capacityPost} from "../app/api/native/v1/capabilities/route.js";
const now=new Date("2026-11-04T22:00:00.000Z");
const validOffer={
 id:"litix-placement-creator-studio-001",
 kind:"sponsored_creator_content",title:"Licensed creator short video placement",
 channel:"instagram",regions:["US","CA"],
 partnerId:"11111111-1111-4111-8111-111111111111",
 contractId:"22222222-2222-4222-8222-222222222222",
 status:"APPROVED",contractSigned:true,identityVerified:true,
 rightsVerified:true,platformPolicyReviewed:true,adDisclosureRequired:true,
 reviewedAt:"2026-11-01T12:00:00.000Z",
 validUntil:"2027-01-10T12:00:00.000Z",
 remainingSlots:5,minimumLeadDays:8,
 retailPriceCents:25000,creatorCostCents:9000,
 supportReserveCents:1800,mediaBudgetCents:1000,
 guaranteesFollowers:false,guaranteesLikes:false,
 guaranteesViews:false,incentivizesEngagement:false,
 contactEmail:"private@creator.example",
 contractNotes:"Do not expose confidential contract terms"
};
const apply={
 name:"Independent Creator",email:"creator@example.com",
 organization:"Creator Agency",website:"https://example.com/portfolio",
 channel:"instagram",format:"sponsored_post",regions:"US, Canada",
 niche:"Independent shops and small business marketing",
 experience:"I can produce original, licensed demo videos and have written permission to distribute them to my audience.",
 rightsConfirmed:true,disclosureConfirmed:true,consent:true
};
test("By default only three Litix-made free products are available; nothing is sold",()=>{
 const state=litixNativeSupplySnapshot({env:{},now});
 assert.equal(state.ownedFreeServices.length,3);
 assert.equal(state.ownedPremiumServices.length,1);
 assert.equal(state.verifiablePlacementCount,0);
 assert.equal(state.canAcceptPlacementOrders,false);
 assert.equal(state.paidCheckoutEnabled,false);
 assert.equal(state.wholesaleOrderingEnabled,false);
 assert.equal(state.legacySocialMetricsNativeFulfillment,false);
});
test("Unverified publisher applications never become available inventory",()=>{
 const unverified={...validOffer,contractSigned:false};
 const result=verifyNativeSupplyOffer(unverified,{now});
 assert.equal(result.approved,false);
 assert.ok(result.reasons.includes("COMPLIANCE_UNVERIFIED"));
 const onlyApplication=litixNativeSupplySnapshot({env:{LITIX_NATIVE_VERIFIED_CAPACITY_JSON:JSON.stringify({offers:[unverified]}),LITIX_NATIVE_INVENTORY_VISIBILITY_ENABLED:"true"},now});
 assert.equal(onlyApplication.verifiablePlacementCount,0);
});
test("Signed, verified, profitable campaign proposal may be listed but not booked",()=>{
 const r=verifyNativeSupplyOffer(validOffer,{now});
 assert.equal(r.approved,true);
 assert.equal(r.publicOffer.bookingEnabled,false);
 assert.equal(r.publicOffer.guaranteesEngagement,false);
 assert.equal(r.publicOffer.currency,"USD");
 assert.deepEqual(r.publicOffer.regions,["US","CA"]);
 assert.equal(r.publicOffer.leadDays,8);
 const s=litixNativeSupplySnapshot({env:{
  LITIX_NATIVE_VERIFIED_CAPACITY_JSON:JSON.stringify({offers:[validOffer]}),
  LITIX_NATIVE_INVENTORY_VISIBILITY_ENABLED:"true"
 },now});
 assert.equal(s.verifiablePlacementCount,1);
 assert.equal(s.canAcceptPlacementOrders,false);
 assert.equal(s.paidCheckoutEnabled,false);
 const exposed=JSON.stringify(s);
 for(const confidential of ["private@creator.example",validOffer.partnerId,validOffer.contractId,
   "Do not expose confidential contract terms","creatorCostCents","mediaBudgetCents"])
  assert.equal(exposed.includes(confidential),false);
});
test("Expired, unprofitable, unsupported and artificial engagement offers fail closed",()=>{
 const bad=[
  {...validOffer,remainingSlots:0},
  {...validOffer,validUntil:"2026-11-01T12:00:00.000Z"},
  {...validOffer,reviewedAt:"2026-01-01T12:00:00.000Z"},
  {...validOffer,retailPriceCents:15000,creatorCostCents:14800},
  {...validOffer,guaranteesFollowers:true},
  {...validOffer,incentivizesEngagement:true},
  {...validOffer,kind:"followers"},
  {...validOffer,channel:"unknown_network"},
  {...validOffer,adDisclosureRequired:false},
  {...validOffer,contractId:"unverified"}
 ];
 for(const x of bad){const r=verifyNativeSupplyOffer(x,{now});assert.equal(r.approved,false,JSON.stringify(x));}
});
test("Live storefront social engagement is NEVER automatically labeled Native-deliverable",()=>{
 for(const name of ["Instagram Followers","TikTok Likes","YouTube Views",
  "X Retweets","YouTube Subscribers","AutoLikes on new posts","Instagram Comments"]){
  const s=legacyServiceNativeStatus({name});assert.equal(s.nativeFulfillmentReady,false);
  assert.equal(s.reason,"NO_OWNED_AUTHENTIC_ENGAGEMENT_CAPACITY");
 }
 assert.equal(legacyServiceNativeStatus({name:"Social content kit"}).nativeFulfillmentReady,false);
 assert.ok(NATIVE_SUPPLY_KINDS.includes("managed_ad_campaign"));
 assert.ok(NATIVE_SUPPLY_CHANNELS.includes("newsletter"));
});
test("Bad, overly large or missing capacity configurations result in zero offers",()=>{
 const configs=["not-json",JSON.stringify({offers:null}),
  JSON.stringify({offers:Array.from({length:201},()=>validOffer)})];
 for(const entry of configs){
  const x=litixNativeSupplySnapshot({env:{
   LITIX_NATIVE_VERIFIED_CAPACITY_JSON:entry,
   LITIX_NATIVE_INVENTORY_VISIBILITY_ENABLED:"true"
  },now});
  assert.equal(x.verifiablePlacementCount,0);
 }
 const notVisible=litixNativeSupplySnapshot({env:{
  LITIX_NATIVE_VERIFIED_CAPACITY_JSON:JSON.stringify({offers:[validOffer]})
 },now});
 assert.equal(notVisible.verifiablePlacementCount,0);
});
test("Publisher intake validates rights, disclosure, consent and evidence",()=>{
 const check=buildLitixPublisherInquiry(apply);
 assert.equal(check.ok,true);
 assert.equal(check.unverified,true);
 assert.equal(check.inventoryCreated,false);
 assert.equal(check.data.type,"publisher");
 assert.match(check.data.goals,/NOT approved supply/);
 assert.match(check.data.goals,/original|sponsored/);
 assert.equal(check.data.goals.length<=1000,true);
 const variants=[
  {...apply,rightsConfirmed:false},{...apply,disclosureConfirmed:false},
  {...apply,consent:false},{...apply,channel:"spam"},
  {...apply,format:"fake_likes"},{...apply,experience:"short"},
  {...apply,website:"javascript:alert(1)"}
 ];
 for(const invalid of variants)assert.equal(buildLitixPublisherInquiry(invalid).ok,false);
});
test("Public capacity route never creates orders or accepts POST",async()=>{
 const get=await capacityGet();
 assert.equal(get.status,200);
 assert.equal(get.headers.get("cache-control"),"no-store");
 const value=await get.json();
 assert.equal(value.supplier,"Litix Native");
 assert.equal(value.canAcceptPlacementOrders,false);
 const post=await capacityPost();
 assert.equal(post.status,405);
 assert.equal((await post.json()).charged,false);
});
