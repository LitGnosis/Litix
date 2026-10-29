import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {GET,POST} from "../app/api/owner/finance/route.js";
import {ownerRequest,ownerSession,ownerCookieOptions} from "../lib/ownerAuth.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("financial data cannot be requested without a verified owner Auth0 session",async()=>{
 const prior=globalThis.fetch;let outbound=0;
 globalThis.fetch=async()=>{outbound++;throw Error("unexpected API call")};
 try{
  const req=new Request("https://www.litix.net/api/owner/finance");
  assert.equal(ownerRequest(req),null);
  const res=await GET(req);
  assert.equal(res.status,401);
  assert.match((await res.json()).error,/Authenticated owner session/);
  assert.equal(outbound,0);
  assert.match(res.headers.get("cache-control"),/no-store/);
  assert.equal(res.headers.get("x-robots-tag"),"noindex, nofollow");
 }finally{globalThis.fetch=prior}
});

test("malformed session cookies are rejected; owner cookies are secure and HTTP-only",()=>{
 assert.equal(ownerSession("definitely-not-a-valid-owner-session"),null);
 assert.equal(ownerCookieOptions.httpOnly,true);
 assert.equal(ownerCookieOptions.secure,true);
 assert.equal(ownerCookieOptions.sameSite,"lax");
});

test("financial endpoint is read-only and never offers payment mutation methods",()=>{
 const res=POST();
 assert.equal(res.status,405);
 const src=read("app/api/owner/finance/route.js");
 assert.match(src,/payment_transaction_id is not null/);
 assert.match(src,/paidUnfulfilledValueCents/);
 assert.match(src,/netContributionProfitCents:null/);
 assert.match(src,/overlapsExcluded/);
 assert.doesNotMatch(src,/action:\s*["']add["']|security_key|SYS_ADMIN_OVERRIDE|PRICE_MULTIPLIER/);
});

test("owner login validates exact Auth0 subject and signed cookie, not a client-entered admin key",()=>{
 const auth=read("lib/ownerAuth.mjs");
 const login=read("app/owner/wholesale/login/route.js");
 const ui=read("components/OwnerFinanceDashboard.jsx");
 assert.match(auth,/LITIX_OWNER_AUTH0_SUB/);
 assert.match(auth,/claims\.sub!==cfg\.sub/);
 assert.match(auth,/timingSafeEqual/);
 assert.match(login,/S256/);
 assert.doesNotMatch(ui,/SYS_ADMIN_KEY|ADMIN_SECRET|sysOverrideKey|adminToken/);
 assert.match(ui,/credentials:"same-origin"/);
});

test("private financial reporting separates unknown fees and duplicated payment ledgers",()=>{
 const src=read("app/api/owner/finance/route.js");
 assert.match(src,/processorFeesCents:null/);
 assert.match(src,/refundsAndChargebacksCents:null/);
 assert.match(src,/litix_paykings_checkout_orders/);
 assert.match(src,/legacyGatewayCentsExcludedFromTotal/);
 assert.match(src,/litix_growth_bundle_orders/);
});
