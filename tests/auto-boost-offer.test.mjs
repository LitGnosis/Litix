import test from 'node:test';
import assert from 'node:assert/strict';
import {calculatePreviewQuote, AUTO_LIKES_TIERS} from '../patches/litix-auto-boost/offer.mjs';
test('all seven verified Leofame tiers',()=>{
  assert.deepEqual(AUTO_LIKES_TIERS.map(x=>[x.likes,x.priceCents]),[[50,400],[100,700],[150,1000],[250,1500],[500,2400],[1000,4000],[2000,7000]]);
});
test('3x views included for every likes package',()=>{
  for(const t of AUTO_LIKES_TIERS){const q=calculatePreviewQuote({likes:t.likes});assert.equal(q.viewsForEligibleVideoPosts,t.likes*3);assert.equal(q.previewTotalCents,t.priceCents);}
});
test('add-on amounts are estimated using currently observed Litix service prices and cap',()=>{
 const q=calculatePreviewQuote({likes:250,shares:100,reposts:100,saves:100,postLimit:30});
 assert.equal(q.addons.shares.estimateCents,30);
 assert.equal(q.addons.reposts.estimateCents,240);
 assert.equal(q.addons.saves.estimateCents,510);
 assert.equal(q.previewTotalCents,1500+30+240+510);
});
test('reject invalid inputs and unavailable add-on prices',()=>{
 assert.throws(()=>calculatePreviewQuote({likes:123}),/listed/);
 assert.throws(()=>calculatePreviewQuote({likes:50,shares:-1}),/non-negative/);
 assert.throws(()=>calculatePreviewQuote({likes:50,saves:20},{shares:1,reposts:1}),/unavailable/);
});
