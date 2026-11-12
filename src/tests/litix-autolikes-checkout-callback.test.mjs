import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {maySubmitPrepaidToken} from "../lib/litixAutoLikesCheckoutGate.mjs";

const page=readFileSync(new URL("../app/autolikes/page.jsx",import.meta.url),"utf8");
const server=readFileSync(new URL("../app/api/autolikes/prepaid/checkout/route.js",import.meta.url),"utf8");

test("asynchronous token callback remains eligible while card UI says Processing",()=>{
 const params={quote:{plan:"start"},requestKey:"test-key",checkoutEnabled:true,locked:false,checkoutStarted:false,busy:true};
 assert.equal(maySubmitPrepaidToken(params),true);
 for(const change of [
  {quote:null},{requestKey:""},{checkoutEnabled:false},{locked:true},{checkoutStarted:true}
 ])assert.equal(maySubmitPrepaidToken({...params,...change}),false);
});
test("token callback is not gated by busy or double-starts checkout",()=>{
 const pay=page.slice(page.indexOf(" async function pay("),page.indexOf(" paymentCallback.current=pay;"));
 assert.match(pay,/maySubmitPrepaidToken/);
 assert.doesNotMatch(pay,/\|\|busy\|\|locked/);
 assert.match(pay,/checkoutStarted\.current=true/);
 assert.match(pay,/tokenizationPending\.current=false/);
 assert.match(pay,/AbortSignal\.timeout\(70000\)/);
 assert.match(pay,/setLocked\(true\)/);
 assert.match(page,/if\(!active\|\|!tokenizationPending\.current\)return/);
 assert.match(page,/tokenTimer\.current=setTimeout/);
 assert.match(page,/tokenizationPending\.current=false;\s*tokenTimer\.current=null;\s*setBusy\(false\)/);
});
test("prepaid payments retain server idempotency, paid-ledger, and no-repeat supplier controls",()=>{
 assert.match(server,/idempotency_key/);
 assert.match(server,/on conflict\(idempotency_key\) do nothing/);
 assert.match(server,/payment_status='PAID'/);
 assert.match(server,/dispatchPrepaidAutoLikes/);
 assert.match(server,/No repeat charge attempted/);
 assert.doesNotMatch(page,/\bfetch\(.*add_subscription/);
});
