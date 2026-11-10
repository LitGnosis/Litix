import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildLeadAcknowledgement} from "../lib/litixLeadAcknowledgement.mjs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const calendly="https://calendly.com/spears5417/litix-business-growth-discovery-call";
test("homepage and business pages contain the verified booking URL",()=>{
 const a=read("app/page.jsx"), b=read("app/agency-growth/page.jsx"), c=read("app/for-agencies/page.jsx");
 for(const contents of [a,b,c])assert.ok(contents.includes(calendly));
 assert.match(b,/Request a business proposal/);
 assert.match(b,/No payment is collected here/);
});
test("idempotent one-time consent acknowledgement gives a booking option without closing any deal",()=>{
 const ack=buildLeadAcknowledgement("business");
 assert.ok(ack.text.includes(calendly));
 assert.match(ack.text,/manual review/);
 assert.match(ack.text,/one-time acknowledgement/);
 assert.doesNotMatch(ack.text,/guaranteed results|You are approved|We made \$10,000/);
});
test("live proof page is honest about external client results and CRM permissions",()=>{
 const page=read("app/demo/lead-operations/page.jsx");
 assert.match(page,/first-party technical demonstration/);
 assert.match(page,/not an external client case study/);
 assert.match(page,/Not represented as ready/);
 assert.match(page,/November 9, 2026/);
 assert.ok(page.includes(calendly));
 assert.doesNotMatch(page,/guaranteed appointments|proven 100% conversions/);
});
test("sitemap exposes honest public proof without new checkout",()=>{
 const sitemap=read("app/sitemap.js");
 assert.match(sitemap,/\/demo\/lead-operations/);
 const page=read("app/demo/lead-operations/page.jsx");
 assert.doesNotMatch(page,/CollectJS|stripe|purchase\(/);
});
