import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ui=readFileSync(new URL("../app/account/AutoLikesCheckout.jsx",import.meta.url),"utf8");
const drafts=readFileSync(new URL("../app/account/AutoLikesDrafts.jsx",import.meta.url),"utf8");
const cfg=readFileSync(new URL("../app/api/account/subscribe/config/route.js",import.meta.url),"utf8");
test("subscription checkout uses existing NMI Collect.js and a token, never raw card data",()=>{
 assert.match(ui,/secure\.nmi\.com\/token\/Collect\.js/);
 assert.match(ui,/startPaymentRequest\(\)/);
 assert.match(ui,/r\?\.token/);
 assert.match(ui,/paymentToken:token/);
 assert.doesNotMatch(ui,/creditCardNumber|cardNumber\s*:/);
});
test("customer cannot buy until authenticated merchant enabled production recurring",()=>{
 assert.match(cfg,/VERCEL_ENV==="production"/);
 assert.match(cfg,/LITIX_NMI_RECURRING_MERCHANT_APPROVED==="true"/);
 assert.match(cfg,/LITIX_AUTOLIKES_LIVE_ENROLL_ENABLED==="true"/);
 assert.match(ui,/!config\?\.enabled/);
 assert.match(ui,/checked=\{consent\}/);
 assert.match(ui,/consentVersion:"autolikes-recurring-v1"/);
 assert.match(drafts,/AutoLikesCheckout/);
});
