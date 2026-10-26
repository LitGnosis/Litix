import {test} from 'node:test';
import assert from 'node:assert/strict';
import { RETAIL_USD_PER_1000,SORTED_TIERS,classifyService,minimumRetailCentsForWholesale,wholesaleMultiplier,proposeGeneralRetail,proposeServiceRetail,calculateOrderCents,validateCheckoutQuote,validatePriceLadder,priceCatalog,pricingDecision } from '../lib/pricing.mjs';
const ig=(name,refill=false)=>({id:'test-ig',name,category:'Instagram Followers',refill});
const tt=(name,refill=false)=>({id:'test-tt',name,category:'TikTok Views',refill});

test('all 11 price tiers strictly increasing and standard cap applies',()=>{
  assert.equal(validatePriceLadder(), true);
  assert.equal(SORTED_TIERS.length,11);
});
test('700% markup for cost below $1 means 8 times wholesale',()=>{
  assert.equal(wholesaleMultiplier(0.5),8);
  assert.equal(minimumRetailCentsForWholesale(0.5),400);
  assert.equal(minimumRetailCentsForWholesale(0.99),792);
  assert.equal(minimumRetailCentsForWholesale(0.999),800);
});
test('cost exactly $1 -> $5 retail; $1 through below $20 -> at least 5x',()=>{
  assert.equal(wholesaleMultiplier(1),5);
  assert.equal(minimumRetailCentsForWholesale(1),500);
  assert.equal(minimumRetailCentsForWholesale(1.01),505);
  assert.equal(minimumRetailCentsForWholesale(2),1000);
  assert.equal(wholesaleMultiplier(19.99),5);
  assert.equal(minimumRetailCentsForWholesale(19.99),9995);
});
test('20 dollar breakpoint switches to two times, including exactly $20',()=>{
  assert.equal(wholesaleMultiplier(20),2);
  assert.equal(minimumRetailCentsForWholesale(20),4000);
  assert.equal(minimumRetailCentsForWholesale(20.01),4002);
  assert.equal(minimumRetailCentsForWholesale(22.50),4500);
  assert.equal(minimumRetailCentsForWholesale(100),20000);
});
test('never round wholesale markup down to undercharge by a fraction of cent',()=>{
  assert.equal(minimumRetailCentsForWholesale(1.001),501);
});
test('invalid and missing wholesale cannot be assumed zero',()=>{
  for(const x of [undefined,NaN,-1,Infinity,'1'])assert.equal(minimumRetailCentsForWholesale(x),null);
});
test('all OTHER services get minimum multiplier; preserve higher existing retail',()=>{
  assert.deepEqual(proposeGeneralRetail(0.2,1),{
    action:'reprice',retailCents:500,retailUsd:5,wholesaleCentsFloor:160,multiplier:8,
  });
  assert.equal(proposeGeneralRetail(1,2).retailUsd,5);
  assert.equal(proposeGeneralRetail(3,20).action,'unchanged');
  assert.equal(proposeGeneralRetail(0.75,4).retailUsd,6);
  assert.deepEqual(proposeGeneralRetail(20,90), {
    action:'unchanged',retailCents:9000,retailUsd:90,wholesaleCentsFloor:4000,multiplier:2,
  });
  assert.equal(proposeGeneralRetail(24,10).retailUsd,48);
  assert.equal(proposeGeneralRetail(21,42).action,'unchanged');
});
test('non-target missing cost or price = review',()=>{
  assert.equal(proposeGeneralRetail(undefined,10).action,'review');
  assert.equal(proposeGeneralRetail(2,undefined).action,'review');
});
test('IG no-refill and TikTok 90-day have target prices when wholesale permits',()=>{
  assert.equal(proposeServiceRetail(ig('IG Followers No Refill'),0.3).retailPer1000,6.99);
  assert.equal(proposeServiceRetail(tt('TikTok Views 90 Days Refill',true),1.5).retailPer1000,11.99);
});
test('under-$1 IG wholesale 8x overrides the 6.99 target and stays under cap',()=>{
  const x=proposeServiceRetail(ig('IG Followers No Refill'),0.99);
  assert.equal(x.retailPer1000,7.92);
});
test('wholesale >= $1 IG must be 5x (rounded up) even when ladder is cheaper',()=>{
  const x=proposeServiceRetail(ig('IG Followers 30 Days Refill',true),2.01);
  assert.equal(x.retailPer1000,10.05);
});
test('non-premium over $15 fails closed instead of breaching user price ceiling',()=>{
  assert.equal(proposeServiceRetail(ig('IG Followers 60 Days Refill',true),3.01).action,'exclude');
  assert.equal(proposeServiceRetail(tt('TikTok Views No Refill'),10).action,'exclude');
});
test('365-day and lifetime can exceed $15 to honor the tier and wholesale rules',()=>{
  assert.equal(proposeServiceRetail(ig('IG Followers 365 Days Refill',true),5).retailPer1000,25);
  assert.equal(proposeServiceRetail(ig('IG Followers Lifetime Refill',true),10).retailPer1000,50);
  assert.equal(proposeServiceRetail(ig('IG Followers 365 Days Refill',true),20).retailPer1000,40);
  assert.equal(proposeServiceRetail(ig('IG Followers Lifetime Refill',true),25).retailPer1000,50);
});
test('preceding cheaper refill tier enforces strictly higher price by one cent',()=>{
  assert.equal(proposeServiceRetail(ig('IG Followers 30 Days Refill',true),1,{precedingTierRetailCents:1099}).retailPer1000,11);
  assert.equal(proposeServiceRetail(ig('IG Followers 60 Days Refill',true),1,{precedingTierRetailCents:1500}).action,'exclude');
});
test('unknown duration or unverified wholesale blocks repricing',()=>{
  assert.equal(proposeServiceRetail(ig('IG Followers 10 Days Refill',true),1).action,'review');
  assert.equal(proposeServiceRetail(ig('IG Followers 30 Days Refill',true),undefined).action,'review');
});
test('YouTube, TikTok likes and Facebook services use global markup rule, not IG price ladder',()=>{
  assert.equal(classifyService({name:'YouTube Views'}).inScope,false);
  assert.equal(classifyService({name:'TikTok Likes'}).inScope,false);
  assert.equal(classifyService({name:'Facebook Followers'}).inScope,false);
});
test('unit scaling and cents are rounded up',()=>{
  assert.equal(calculateOrderCents(1000,8.99),899);
  assert.equal(calculateOrderCents(1500,8.99),1349);
  assert.equal(calculateOrderCents(100,8.99),90);
});
test('server blocks order below total-wholesale margin even if catalog / 1k appears valid',()=>{
  const result=validateCheckoutQuote({actualSupplierWholesaleUsd:0.99, customerSubtotalCents:700,
    displayedPer1000:7, quantity:1000,service:ig('IG Followers No Refill')});
  assert.equal(result.allowed,false);
  assert.equal(result.requiredSubtotalCents,792);
});
test('server blocks discounts that violate the global margins and mismatched quote',()=>{
  assert.equal(validateCheckoutQuote({actualSupplierWholesaleUsd:2,customerSubtotalCents:999}).allowed,false);
  assert.equal(validateCheckoutQuote({actualSupplierWholesaleUsd:1,customerSubtotalCents:799,
    displayedPer1000:8,quantity:1000,service:ig('IG Followers No Refill')}).allowed,false);
});
test('server checks the price cap and honors the supplier quote for valid orders',()=>{
  assert.equal(validateCheckoutQuote({actualSupplierWholesaleUsd:1,customerSubtotalCents:899,
    displayedPer1000:8.99,quantity:1000,service:ig('IG Followers 30 Days Refill',true)}).allowed,true);
  assert.equal(validateCheckoutQuote({actualSupplierWholesaleUsd:1,customerSubtotalCents:1600,
    displayedPer1000:16,quantity:1000,service:ig('IG Followers 30 Days Refill',true)}).allowed,false);
  assert.equal(validateCheckoutQuote({actualSupplierWholesaleUsd:10,customerSubtotalCents:5000,
    displayedPer1000:50,quantity:1000,service:ig('IG Followers 365 Days Refill',true)}).allowed,true);
});
test('below minimum 6 per 1k always invalid for IG/TikTok',()=>{
  assert.equal(validateCheckoutQuote({actualSupplierWholesaleUsd:0.1,customerSubtotalCents:500,
    displayedPer1000:5,quantity:1000,service:tt('TikTok Views No Refill')}).allowed,false);
});

