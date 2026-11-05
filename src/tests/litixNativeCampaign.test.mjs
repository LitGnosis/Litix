import test from "node:test";
import assert from "node:assert/strict";
import {campaignPlanCsv} from "../lib/litixNativeCampaign.mjs";
import {previewLitixNativeAsset} from "../lib/litixNativeSupplier.mjs";
import {POST as previewPost} from "../app/api/native/v1/preview/route.js";
const brief={
 business:"Example Bakery",audience:"local pastry enthusiasts",
 offer:"new weekend pastries",action:"View our menu",
 platform:"Instagram",website:"https://example.com/menu?source=site"
};
test("Litix produces seven distinct campaign themes and customer-owned CSV",()=>{
 const a=campaignPlanCsv(brief),b=campaignPlanCsv(brief);
 assert.equal(a,b);
 const lines=a.trimEnd().split("\r\n");
 assert.equal(lines.length,8);
 assert.match(lines[0],/"Day","Platform","Theme"/);
 assert.match(a,/"Introduction"/);
 assert.match(a,/"Education"/);
 assert.match(a,/"Questions"/);
 assert.match(a,/"Recap and next step"/);
 assert.match(a,/utm_content=day_7/);
 assert.match(a,/utm_source=instagram/);
 assert.match(a,/source=site/);
});
test("No tracking links when a customer elects not to enter a website",()=>{
 const csv=campaignPlanCsv({...brief,website:""});
 assert.equal(csv.split("\r\n").length,9);
 assert.doesNotMatch(csv,/utm_campaign=/);
});
test("Validate creator identity, platform, outbound URL and CSV formulas",()=>{
 assert.throws(()=>campaignPlanCsv({...brief,business:"X"}),/NATIVE_CAMPAIGN_BRIEF_INVALID/);
 assert.throws(()=>campaignPlanCsv({...brief,platform:"InventedNetwork"}),/NATIVE_CAMPAIGN_BRIEF_INVALID/);
 for(const website of ["http://example.com","https://127.0.0.1/private","https://bob:password@example.com","javascript:alert(1)"]){
  assert.throws(()=>campaignPlanCsv({...brief,website}),/NATIVE_CAMPAIGN_URL_INVALID/);
 }
 const csv=campaignPlanCsv({...brief,business:"=HYPERLINK",action:"=IMPORTXML"});
 assert.match(csv,/"'=IMPORTXML"/);
 assert.match(csv,/=IMPORTXML/);
});
test("Native preview stays non-billable and is reproducible",()=>{
 const a=previewLitixNativeAsset({serviceId:"litix-native-campaign-plan",brief});
 const b=previewLitixNativeAsset({serviceId:"litix-native-campaign-plan",brief});
 assert.equal(a.content,b.content);
 assert.equal(a.sha256,b.sha256);
 assert.equal(a.mimeType,"text/csv; charset=utf-8");
 assert.equal(a.deliveryState,"PREVIEW_ONLY_NOT_PURCHASED");
 assert.equal(a.publiclyPurchasable,false);
 assert.match(a.filename,/campaign-7days.csv$/);
});
test("Existing HTTP preview delivers CSV with the same side-effect-free gate",async()=>{
 const req=new Request("https://www.litix.net/api/native/v1/preview",{
  method:"POST",headers:{"content-type":"application/json",origin:"https://www.litix.net"},
  body:JSON.stringify({serviceId:"litix-native-campaign-plan",brief})
 });
 const res=await previewPost(req);
 assert.equal(res.status,200);
 const v=await res.json();
 assert.equal(v.mimeType,"text/csv; charset=utf-8");
 assert.equal(v.publiclyPurchasable,false);
 assert.equal(v.deliveryState,"PREVIEW_ONLY_NOT_PURCHASED");
});
