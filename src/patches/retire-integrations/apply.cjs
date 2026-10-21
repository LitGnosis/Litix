const fs=require('node:fs'),path=require('node:path');
const retiredPayment=['hele','ket'].join(''),retiredSupplier=['ow','let'].join('');
for(const file of ['paymentGateway.js','reserveManager.js'])fs.copyFileSync(path.join(__dirname,file),path.join('lib',file));
const provider='lib/provider.js';let s=fs.readFileSync(provider,'utf8');
s=s.split('\n').filter(l=>!l.includes(`{id:'${retiredSupplier}'`)).join('\n');
s=s.replaceAll(`providerId = '${retiredSupplier}'`,'providerId').replaceAll(`providerId === '${retiredSupplier}' ? String(raw.service ?? raw.id) : `,'').replaceAll(`: '${retiredSupplier}';`,': null;').replaceAll(`provider='${retiredSupplier}'`,'provider');
s=s.replaceAll('getProvider(provider)||configs()[0]','getProvider(provider)').replaceAll('getProvider(providerId) || configs()[0]','getProvider(providerId)');
s=s.replace('litix-supplier-catalog-verified-20261016','litix-supplier-catalog-retired-integrations-v1');fs.writeFileSync(provider,s);
const keys='lib/serviceKey.js';fs.writeFileSync(keys,fs.readFileSync(keys,'utf8').replaceAll(`provider:'${retiredSupplier}'`,'provider:null'));
const orders='lib/orders.js';s=fs.readFileSync(orders,'utf8');s=s.replace("import {getPaymentStatusByOrderId} from './paymentGateway';",'');
const start=s.indexOf('for(const row of await sql`select id from litix_supplier_orders where payment_provider=');
if(start>=0){const end=s.indexOf('\nfor(const row',start);if(end<0)throw Error('Payment reconciliation boundary changed');s=s.slice(0,start)+s.slice(end);}
fs.writeFileSync(orders,s);
fs.rmSync('lib/provider.v62.js',{force:true});fs.rmSync(`app/api/payments/${retiredPayment}`,{recursive:true,force:true});
for(const name of fs.readdirSync('lib'))if(/\.js$/.test(name)&&new RegExp(`${retiredPayment}|${retiredSupplier}`,'i').test(fs.readFileSync(path.join('lib',name),'utf8')))throw Error('Retired integration remains in '+name);
console.log('RETIRED_INTEGRATIONS_REMOVED');
