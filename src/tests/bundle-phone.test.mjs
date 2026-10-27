import test from "node:test";
import assert from "node:assert/strict";
import {normalizeOrderPhone,smsProviderReady,sendPendingOrderSms} from "../lib/bundlePhone.mjs";
test("normalizes US and international E.164 phones without assuming WhatsApp",()=>{
 assert.equal(normalizeOrderPhone("(214) 555-0100"),"+12145550100");
 assert.equal(normalizeOrderPhone("+1 (214) 555-0100"),"+12145550100");
 assert.equal(normalizeOrderPhone("12145550100"),"+12145550100");
 assert.equal(normalizeOrderPhone("+44 7700 900123"),"+447700900123");
 assert.equal(normalizeOrderPhone("+234 801 234 5678"),"+2348012345678");
 for(const bad of ["","abc","123","++12145550100","+0123456789","+1214555010012345"])
  assert.equal(normalizeOrderPhone(bad),null);
});
test("SMS remains disabled without verified provider and explicit consent, and never sends in mocks",async()=>{
 const old=process.env.LITIX_BUNDLE_SMS_VERIFIED,fetch0=globalThis.fetch;
 delete process.env.LITIX_BUNDLE_SMS_VERIFIED;
 globalThis.fetch=()=>{throw Error("SMS must not be called")};
 try{
  assert.equal(smsProviderReady(),false);
  const args={orderId:"lbg_12345678-1234-4234-8234-123456789abc",phone:"+12145550100",bundleName:"Instagram Launch Growth Bundle",consented:true};
  assert.equal((await sendPendingOrderSms(args)).sent,false);
  assert.equal((await sendPendingOrderSms({...args,consented:false})).sent,false);
 }finally{globalThis.fetch=fetch0;if(old===undefined)delete process.env.LITIX_BUNDLE_SMS_VERIFIED;else process.env.LITIX_BUNDLE_SMS_VERIFIED=old}
});
