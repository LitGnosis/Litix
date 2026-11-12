import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildAgencyLeadPayload} from "../lib/litixAgencyLead.mjs";
import {validatePartnerInquiry} from "../lib/partnerApplications.mjs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const form={name:"Buyer Test",email:"buyer@example.com",organization:"Example Agency",segment:"agency",goal:"agency",budget:"from_5000",notes:"Need reporting for client campaigns",consent:true,websiteTrap:""};
test("agency buyer inquiry uses existing protected partner intake and qualifies a budget without taking payments",()=>{
 const payload=buildAgencyLeadPayload(form,{utm_source:"linkedIn",utm_medium:"owned",ref:"partner-test"});
 const validated=validatePartnerInquiry(payload);
 assert.equal(validated.ok,true);
 assert.equal(validated.data.type,"agency");
 assert.match(validated.data.goals,/\$5,000\+/);
 assert.equal(validated.data.attribution.utm_source,"linkedin");
 assert.equal(validated.data.attribution.ref,"partner-test");
 assert.equal("payment" in payload,false);
});
test("invalid, non-consenting or bot inquiries fail validation",()=>{
 assert.equal(validatePartnerInquiry(buildAgencyLeadPayload({...form,consent:false})).ok,false);
 assert.equal(validatePartnerInquiry(buildAgencyLeadPayload({...form,websiteTrap:"bot"})).spam,true);
 assert.throws(()=>buildAgencyLeadPayload({...form,budget:"fake"}));
});
test("buyer form and page are live-intake only with no checkout or account activation",()=>{
 const page=read("app/agency-growth/page.jsx");
 const component=read("components/LitixAgencyGrowthInquiry.jsx");
 const backend=read("app/api/partners/route.js");
 assert.match(page,/No payment is collected here/);
 assert.match(page,/Request a business proposal/);
 assert.match(component,/fetch\("\/api\/partners"/);
 assert.match(component,/Request a business proposal/);
 assert.doesNotMatch(component,/type:"sale"|CollectJS|stripe|supplierOrder|checkoutSession/);
 assert.match(backend,/Idempotency-Key/);
 assert.match(backend,/validatePartnerInquiry/);
});
