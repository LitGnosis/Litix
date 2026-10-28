import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const page=readFileSync(new URL('../app/page.jsx',import.meta.url),'utf8');
const source=readFileSync(new URL('../app/api/[action]/route.js',import.meta.url),'utf8').replace('import { after } from "next/server";', 'const after=()=>{};').replace('import { sendOrderEmails, notificationsConfigured } from "../../../lib/orderNotifications.mjs";', 'const sendOrderEmails=async()=>true;const notificationsConfigured=()=>false;').replace('"../../../lib/pricing.mjs"', JSON.stringify(new URL('../lib/pricing.mjs',import.meta.url).href)).replace('"../../../lib/catalogSort.mjs"', JSON.stringify(new URL('../lib/catalogSort.mjs',import.meta.url).href)).replace('import { neon } from "@neondatabase/serverless";','const neon=()=>{throw Error("Unexpected database access")};');
test('card prerequisites reject incomplete details, private links, and invalid quantities',()=>{
 const check=vm.runInNewContext(page.slice(page.indexOf('const validOrderDetails='),page.indexOf('const whatsappNumber='))+'validOrderDetails',{URL});
 const s={purchasable:true,min:716,supplierMin:100,max:1000,unitStep:1,per1000:6.99};
 assert.equal(check(s,'https://instagram.com/test','user@example.test',716),true);
 for(const url of ['','javascript:alert(1)','https://localhost/a','http://127.0.0.1','https://user:pass@example.com'])assert.equal(check(s,url,'user@example.test',100),false);
 assert.equal(check(null,'https://example.com','user@example.test',100),false);
 assert.equal(check(s,'https://example.com','invalid',100),false);
 for(const q of [0,99,1001,100.5])assert.equal(check(s,'https://example.com','user@example.test',q),false);
 assert.match(page,/detailsReady&&config.ready\?<PremiumInlineCheckout/);
});
test('concurrent catalog requests share a read-only upstream fetch and recommend live services',async t=>{
 const oldFetch=globalThis.fetch,oldKey=process.env.SMMGLOB_API_KEY;
 t.after(()=>{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.SMMGLOB_API_KEY;else process.env.SMMGLOB_API_KEY=oldKey});
 process.env.SMMGLOB_API_KEY='mock-only';let calls=0,release;
 globalThis.fetch=async(url,init)=>{calls++;assert.equal(init.body.get('action'),'services');await new Promise(r=>release=r);return Response.json([{service:1,name:'Instagram views',rate:1,min:100,max:10000,type:'Default'},{service:2,name:'Instagram followers',rate:1,min:100,max:10000,type:'Default'}])};
 const {GET}=await import('data:text/javascript;base64,'+Buffer.from(source+'\n// resilience').toString('base64'));
 const request=()=>GET(new Request('https://example.test/api/smmservices?goal=Launch+a+product&horizon=7'));
 const a=request(),b=request();assert.equal(calls,1);release();
 for(const r of await Promise.all([a,b])){const v=await r.json();assert.deepEqual(v.recommendations.map(s=>s.id),['1']);assert.equal(v.recommendations[0].per1000,6.99)}
 assert.equal(calls,1);
});

test('catalog cards show USD rate and exact existing starting-order amount',()=>{
 assert.match(page,/className="price-unit service-card-unit"> per 1,000/);
 assert.match(page,/className="minimum-price service-card-start">\{s.pricingReview/);
 assert.match(source,/action==="services"\?18000:16000/);
 const css=readFileSync(new URL('../app/metallic.css',import.meta.url),'utf8');
 assert.match(css,/\.service-option \.foot\{flex-wrap:wrap/);
});

 test('customer storefront uses Litix branding without naming the supplier',()=>{
 assert.doesNotMatch(page,/smmglob/i);
 assert.match(page,/Litix services available/);
 assert.match(page,/Checking supplier catalog/);
 assert.match(page,/Litix · Secure checkout/);
 assert.doesNotMatch(source,/SMMGLOB prices unavailable/);
 });
