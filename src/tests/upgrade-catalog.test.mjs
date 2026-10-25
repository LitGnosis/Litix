import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app/api/[action]/route.js',import.meta.url),'utf8').replace('import { neon } from "@neondatabase/serverless";','const neon=()=>{throw Error("no database")};');
test('real-shaped supplier fixtures expand Instagram/TikTok, preserve IDs and 5x prices',async t=>{
 const old=fetch,key=process.env.SMMGLOB_API_KEY;process.env.SMMGLOB_API_KEY='fixture';t.after(()=>{globalThis.fetch=old;if(key===undefined)delete process.env.SMMGLOB_API_KEY;else process.env.SMMGLOB_API_KEY=key});
 const rows=['TikTok likes','TikTok shares','TikTok reposts','TikTok comments','TikTok views','Instagram views','Instagram followers'].map((name,i)=>({service:100+i,name,category:name,rate:'1.25',min:100,max:10000,type:'Default'}));
 globalThis.fetch=async(u,init)=>{assert.equal(String(u),'https://smmglob.com/api/v2');assert.equal(init.body.get('action'),'services');return Response.json(rows)};
 const {GET}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const data=await (await GET(new Request('https://example.test/api/smmservices'))).json();assert.equal(data.items.length,7);assert.match(data.items[0].name,/Instagram/);for(const x of data.items){assert.equal(x.per1000,6.25);assert.equal(x.refill,false);assert.equal(x.noDrop,false);assert.ok(rows.some(r=>String(r.service)===x.id))}
 const filtered=await (await GET(new Request('https://example.test/api/smmservices?platform=TikTok&q=shares'))).json();assert.equal(filtered.total,1);assert.equal(filtered.items[0].id,'101');
});
test('products precede relocated badges and supplied logo is installed',()=>{
 const page=readFileSync(new URL('../app/page.jsx',import.meta.url),'utf8');assert.ok(page.indexOf('id="services"')<page.indexOf('litix-feature-panel'));assert.match(page,/litix-logo.webp/);assert.ok(readFileSync(new URL('../public/assets/brand/litix-logo.webp',import.meta.url)).length>9000);
});
