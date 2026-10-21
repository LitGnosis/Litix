import test from 'node:test';
import assert from 'node:assert/strict';
import {followerOffers,validateFollowerOffer} from '../lib/followerOffers.mjs';
const service={provider:'smmglob',providerServiceId:'33532',platform:'Instagram',kind:'Followers',refillTermDays:365,providerRateUsd:6.009,min:10,max:1000000};
test('fixed prices and rounded quantities preserve 1.5x supplier cost',()=>{assert.deepEqual(followerOffers.map(p=>[p.priceCents,p.quantity]),[[4485,4900],[8985,9900]]);for(const offer of followerOffers)assert.equal(validateFollowerOffer(offer,service),true)});
test('reject missing, mismatched, changed price, term and quantity limits',()=>{for(const offer of followerOffers){for(const s of [null,{...service,provider:'other'},{...service,providerServiceId:'1234'},{...service,refillTermDays:30},{...service,providerRateUsd:10},{...service,max:100},{...service,providerRateUsd:0}])assert.equal(validateFollowerOffer(offer,s),false)}});
import {readFileSync} from 'node:fs';
test('checkout owns price and quantity; build overlay retains exact reviewed source',()=>{
 const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
 const checkout=read('app/api/checkout/route.js');
 assert.match(checkout,/quantity=offer\?offer.quantity:/);
 assert.match(checkout,/retailCents=offer\?offer.priceCents:/);
 assert.match(checkout,/validateFollowerOffer\(offer,service\)/);
 for(const f of ['lib/followerOffers.mjs','lib/specialPackages.js','app/api/checkout/route.js','app/api/packages/route.js','app/packages/PackagesClient.js','app/packages/followers/page.js','app/CheckoutConfirmation.js','app/success/page.js','lib/orderConfirmation.mjs'])assert.equal(read(f),read('patches/follower-offers/assets/'+f));
 assert.match(read('app/CheckoutConfirmation.js'),/window.location.replace\('\/'\)\},2000/);
});
