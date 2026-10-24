import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateDraft } from '../lib/auto-engagement.mjs';
import {GET,POST} from '../app/api/auto-engagement/v1/route.js';
const input={executionAction:'validateDraft',platform:'Instagram',username:' @example ',minLikes:100,maxLikes:500,posts:10};
test('draft keeps each leg unsubmitted and price unavailable',()=>{
 const x=validateDraft(input);assert.equal(x.username,'example');assert.equal(x.views.min,300);assert.equal(x.views.max,1500);assert.equal(x.canPurchase,false);assert.equal(x.amountCents,null);
 for(const leg of [x.likes,x.views]){assert.equal(leg.state,'not_submitted');assert.equal(leg.supplierId,null)}
});
test('rejects malformed or excessive draft inputs',()=>{
 for(const patch of [{minLikes:NaN},{minLikes:0},{maxLikes:99},{maxLikes:100001},{posts:0},{posts:101},{posts:1.5},{minLikes:'100'},{platform:'Other'},{username:'https://example.com'},{username:'a b'},{username:''}])assert.throws(()=>validateDraft({...input,...patch}));
 for(const value of [null,[],1])assert.throws(()=>validateDraft(value));
});
test('public API can validate only; forged payment or supplier IDs cannot activate anything',async t=>{
 const oldFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('No upstream calls permitted')};t.after(()=>globalThis.fetch=oldFetch);
 assert.equal((await GET()).status,200);
 const post=value=>POST(new Request('https://example.test/api/auto-engagement/v1',{method:'POST',body:JSON.stringify(value)}));
 for(const action of ['createAutoEngagementSubscription','add','initializeCheckout'])assert.equal((await post({...input,executionAction:action,paymentVerified:true})).status,409);
 const r=await post({...input,paymentVerified:true,targetLikesServiceId:'123',amountCents:1});assert.equal(r.status,200);assert.equal((await r.json()).draft.canPurchase,false);
 assert.equal((await post({...input,posts:101})).status,422);
 assert.equal((await POST(new Request('https://example.test',{method:'POST',body:'{'}))).status,400);
 assert.equal((await POST(new Request('https://example.test',{method:'POST',body:'x'.repeat(4097)}))).status,413);
});
test('preview never renders a pay or activation button',()=>{
 const page=readFileSync(new URL('../app/auto-engagement/page.jsx',import.meta.url),'utf8');assert.match(page,/USD price unavailable/);assert.match(page,/Not submitted/);assert.doesNotMatch(page,/paymentToken|CollectJS|localStorage/);
});
