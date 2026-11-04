import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {prepaidAutoLikesMessages,sendPrepaidAutoLikesNotifications} from "../lib/litixPrepaidAutoLikesEmails.mjs";
const file=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const data={
 email:"buyer@example.com",
 orderId:"alp_ed028bad-aefe-4fd5-a89a-b201ea0a11f7",
 portal:"https://www.litix.net/autolikes/prepaid/manage?token=private-token-value",
 amountCents:700,posts:10,likes:100,platform:"instagram",fulfillment:"processing"
};
test("paid AutoLikes creates separate receipt, tracking, and owner notification",()=>{
 const m=prepaidAutoLikesMessages(data);
 assert.deepEqual(m.map(x=>x.kind),["payment","tracking","owner"]);
 assert.equal(m[0].recipients[0],data.email);
 assert.match(m[0].subject,/Payment Confirmation/);
 assert.match(m[0].text,/Amount paid: \$7\.00/);
 assert.match(m[0].text,/Payment status: PAID/);
 assert.match(m[1].subject,/Private Order Tracking/);
 assert.match(m[1].text,/https:\/\/www\.litix\.net\/autolikes\/prepaid\/manage\?token=/);
 assert.equal(m[0].text.includes("private-token-value"),false);
 assert.equal(m[2].text.includes("private-token-value"),false);
 assert.equal(m[2].recipients.includes("litixsocial@gmail.com"),true);
});
test("unpaid or untrusted links cannot cause notification content",()=>{
 assert.throws(()=>prepaidAutoLikesMessages({...data,orderId:"invalid"}));
 assert.throws(()=>prepaidAutoLikesMessages({...data,portal:"https://other.example.com/private?token=x"}));
 assert.throws(()=>prepaidAutoLikesMessages({...data,portal:"http://www.litix.net/autolikes/prepaid/manage?token=x"}));
 assert.throws(()=>prepaidAutoLikesMessages({...data,amountCents:0}));
});
test("each notification has a stable separate provider idempotency key and payment is never retriggered",async()=>{
 const requests=[];
 const fakeFetch=async (url,opts)=>{
  requests.push({url,header:opts.headers["Idempotency-Key"],data:JSON.parse(opts.body)});
  return {ok:true,status:200};
 };
 const result=await sendPrepaidAutoLikesNotifications(data,{fetcher:fakeFetch,apiKey:"test-key",from:"Litix <orders@litix.net>"});
 assert.equal(result.length,3);
 assert.equal(result.filter(x=>x.queued).length,3);
 assert.equal(requests.length,3);
 assert.equal(new Set(requests.map(x=>x.header)).size,3);
 assert.ok(requests.every(x=>x.url==="https://api.resend.com/emails"));
 assert.ok(requests.every(x=>!x.data.payment_token&&!x.data.type&&!x.data.supplier_order_id));
 assert.ok(requests.every(x=>x.data.from.includes("litix.net")));
});
test("transient provider failure retries only the same message with the same key",async()=>{
 const attempts=[];
 const fakeFetch=async (_url,opts)=>{
  const key=opts.headers["Idempotency-Key"];attempts.push(key);
  return {ok:attempts.filter(x=>x===key).length>1,status:attempts.filter(x=>x===key).length>1?200:503};
 };
 const out=await sendPrepaidAutoLikesNotifications(data,{fetcher:fakeFetch,apiKey:"test-key"});
 assert.deepEqual(out.map(x=>x.queued),[true,true,true]);
 assert.equal(attempts.length,6);
 assert.equal(new Set(attempts).size,3);
});
test("checkout still makes one NMI charge after durable paid ledger and only paid customers redirect",()=>{
 const checkout=file("app/api/autolikes/prepaid/checkout/route.js");
 const page=file("app/autolikes/page.jsx");
 const home=file("components/LitixAutoLikesHomeNotice.jsx");
 const landing=file("app/page.jsx");
 assert.match(checkout,/type:"sale"/);
 assert.match(checkout,/on conflict\(idempotency_key\) do nothing/);
 assert.match(checkout,/payment_status='PAID'/);
 assert.match(checkout,/dispatchPrepaidAutoLikes/);
 assert.match(checkout,/after\(async\(\)=>/);
 assert.match(checkout,/sendPrepaidAutoLikesNotifications/);
 assert.match(page,/body\.payment==="paid"&&body\.orderId&&body\.privateTrackingUrl/);
 assert.match(page,/window\.location\.assign\("\/\?autolikes=confirmed"\)/);
 assert.match(page,/Track your private AutoLikes order/);
 assert.match(page,/Return to Litix Home/);
 assert.match(home,/window\.history\.replaceState/);
 assert.doesNotMatch(home,/privateTrackingUrl|sessionStorage/);
 assert.match(landing,/<LitixAutoLikesHomeNotice\/>/);
});
