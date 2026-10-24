import test from 'node:test';
import assert from 'node:assert/strict';
import {plans,signup,cancel,renew,coverPost,nextMonth} from '../lib/subscription-sandbox.mjs';
const now='2026-01-31T12:00:00.000Z';
test('exact screenshot-based monthly prices and explicit renewal consent',()=>{
 assert.deepEqual(plans.map(p=>p.cents),[560,800,1200,3200,5600]);
 assert.throws(()=>signup(100,false,now));assert.throws(()=>signup(500,true,now));
 for(const p of plans)assert.equal(signup(p.likes,true,now).amountCents,p.cents);
});
test('calendar month boundaries clamp without overflowing February',()=>{
 assert.equal(nextMonth(now),'2026-02-28T12:00:00.000Z');
 assert.equal(nextMonth('2028-01-31T12:00:00.000Z'),'2028-02-29T12:00:00.000Z');
});
test('three posts per UTC day; duplicate IDs do not consume allowance',()=>{
 let s=signup(100,true,now);for(const id of ['a','b','c'])s=coverPost(s,id,now);
 assert.equal(coverPost(s,'a',now),s);assert.throws(()=>coverPost(s,'d',now),/Daily limit/);
 s=coverPost(s,'d','2026-02-01T12:00:00.000Z');assert.equal(s.deliveries.length,4);
});
test('cancel anytime stops renewal and preserves current paid coverage',()=>{
 let s=cancel(signup(250,true,now));s=cancel(s);assert.equal(s.autoRenew,false);
 s=coverPost(s,'a',now);assert.equal(s.deliveries.length,1);
 const expired=renew(s,s.periodEnd);assert.equal(expired.charges,1);assert.equal(expired.status,'expired');
 assert.throws(()=>coverPost(s,'b',s.periodEnd),/No paid coverage/);
});
test('only approved renewal adds paid coverage; decline blocks fulfillment',()=>{
 const s=signup(1000,true,now);assert.throws(()=>renew(s,now));
 const approved=renew(s,s.periodEnd);assert.equal(approved.charges,2);assert.equal(approved.amountCents,3200);
 const declined=renew(s,s.periodEnd,false);assert.equal(declined.charges,1);assert.equal(declined.status,'past_due');assert.throws(()=>coverPost(declined,'a',s.periodEnd));
});
