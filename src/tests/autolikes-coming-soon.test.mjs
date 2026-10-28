import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const page=readFileSync(new URL("../app/autolikes/page.jsx",import.meta.url),"utf8");
const storefront=readFileSync(new URL("../app/page.jsx",import.meta.url),"utf8");

test("AutoLikes checkout clearly says Coming Soon with no payment form or supplier actions",()=>{
 assert.match(page,/AutoLikes Checkout/);
 assert.match(page,/COMING SOON/);
 assert.match(page,/Subscription checkout is not available yet/);
 assert.match(page,/No AutoLikes payment can be submitted/);
 assert.doesNotMatch(page,/CollectJS|security_key|paymentToken|<form|action:"add"|fetch\(/i);
});
test("AutoLikes navigation is discoverable without changing ordinary checkout",()=>{
 assert.match(storefront,/<a href="\/autolikes">AutoLikes<\/a>/);
 assert.match(storefront,/id="checkout"/);
 assert.match(storefront,/\/api\/checkout\/v1/);
});
