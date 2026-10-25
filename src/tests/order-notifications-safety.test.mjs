import test from "node:test";
import assert from "node:assert/strict";
import { sendOrderEmails, notificationsConfigured } from "../lib/orderNotifications.mjs";

const ID = "ltx2_00000000-0000-4000-8000-000000000002";
const TOKEN = "00000000-0000-4000-8000-000000000003-00000000-0000-4000-8000-000000000004";
const fakeEmail = "test-customer@example.test";
const inputs = { orderId: ID, secret: TOKEN, email: fakeEmail, amountCents: 699, quantity: 1000, serviceName: "Social service", fulfillment: "processing" };

test("mock Resend sends receipt and tracking using existing verified sender; no external email", async t => {
  const oldFetch = globalThis.fetch;
  const originals = Object.fromEntries(["RESEND_API_KEY","LITIX_RESEND_API_KEY","LITIX_RECEIPT_FROM"].map(k => [k,process.env[k]]));
  t.after(() => {
    globalThis.fetch = oldFetch;
    for(const [key,v] of Object.entries(originals)) {
      if(v === undefined) delete process.env[key]; else process.env[key] = v;
    }
  });
  process.env.RESEND_API_KEY = "test-fake-only";
  delete process.env.LITIX_RESEND_API_KEY;
  process.env.LITIX_RECEIPT_FROM = "Litix <orders@litix.net>";
  assert.equal(notificationsConfigured(),true);
  const requests = [];
  globalThis.fetch = async (url, opts) => {
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(opts.method, "POST");
    requests.push({ key:opts.headers["Idempotency-Key"], json:JSON.parse(opts.body) });
    return new Response(JSON.stringify({id:"synthetic"}),{status:200});
  };
  assert.equal(await sendOrderEmails(inputs),true);
  assert.equal(requests.length,2);
  assert.deepEqual(requests.map(r=>r.key).sort(),["litix-payment/"+ID,"litix-tracking/"+ID].sort());
  assert.deepEqual(requests.map(r=>r.json.subject).sort(),["Litix — Payment confirmed","Litix — Your private tracking link"].sort());
  for (const request of requests) {
    assert.equal(request.json.from,"Litix <orders@litix.net>");
    assert.deepEqual(request.json.to,[fakeEmail]);
    assert.match(request.json.text,/https:\/\/www\.litix\.net\/track\?track=/);
    assert.match(request.json.text,/token=/);
    assert.equal(request.json.text.includes("card number"),false);
  }
  assert.equal(requests.some(r=>r.json.text.includes("processing")),true);
  globalThis.fetch = async () => new Response("simulated provider rejection",{status:503});
  assert.equal(await sendOrderEmails(inputs),false, "a provider HTTP failure is not a successful delivery");
  delete process.env.RESEND_API_KEY;
  assert.equal(notificationsConfigured(),false);
  let unexpected=0;
  globalThis.fetch = async ()=>{unexpected++; throw Error("Unexpected network request")};
  assert.equal(await sendOrderEmails(inputs),false);
  assert.equal(unexpected,0);
});
