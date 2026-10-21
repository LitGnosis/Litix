const fs=require('node:fs');
const path=require('node:path');
const root=process.cwd();
const target=path.join(root,'lib/paymentGateway.js');
const source=fs.readFileSync(target,'utf8');
// Preserve legacy overlay prerequisites; install the focused handoff repair last.
if(!source.includes('async function hostedPaykings(orderId)') || !source.includes('export async function requireVerifiedPaymentGateway()'))throw Error('Unexpected payment gateway source; refusing handoff patch');
fs.copyFileSync(path.join(__dirname,'paymentGateway.js'),target);
console.log('Checkout handoff validation applied; payment activation and settlement unchanged.');