test('server uses actual order wholesale at $20 breakpoint',()=>{
  assert.equal(validateCheckoutQuote({actualSupplierWholesaleUsd:20,customerSubtotalCents:4000}).allowed,true);
  assert.equal(validateCheckoutQuote({actualSupplierWholesaleUsd:20,customerSubtotalCents:3999}).allowed,false);
  assert.equal(validateCheckoutQuote({actualSupplierWholesaleUsd:30,customerSubtotalCents:6000}).allowed,true);
  assert.equal(validateCheckoutQuote({actualSupplierWholesaleUsd:30,customerSubtotalCents:5999}).allowed,false);
  assert.equal(validateCheckoutQuote({actualSupplierWholesaleUsd:19.99,customerSubtotalCents:4000}).allowed,false);
  assert.equal(validateCheckoutQuote({actualSupplierWholesaleUsd:19.99,customerSubtotalCents:9995}).allowed,true);
});
test('an ordinary IG/TikTok view/follower cannot bypass $15 cap for $20+ wholesale',()=>{
  assert.equal(proposeServiceRetail(tt('TikTok Views No Refill'),20).action,'exclude');
  assert.equal(proposeServiceRetail(ig('IG Followers 90 Days Refill',true),20).action,'exclude');
  assert.equal(proposeServiceRetail(ig('IG Followers 365 Days Refill',true),20).action,'reprice');
});
test('all categories are checked even when Instagram/TikTok specials do not apply',()=>{
  assert.equal(proposeGeneralRetail(20,100).retailUsd,100); // Facebook likes
  assert.equal(proposeGeneralRetail(0.50,3).retailUsd,5);  // YouTube shares
  assert.equal(proposeGeneralRetail(5,19).retailUsd,25);  // Spotify listeners
});

