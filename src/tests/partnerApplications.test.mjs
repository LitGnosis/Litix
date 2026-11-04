import test from "node:test";
import assert from "node:assert/strict";
import {validatePartnerInquiry} from "../lib/partnerApplications.mjs";

const valid={name:"Test Partner",email:"person@example.com",organization:"Example Agency",website:"https://example.com",type:"agency",goals:"We want to discuss a client referral partnership.",consent:true,websiteTrap:""};

test("valid partner inquiry is normalized",()=>{
  const result=validatePartnerInquiry({...valid,email:" Person@EXAMPLE.COM "});
  assert.equal(result.ok,true);
  assert.equal(result.data.email,"person@example.com");
});
test("rejects unconsented applications",()=>assert.equal(validatePartnerInquiry({...valid,consent:false}).ok,false));
test("rejects invalid email and internal hostnames",()=>{
  assert.equal(validatePartnerInquiry({...valid,email:"not-email"}).ok,false);
  assert.equal(validatePartnerInquiry({...valid,website:"http://127.0.0.1"}).ok,false);
});
test("rejects invalid type and oversized description",()=>{
  assert.equal(validatePartnerInquiry({...valid,type:"admin"}).ok,false);
  assert.equal(validatePartnerInquiry({...valid,goals:"x".repeat(1001)}).ok,false);
});
test("flags honeypot form fills without delivering",()=>{
  const result=validatePartnerInquiry({...valid,websiteTrap:"spam"});
  assert.equal(result.spam,true);
});
