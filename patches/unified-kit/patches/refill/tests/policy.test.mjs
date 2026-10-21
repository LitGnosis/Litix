import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORTED_NETWORKS,
  CUSTOM_RETAIL_MULTIPLIER,
  isSupportedNetwork,
  supplierHasRefill,
  hasYearOrLongerCoverage,
  isEligibleSupplierService,
  retailQuoteCents,
  runMockCheckout
} from '../src/lib/litixRefillPolicy.mjs';

const fixtures = {
  instagram: { service: 33556, category: 'Instagram Followers', name: 'IG Followers 365 Days Refill', refill: true, min: 30, max: 100000, rate: 1.4369 },
  tiktok: { service: 33395, category: 'TikTok Followers', name: 'TikTok Followers 365 Days Refill', refill: true, min: 10, max: 1000000, rate: 3.7525 },
  youtube: { service: 55704, category: 'YouTube Subscribers', name: 'YT Subscribe 365 Days Refill', refill: true, min: 100, max: 100000, rate: 54.4588 }
};

test('three and only three allowed networks', () => {
  assert.deepEqual(SUPPORTED_NETWORKS, ['Instagram', 'TikTok', 'YouTube']);
  for (const network of SUPPORTED_NETWORKS) assert.equal(isSupportedNetwork(network), true);
  for (const name of ['Facebook', 'X', 'Snapchat', 'Spotify', 'Telegram', 'Discord', 'LinkedIn', 'Kick']) {
    assert.equal(isSupportedNetwork(name), false, `${name} must be blocked`);
  }
});
test('coverage parsing requires >= 365 days, lifetime, or equivalent explicit label', () => {
  for (const label of ['365 Days Refill', '365d Refill', '[r365]', '1 year refill', '12 months refill', 'Lifetime Refill']) {
    assert.equal(hasYearOrLongerCoverage(label), true, label);
  }
  for (const label of ['30 Day Refill', '99 days refill', 'No Refill', 'Instant Likes', '364 days refill']) {
    assert.equal(hasYearOrLongerCoverage(label), false, label);
  }
});
test('supplier capability required separately from advertising label', () => {
  assert.equal(supplierHasRefill({ refill: false }), false);
  assert.equal(supplierHasRefill({ refill: true }), true);
  assert.equal(supplierHasRefill({ refill: 'true' }), true);
  assert.equal(isEligibleSupplierService({...fixtures.instagram, refill: false},'Instagram'), false);
  assert.equal(isEligibleSupplierService({...fixtures.instagram, name: '30 Day Refill'},'Instagram'), false);
  assert.equal(isEligibleSupplierService(fixtures.instagram,'Facebook'), false);
  for(const [key,platform] of [['instagram','Instagram'],['tiktok','TikTok'],['youtube','YouTube']]) {
    assert.equal(isEligibleSupplierService(fixtures[key],platform), true,platform);
  }
});
test('custom pricing uses exact 8x multiplier on WHOLESALE per-1000 rate', () => {
  assert.equal(CUSTOM_RETAIL_MULTIPLIER, 8);
  assert.equal(retailQuoteCents(5,1000),4000);
  assert.equal(retailQuoteCents(1.4369,1000),1150);
  assert.equal(retailQuoteCents(3.7525,1000),3002);
  assert.equal(retailQuoteCents(54.4588,1000),43567);
  assert.equal(retailQuoteCents(4.37,1000),3496);
  assert.equal(retailQuoteCents(6.25,1000),5000);
});
test('invalid prices and quantities are rejected',()=>{
  for(const [rate,qty] of [[0,1000],[-5,1000],['foo',1000],[5,0],[5,1.5],[5,Number.MAX_SAFE_INTEGER]]){
    assert.throws(()=>retailQuoteCents(rate,qty), RangeError);
  }
});
test('complete local mock pipeline reports no real gateway or supplier activity',()=>{
  const result=runMockCheckout({rawService:fixtures.instagram,network:'Instagram',quantity:1000,paymentToken:'litix_mock_token_internal_9921'});
  assert.equal(result.success,true);
  assert.equal(result.mock,true);
  assert.equal(result.supplierServiceId,'33556');
  assert.equal(result.retailCents,1150);
  assert.equal(result.supplierRefillTermDays,365);
  for(const field of ['gatewayNetworkCalled','cardCharged','paymentSettled','supplierNetworkCalled','supplierOrderPlaced','fulfillmentCompleted']) {
    assert.equal(result[field],false,field);
  }
});
test('mock rejects malformed tokens, missing refill, unsupported networks, quantities',()=>{
  const base={rawService:fixtures.instagram,network:'Instagram',quantity:1000,paymentToken:'litix_mock_token_internal_9921'};
  assert.throws(()=>runMockCheckout({...base,paymentToken:'real-card-token'}));
  assert.throws(()=>runMockCheckout({...base,network:'X'}));
  assert.throws(()=>runMockCheckout({...base,quantity:10}));
  assert.throws(()=>runMockCheckout({...base,rawService:{...fixtures.instagram,refill:false}}));
});
