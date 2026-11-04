import test from "node:test";
import assert from "node:assert/strict";
import {classifySmmxpertService,listEligibleSmmxpertDefaults}
 from "../lib/smmxpertServiceSafety.mjs";
import {smmxpertDraftQuote} from "../lib/smmxpertMigrationQuote.mjs";

test("TikTok Likes mislabeled under Followers cannot be sold as followers",()=>{
 const misleading={id:"529",name:"TikTok Likes [ USA ]",category:"TikTok Followers",
  serviceType:"Default",retailIndependentRate:59.6791,min:10,max:100000};
 const result=classifySmmxpertService(misleading);
 assert.equal(result.eligible,false);
 assert.equal(result.reason,"category_kind_conflict");
 assert.equal(listEligibleSmmxpertDefaults([misleading]).eligible.length,0);
 assert.throws(()=>smmxpertDraftQuote(misleading,1000,{
  approvedServiceIds:["529"],requiredPlatform:"TikTok",requiredKind:"followers",
  accountCurrency:"INR",rateCurrency:"INR",rateCurrencyVerified:true,
  fxUsdPerInr:0.011,fxVerifiedAt:Date.now()
 }),/category_mismatch/);
});

test("supported Default services preserve platform, geo, min and API eligibility",()=>{
 const sample=[
  {service:521,name:"Instagram Likes [ USA ]",category:"Instagram Likes",
   type:"Default",rate:"36.4079",min:"10",max:"10000",refill:false,cancel:false},
  {service:31,name:"Instagram Video Views USA",category:"Instagram Views",
   type:"Default",rate:"44.4918",min:"100",max:"2147483647",refill:false,cancel:true},
  {service:84,name:"TikTok Followers",category:"TikTok Followers",
   type:"Default",rate:"99.1",min:"10",max:"100000",refill:true,cancel:false},
  {service:99,name:"Mixed Views and Likes",category:"Instagram",type:"Default",
   rate:"12",min:"10",max:"5000"}
 ];
 const result=listEligibleSmmxpertDefaults(sample);
 assert.equal(result.eligible.length,3);
 assert.deepEqual(result.eligible.map(x=>[x.platform,x.kind]),[
  ["Instagram","likes"],["Instagram","views"],["TikTok","followers"]]);
 assert.equal(result.eligible[0].usa,true);
 assert.equal(result.eligible[1].max,1000000);
 assert.equal(result.eligible[0].apiRefillEligible,false);
 assert.equal(result.eligible[2].apiRefillEligible,true);
 assert.ok(result.rejected.name_kind_unknown>=1);
});

test("rate currency must be confirmed independently before any customer quote",()=>{
 const item={service:"521",name:"Instagram Likes USA",category:"Instagram Likes",
  type:"Default",rate:"36.4079",min:10,max:10000};
 assert.throws(()=>smmxpertDraftQuote(item,1000,{
  approvedServiceIds:["521"],requiredPlatform:"Instagram",requiredKind:"likes",
  accountCurrency:"INR"
 }),/rate_currency_not_verified/);
});
