import test from 'node:test';import assert from 'node:assert/strict';
import {verifiedCustomer,customerRecords} from '../lib/customer-authorization.mjs';
test('unverified or missing identity cannot access customer data',()=>{for(const session of [null,{user:{sub:'a',email:'a@b.test'}},{user:{email_verified:true,email:'a@b.test'}}])assert.equal(verifiedCustomer(session),null);assert.deepEqual(verifiedCustomer({user:{sub:'auth0|1',email:'A@B.test',email_verified:true}}),{subject:'auth0|1',email:'a@b.test'})});
test('every dashboard query filters server identity, never email-based order claiming',async()=>{let calls=0;const data=await customerRecords({query:async(q,p)=>{calls++;assert.match(q,/customer_subject=\$1/);assert.deepEqual(p,['auth0|owner']);assert.ok(!q.includes('private@example'));return []}},'auth0|owner');assert.equal(calls,4);assert.deepEqual(data,{subscriptions:[],payments:[],orders:[],fulfillment:[]})});

import {sameOrigin} from '../lib/customer-origin.mjs';
test('state-changing account requests reject absent and foreign origins',()=>{const req=origin=>new Request('https://litix.net/api/account/subscriptions',{headers:origin?{origin}:{}});assert.equal(sameOrigin(req('https://litix.net'),'https://litix.net'),true);assert.equal(sameOrigin(req('https://attacker.test'),'https://litix.net'),false);assert.equal(sameOrigin(req(),'https://litix.net'),false)});
