import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildLeadAcknowledgement,sendLeadAcknowledgement} from "../lib/litixLeadAcknowledgement.mjs";
import {getLitixSolution} from "../lib/litixSolutions.mjs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const digest="a".repeat(64);

test("inquiry acknowledgement is factual, transactional and has no fabricated promises",()=>{
 const m=buildLeadAcknowledgement("business");
 assert.match(m.subject,/Litix/);
 assert.match(m.text,/manual review/);
 assert.match(m.text,/not a marketing subscription/);
 assert.doesNotMatch(m.text,/guaranteed income|earn \$10,000|instant approval/);
 assert.throws(()=>buildLeadAcknowledgement("admin"),/invalid/);
});
test("customer acknowledgement is independently idempotent and never processes payments",async()=>{
 const calls=[];
 const fake=async(url,opts)=>{calls.push({url,opts});return {ok:true,status:200};};
 const r=await sendLeadAcknowledgement({
  email:"prospect@example.com",type:"business",digest,apiKey:"fake_resend_key_long",fetcher:fake
 });
 assert.equal(r.queued,true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,"https://api.resend.com/emails");
 const headers=calls[0].opts.headers;
 assert.equal(headers["Idempotency-Key"],"litix-lead-ack-"+digest.slice(0,48));
 const body=JSON.parse(calls[0].opts.body);
 assert.deepEqual(body.to,["prospect@example.com"]);
 assert.equal(body.reply_to,"litixsocial@gmail.com");
 assert.doesNotMatch(JSON.stringify(body),/cardNumber|supplier_order_id|PayKings|Boostero/);
});
test("provider failures do not throw or invite resubmission",async()=>{
 const rejected=await sendLeadAcknowledgement({
  email:"prospect@example.com",type:"business",digest,apiKey:"fake_resend_key_long",
  fetcher:async()=>({ok:false,status:503})
 });
 assert.deepEqual(rejected,{queued:false,reason:"provider_503"});
 const unavailable=await sendLeadAcknowledgement({
  email:"prospect@example.com",type:"business",digest,apiKey:"fake_resend_key_long",
  fetcher:async()=>{throw Error("simulated");}
 });
 assert.deepEqual(unavailable,{queued:false,reason:"network"});
});
test("owner alert is sent first; acknowledgement only follows successful owner receipt",()=>{
 const route=read("app/api/partners/route.js");
 const ownerCall=route.indexOf('const response = await fetch("https://api.resend.com/emails"');
 const ownerCheck=route.indexOf("if (!response.ok)",ownerCall);
 const ack=route.indexOf("await sendLeadAcknowledgement",ownerCheck);
 assert.ok(ownerCall>0&&ownerCheck>ownerCall&&ack>ownerCheck);
 assert.match(route,/acknowledgementQueued:acknowledgement\.queued/);
 assert.match(route,/validatePartnerInquiry/);
 assert.match(route,/litix_inquiry_acknowledgement_failed/);
});
test("AI workflow offer remains inquiry-only and has no fake-streaming claims",()=>{
 const pilot=getLitixSolution("automation-ops");
 assert.ok(pilot);
 assert.match(pilot.summary,/consent-based/);
 assert.match(pilot.model,/Proposed/);
 assert.equal(pilot.featured,true);
 const page=read("app/agency-growth/page.jsx");
 assert.match(page,/\/solutions\/automation-ops/);
 assert.doesNotMatch(page,/auto-charge|guaranteed sales/);
});
