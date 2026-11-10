import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {LITIX_B2B_OFFERS,selectedB2BOffer} from "../lib/litixB2BOffers.mjs";
import {buildAgencyLeadPayload} from "../lib/litixAgencyLead.mjs";
import {validatePartnerInquiry} from "../lib/partnerApplications.mjs";
const source=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const raw={name:"Buyer Sample",email:"buyer@example.com",organization:"Agency Sample",offer:"lead-response",segment:"agency",goal:"leads",budget:"from_1000",notes:"Fix the inquiries workflow.",consent:true,websiteTrap:""};
test("proposal catalog contains three bounded offerings and no fake checkout contracts",()=>{
 assert.equal(LITIX_B2B_OFFERS.length,3);
 assert.deepEqual(LITIX_B2B_OFFERS.map(o=>o.id),["lead-response","marketing-ops","agency-integration"]);
 for(const offer of LITIX_B2B_OFFERS){
  assert.ok(/Proposed.*\$/.test(offer.price));
  assert.ok(offer.scope.length>=3);
  assert.ok(offer.limits.length>20);
  assert.equal("checkout" in offer,false);
 }
 assert.equal(selectedB2BOffer("bad"),null);
});
test("buyer email includes selected scope and the stated budget without creating orders",()=>{
 const payload=buildAgencyLeadPayload(raw,{utm_source:"LinkedIn",utm_campaign:"B2B"});
 const checked=validatePartnerInquiry(payload);
 assert.equal(checked.ok,true);
 assert.match(checked.data.goals,/AI-Assisted Lead Response Operations/);
 assert.match(checked.data.goals,/\$1,000/);
 assert.equal(checked.data.type,"agency");
 assert.equal("supplier_order" in payload,false);
 assert.equal("checkout" in payload,false);
});
test("all quote options route through existing consent-based manual review",()=>{
 const page=source("app/agency-growth/page.jsx");
 const form=source("components/LitixAgencyGrowthInquiry.jsx");
 const backend=source("app/api/partners/route.js");
 assert.match(page,/LITIX_B2B_OFFERS\.map/);
 assert.match(page,/written agreement/);
 assert.match(page,/No payment is collected here/);
 assert.match(form,/LITIX_B2B_OFFER_OPTIONS/);
 assert.match(form,/query\.get\("offer"\)/);
 assert.match(form,/fetch\("\/api\/partners"/);
 assert.match(backend,/validatePartnerInquiry/);
 assert.match(backend,/Idempotency-Key/);
 assert.throws(()=>buildAgencyLeadPayload({...raw,offer:"unknown"}));
 assert.equal(validatePartnerInquiry(buildAgencyLeadPayload({...raw,consent:false})).ok,false);
});
