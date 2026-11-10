import test from 'node:test';
import assert from 'node:assert/strict';
import {signOwnerSessionForTrustedAuth,isVerifiedOwnerRequest} from '../lib/ops/terminal-auth.ts';

test('trusted owner session requires a real signed secret',()=>{
 const secret='SECRET_TO_BE_INJECTED_BY_DEPLOYMENT_123456789';
 const exp=Math.floor(Date.now()/1000)+1800;
 const token=signOwnerSessionForTrustedAuth({sub:'owner-sub',aud:'litix-operations',role:'owner',exp},secret);
 const previous=process.env.LITIX_OPS_SESSION_SECRET;
 process.env.LITIX_OPS_SESSION_SECRET=secret;
 try {
   assert.equal(isVerifiedOwnerRequest(new Request('https://litix.net/api/fulfillment/terminal',{headers:{cookie:`litix_ops_session=${token}`}})),true);
   assert.equal(isVerifiedOwnerRequest(new Request('https://litix.net/api/fulfillment/terminal',{headers:{cookie:`litix_ops_session=${token}malicious`}})),false);
   assert.throws(()=>signOwnerSessionForTrustedAuth({sub:'owner-sub',aud:'litix-operations',role:'owner',exp:Math.floor(Date.now()/1000)-1},secret));
 } finally {
   if(previous===undefined) delete process.env.LITIX_OPS_SESSION_SECRET;
   else process.env.LITIX_OPS_SESSION_SECRET=previous;
 }
});