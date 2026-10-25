import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {nmiRecurringStatus,createRecurringForm,cancelRecurringForm,parseRecurringGatewayResponse} from "../lib/nmiRecurring.mjs";
const secret="sandbox-merchant-test-secret-not-real";
test("recurring payments stay disabled in production even if test credentials are configured",()=>{
 const x=nmiRecurringStatus({VERCEL_ENV:"production",LITIX_NMI_RECURRING_TEST_ENABLED:"true",NMI_TEST_GATEWAY_URL:"https://sandbox.nmi.com/api/transact.php",NMI_TEST_SECURITY_KEY:secret,NEXT_PUBLIC_PAYKINGS_NMI_TEST_COLLECT_PUBLIC_KEY:"sandbox-collect-demo-key"});
 assert.equal(x.ready,false);assert.equal(x.enabled,false);
});
test("dedicated sandbox and all explicit approvals are necessary",()=>{
 const e={VERCEL_ENV:"preview",LITIX_NMI_RECURRING_TEST_ENABLED:"true",NMI_TEST_GATEWAY_URL:"https://sandbox.nmi.com/api/transact.php",NMI_TEST_SECURITY_KEY:secret,NEXT_PUBLIC_PAYKINGS_NMI_TEST_COLLECT_PUBLIC_KEY:"sandbox-collect-demo-key"};
 assert.equal(nmiRecurringStatus(e).ready,true);
 assert.equal(nmiRecurringStatus({...e,NMI_TEST_GATEWAY_URL:"https://secure.nmi.com/api/transact.php"}).ready,false);
 assert.equal(nmiRecurringStatus({...e,NMI_TEST_GATEWAY_URL:"https://sandbox.nmi.com.evil.invalid/api/transact.php"}).ready,false);
 assert.equal(nmiRecurringStatus({...e,NMI_TEST_SECURITY_KEY:""}).ready,false);
 assert.equal(nmiRecurringStatus({...e,LITIX_NMI_RECURRING_TEST_ENABLED:"false"}).ready,false);
});
test("NMI form accepts only single-use payment tokens and fixed monthly amount",()=>{
 const body=createRecurringForm({amountCents:1599,dayOfMonth:15,paymentToken:"sandbox-single-use-token-1234"},secret);
 assert.equal(body.get("recurring"),"add_subscription");
 assert.equal(body.get("plan_amount"),"15.99");
 assert.equal(body.get("month_frequency"),"1");
 assert.equal(body.get("day_of_month"),"15");
 assert.equal(body.get("plan_payments"),"0");
 assert.equal(body.has("ccnumber"),false);
 assert.throws(()=>createRecurringForm({amountCents:1599,dayOfMonth:15,paymentToken:"4111111111111111"},secret),/./);
 assert.throws(()=>createRecurringForm({amountCents:0,dayOfMonth:10,paymentToken:"sandbox-token-1234"},secret),/monthly/);
 assert.throws(()=>createRecurringForm({amountCents:1599,dayOfMonth:32,paymentToken:"sandbox-token-1234"},secret),/billing/);
});
test("cancellation demands a provider-issued numeric subscription ID",()=>{
 const form=cancelRecurringForm("12345678",secret);
 assert.equal(form.get("recurring"),"delete_subscription");
 assert.equal(form.get("subscription_id"),"12345678");
 assert.throws(()=>cancelRecurringForm("bad-id",secret));
});
test("NMI API responses cannot fake subscription approval or a provider ID",()=>{
 assert.equal(parseRecurringGatewayResponse("response=1&response_code=100&subscription_id=12345678").approved,true);
 assert.equal(parseRecurringGatewayResponse("response=1&response_code=200&subscription_id=123").approved,false);
 assert.equal(parseRecurringGatewayResponse("response=2&response_code=100&subscription_id=123").approved,false);
 const response=parseRecurringGatewayResponse("response=1&response_code=100&subscription_id=malicious");
 assert.equal(response.subscriptionId,null);
});
test("billing API is owner-scoped, read-only, and refuses mutations",()=>{
 const route=readFileSync(new URL("../app/api/account/billing/route.js",import.meta.url),"utf8");
 assert.match(route,/authenticatedCustomer\(\)/);
 assert.match(route,/where customer_id=\$1/);
 assert.match(route,/where s.customer_id=\$1/);
 assert.match(route,/e.signature_verified=true/);
 assert.match(route,/export async function POST\(\)\{return respond\(/);
 assert.match(route,/export async function PATCH\(\)\{return respond\(/);
 assert.doesNotMatch(route,/NMI_SECURITY_KEY|recurring:"add_subscription"/);
});
