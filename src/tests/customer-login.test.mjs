import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {authSettings,customerIdentity} from '../lib/customer-policy.mjs';
const env={VERCEL_ENV:'preview',LITIX_CUSTOMER_LOGIN_ENABLED:'true',APP_BASE_URL:'https://exact-preview.vercel.app',AUTH0_DOMAIN:'fixture.auth0.com',AUTH0_CLIENT_ID:'fixture',AUTH0_CLIENT_SECRET:'fixture',AUTH0_SECRET:'a'.repeat(64)};
test('auth requires explicit Preview configuration; production cannot activate',()=>{
 assert.deepEqual(authSettings(env),{appBaseUrl:env.APP_BASE_URL});
 for(const patch of [{VERCEL_ENV:'production'},{LITIX_CUSTOMER_LOGIN_ENABLED:'false'},{AUTH0_SECRET:'placeholder'},{AUTH0_CLIENT_SECRET:''},{APP_BASE_URL:'https://user:pass@example.test'},{APP_BASE_URL:'http://example.test'},{APP_BASE_URL:'https://example.test/path'}])assert.equal(authSettings({...env,...patch}),null);
});
test('identity comes only from valid server session; verification is strict',()=>{
 for(const session of [null,{}, {user:{email:'a@example.test'}}])assert.equal(customerIdentity(session),null);
 assert.equal(customerIdentity({user:{sub:'auth0|1',email_verified:'true'}}).verified,false);
 assert.deepEqual(customerIdentity({user:{sub:'auth0|1',email:'a@example.test',email_verified:true}}),{subject:'auth0|1',email:'a@example.test',verified:true});
});
test('customer API rejects unverified sessions and does not query or email-match orders',()=>{
 const route=readFileSync(new URL('../app/api/account/profile/route.js',import.meta.url),'utf8');assert.match(route,/if\(!identity.verified\)/);assert.doesNotMatch(route,/neon\(|request\.json|searchParams|AUTH0_CLIENT_SECRET/);
});