const supplier=(service,name,rate,extra={})=>({service,name,rate,min:100,max:10000,type:'Default',...extra});
test('ALL platform categories use verified wholesale brackets, never retail as cost',()=>{
 for(const platform of ['Instagram Likes','TikTok Comments','YouTube Views','Facebook Shares','Spotify Plays','Other Service']){
 for(const [rate,expected] of [[0.5,5],[1,5],[19.99,99.95],[20,65],[25,81.25]]){
 const d=pricingDecision(supplier(1,platform,rate,{per1000:999}));assert.equal(d.retailUsd,expected);
 }}
 for(const rate of [undefined,'invalid',0,-1,Infinity])assert.equal(pricingDecision(supplier(1,'YouTube Views',rate)).action,'review');
});
test('family refill ladder raises longer guarantee above every shorter sibling or excludes at cap',()=>{
 const rows=[supplier(1,'Instagram followers no refill',2.99),supplier(2,'Instagram followers 30-day refill',1),supplier(3,'Instagram followers 60-day refill',1),supplier(4,'Instagram followers 365-day refill',1),supplier(5,'Instagram followers lifetime refill',1)];
 const result=priceCatalog(rows),byId=Object.fromEntries(result.items.map(x=>[x.service,x.pricedRetail]));
 assert.deepEqual(byId,{1:14.95,2:14.96,3:14.97,4:18.99,5:22.99});
 const atCap=priceCatalog(rows.map(x=>x.service===1?{...x,rate:3}:x));
 assert.deepEqual(atCap.excluded.map(x=>x.id),['2','3']);
 assert.equal(atCap.items.find(x=>x.service===4).pricedRetail,18.99);
});
test('unknown guarantees, conflicting duration and cap violations are removed; premium needs refill evidence',()=>{
 const result=priceCatalog([supplier(1,'Instagram followers refill',1,{refill:true}),supplier(2,'TikTok views',3.01),supplier(3,'Instagram followers 365 days',1),supplier(4,'Instagram followers lifetime',1),supplier(5,'Instagram followers 30 days 365 days refill',1),supplier(6,'Instagram followers 365 days refill',1)]);
 assert.deepEqual(result.items.map(x=>x.service),[6]);assert.equal(result.excluded.length,5);
});
test('quantity bracket crossing is rejected before payment instead of silently raising advertised rate',()=>{
 // A $1/1k ordinary service costs $5/1k; 500 units cost $.50 wholesale and need $4, not $2.50.
 assert.equal(validateCheckoutQuote({actualSupplierWholesaleUsd:.5,customerSubtotalCents:250}).allowed,false);
 assert.equal(validateCheckoutQuote({actualSupplierWholesaleUsd:.5,customerSubtotalCents:400}).allowed,false);
 assert.equal(validateCheckoutQuote({actualSupplierWholesaleUsd:.5,customerSubtotalCents:500}).allowed,true);
});

test('ordinary service families preserve longer guarantees without breaking exact 2x',()=>{
 const result=priceCatalog([supplier(1,'YouTube USA No Drop 30-day refill',10),supplier(2,'YouTube USA No Drop 60-day refill',1),supplier(3,'YouTube USA No Drop lifetime refill',20)]);
 assert.deepEqual(result.items.map(x=>[x.service,x.pricedRetail]),[[1,50],[2,50.01],[3,65]]);
 assert.equal(result.excluded.length,0);
});

test('premium exception cannot be inferred from conflicting supplier terms',()=>{
 assert.equal(classifyService(ig('30-day lifetime refill',true)).tier,'unknown');
 assert.equal(classifyService(ig('life-time refill',true)).tier,'lifetime');
});
