import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('unified release preserves hero and supported SEO platforms',()=>{
 const home=read('app/page.js'),layout=read('app/layout.js');
 assert.ok(home.includes('Metrics That Move.'));
 assert.ok(home.includes('Analytics Amplified.'));
 assert.ok(layout.includes('Instagram, TikTok, and YouTube'));
});
test('notification hook follows payment reference and retains original cron jobs',()=>{
 const source=read('app/api/checkout/route.js');
 assert.ok(source.indexOf('await queueOrderNotification')>source.indexOf('await attachPaymentReference'));
 const config=JSON.parse(read('vercel.json'));
 for(const path of ['reconcile','auto-boost','campaigns','catalog-sync','order-notifications'])assert.equal(config.crons.filter(c=>c.path==='/api/cron/'+path).length,1);
 assert.ok(read('scripts/vercel-build.sh').indexOf('notifications/scripts/install.cjs')>read('scripts/vercel-build.sh').indexOf('protected-refill/apply.cjs'));
});
test('notification cron rejects unauthorized requests without DB access',async()=>{
 const source=read('app/api/cron/order-notifications/route.js').replace(/^import .*;\n/,'const queueTrackingUpdates=()=>{throw Error("unexpected DB call")};const deliverOrderNotifications=()=>{throw Error("unexpected DB call")};\n');
 const {GET}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const response=await GET(new Request('https://example.test'));
 assert.equal(response.status,401);
});
