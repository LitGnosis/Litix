import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const account=read("app/api/account/dashboard/route.js");
const auth=read("lib/customerAuth.js");
const middle=read("middleware.js");
const home=read("app/page.jsx");
const checkout=read("app/api/[action]/route.js");
const confirm=read("app/confirmation/page.jsx");
const notifications=read("lib/orderNotifications.mjs");
const brand=read("config/brandEngine.js");
test("auth is fail-closed until all Auth0 variables are present",()=>{
 assert.match(auth,/customerLoginEnabled\(\)/);
 for(const field of ["AUTH0_DOMAIN","AUTH0_CLIENT_ID","AUTH0_CLIENT_SECRET","AUTH0_SECRET","APP_BASE_URL"])assert.ok(auth.includes(field));
 assert.match(auth,/customerAuthConfigured\(\) \? new Auth0Client\(\) : null/);
 assert.match(middle,/auth0 \? auth0\.middleware\(request\) : NextResponse\.next\(\)/);
});
test("account API checks Auth0 verified identity before its database lookup",()=>{
 assert.match(account,/const user=await authenticatedCustomer\(\)/);
 assert.match(account,/if\(!user\)return send\(/);
 assert.match(account,/lower\(email\)=\$1/);
 assert.match(account,/\[user\.email\]/);
 assert.match(account,/customer_id=\$1/);
 assert.match(account,/\[user\.id\]/);
 assert.match(account,/available:false/);
});
test("paid confirmation retains target, quantity and redirects after ten seconds",()=>{
 assert.match(home,/destination:normalizedOrderLink/);
 assert.match(home,/quantity:qty/);
 assert.match(home,/location\.assign\("\/confirmation\?order="/);
 assert.match(confirm,/useState\(10\)/);
 assert.match(confirm,/Stay on confirmation/);
 assert.match(confirm,/receipt\.destination/);
 assert.match(confirm,/receipt\.quantity/);
});
test("uncertain checkout responses preserve retry idempotency key",()=>{
 assert.doesNotMatch(home,/if\(r\.status!==202\)setKey/);
 assert.match(checkout,/on conflict\(idempotency_key\) do nothing/);
 assert.match(checkout,/Payment outcome is uncertain; do not retry/);
 assert.match(checkout,/payment_state='review'/);
});
test("only SMMGLOB is configured and no silent backup order after timeout",()=>{
 assert.match(brand,/primary: "SMMGLOB"/);
 assert.doesNotMatch(brand,/SMMFollowOM/i);
 assert.match(checkout,/const supplierResult=await smm\("add"/);
 assert.doesNotMatch(checkout,/backupSmm|backupSupplier|secondarySupplier/i);
});
test("Resend receipts validate verified domain and use event idempotency keys",()=>{
 assert.match(notifications,/LITIX_RECEIPT_FROM/);
 assert.match(notifications,/senderValid\(\)/);
 assert.match(notifications,/Idempotency-Key/);
 assert.match(notifications,/litix-payment\//);
 assert.match(notifications,/litix-tracking\//);
});
