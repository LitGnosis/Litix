import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bundleReadiness,instagramOfferReadiness,productCheckoutReadiness} from '../lib/productReadiness.mjs';
test('all advertised metrics and quantities must be deliverable at the advertised price',()=>{
 const base={missing:[],unredeemable:[],priceCents:4485,estimatedCostCents:2000};
 assert.equal(bundleReadiness(base).ready,true);
 for(const data of [{missing:['Reposts']},{unredeemable:['Likes']},{estimatedCostCents:4485},{priceCents:NaN},{estimatedCostCents:-1}])assert.equal(bundleReadiness({...base,...data}).ready,false);
 assert.deepEqual(bundleReadiness({...base,missing:['Saves','Shares']}).blockers[0],{code:'MISSING_DELIVERY_ROUTES',items:['Saves','Shares']});
});
test('checkout requires delivery, verified payment AND product activation implementation',()=>{
 for(const ready of [false,true])for(const paymentReady of [false,true])for(const activationImplemented of [false,true])assert.equal(productCheckoutReadiness({fulfillment:{ready},paymentReady,activationImplemented}).ready,ready&&paymentReady&&activationImplemented);
 assert.equal(productCheckoutReadiness({fulfillment:{ready:true},paymentReady:true}).ready,false);
});
test('Instagram product cannot be enabled by credential presence alone',()=>{
 assert.equal(instagramOfferReadiness().ready,false);
 assert.equal(instagramOfferReadiness().blockers.length,4);
});
test('advertised Instagram launch quantities and base price are unchanged',()=>{
 const source=readFileSync(new URL('../lib/specialPackages.js',import.meta.url),'utf8');
 assert.match(source,/fallback:29.90,marker:'Instagram 25,000 Likes',items:\{Likes:25000,Views:100000,Impressions:10000,Shares:1000,Saves:1000,Reposts:100\}/);
 assert.match(source,/const PRICE_MULTIPLIER=1.5/);
});
test('readiness response never declares product activation implemented',()=>{
 const source=readFileSync(new URL('../app/api/products/readiness/route.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/activationImplemented:true/);
 assert.match(source,/Cache-Control':'no-store/);
});
