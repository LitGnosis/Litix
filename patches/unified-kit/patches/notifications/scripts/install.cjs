#!/usr/bin/env node
'use strict';
/** Install only on the current complete Litix Next.js source (app root or repo/src). */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const pkg=path.resolve(__dirname,'..');
const input=path.resolve(process.argv[2]||process.cwd());
const isAppRoot=(r)=>['app/api/checkout/route.js','vercel.json','package.json','lib/db.js','lib/paymentGateway.js','app/track/page.js'].every(x=>fs.existsSync(path.join(r,x)));
const root=isAppRoot(input)?input:isAppRoot(path.join(input,'src'))?path.join(input,'src'):null;
if(!root) throw Error('BLOCKED: Complete current Litix Next.js source not found. Upload ZIP containing the website or use Git-connected current repo; patch-only ZIP cannot serve a storefront.');
const checkout=path.join(root,'app/api/checkout/route.js');
const config=path.join(root,'vercel.json');
const emailPath=path.join(root,'lib/orderNotifications.js');
const cronPath=path.join(root,'app/api/cron/order-notifications/route.js');
const orig=fs.readFileSync(checkout,'utf8');
const cfg=JSON.parse(fs.readFileSync(config,'utf8'));
if(cfg.crons!==undefined&&!Array.isArray(cfg.crons))throw Error('Unexpected Vercel cron structure; refusing patch');
if(!fs.readFileSync(path.join(root,'lib/paymentGateway.js'),'utf8').includes('createTrackingToken'))throw Error('Required tracking-token function is missing; refusing patch');
const originalOrders=fs.readFileSync(path.join(root,'lib/db.js'),'utf8');
if(!originalOrders.includes('function db')&&!originalOrders.includes('const db'))throw Error('Database helper differs; refusing patch');
const marker='LITIX_ORDER_EMAIL_V2';
const needle='await attachPaymentReference(orderId,checkout.provider,checkout.reference);return NextResponse.json';
if(!orig.includes(marker)&&orig.split(needle).length!==2)throw Error('Current checkout source signature changed; refusing patch to avoid breaking production');
const sourceLib=fs.readFileSync(path.join(pkg,'patch/lib/orderNotifications.js'),'utf8');
const sourceCron=fs.readFileSync(path.join(pkg,'patch/app/api/cron/order-notifications/route.js'),'utf8');
for(const [file,content] of [[emailPath,sourceLib],[cronPath,sourceCron]]){
 if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')!==content)throw Error('Current source contains differing code at '+path.relative(root,file)+'; refusing overwrite');
}
const crons=cfg.crons||[];
const cronEntry={path:'/api/cron/order-notifications',schedule:'*/5 * * * *'};
const oldCron=crons.find(c=>c.path===cronEntry.path);
if(oldCron && oldCron.schedule!==cronEntry.schedule)throw Error('Existing order-notifications cron has a different schedule; stop for review');
let nextRoute=orig;
if(!orig.includes(marker)){
 nextRoute="import{queueOrderNotification,deliverOrderNotifications}from'../../../lib/orderNotifications';\n// "+marker+"\n"+orig.replace(needle,"await attachPaymentReference(orderId,checkout.provider,checkout.reference);try{await queueOrderNotification(orderId,'created');await deliverOrderNotifications(orderId)}catch(e){console.error('order_confirmation_email',e?.message||e)}return NextResponse.json");
 nextRoute=nextRoute.replace(";\\n//", ";\n//");
}
const nextCfg=JSON.stringify({...cfg,crons:oldCron?crons:[...crons,cronEntry]},null,2)+'\n';
const changes=[[checkout,nextRoute],[config,nextCfg],[emailPath,sourceLib],[cronPath,sourceCron]];
for(const [f] of changes)fs.mkdirSync(path.dirname(f),{recursive:true});
// Every incompatibility and required path was checked above; changes are applied only now.
for(const [f,content] of changes){if(!fs.existsSync(f)||fs.readFileSync(f,'utf8')!==content)fs.writeFileSync(f,content);}
console.log('Installed Litix notification source patch in: '+root);
console.log('Existing cron jobs retained: '+crons.length+'. Notification cron registered in vercel.json.');
console.log('NEXT: inspect git diff, run build & tests, deploy Preview, verify email and cron; production unchanged.');
