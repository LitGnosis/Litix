import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../app/api/fulfillment/health/route.js';

test('Litix-owned egress health probe is noncached and does not report false hardware', async () => {
  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'litix-owned-health-ok\n');
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
});
