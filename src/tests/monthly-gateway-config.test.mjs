import test from 'node:test';import assert from 'node:assert/strict';
import {monthlySandboxConfig} from '../lib/monthly-gateway-config.mjs';
const good={NMI_GATEWAY_MODE:'TEST',NMI_TEST_SECURITY_KEY:'mock-only',NMI_TEST_GATEWAY_URL:'https://sandbox.nmi.com/api/transact.php'};
test('monthly routes cannot fall back to live credentials',()=>{
 assert.equal(monthlySandboxConfig(good).securityKey,'mock-only');
 for(const bad of [{NMI_GATEWAY_MODE:'PRODUCTION'},{NMI_TEST_SECURITY_KEY:''},{NMI_TEST_GATEWAY_URL:'https://paykings.transactiongateway.com/api/transact.php'},{NMI_TEST_GATEWAY_URL:'https://sandbox.nmi.com.attacker.test/api/transact.php'},{NMI_TEST_GATEWAY_URL:'https://sandbox.nmi.com/api/transact.php?key=bad'}])assert.throws(()=>monthlySandboxConfig({...good,...bad,NMI_SECURITY_KEY:'live-must-not-be-used'}));
});
