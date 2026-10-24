import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('app/api/[action]/route.js').replace('import { neon } from "@neondatabase/serverless";', 'const neon=()=>{throw Error("Catalog must not access database")};');
test('supplier-backed social expansion, sorting, filters, IDs, limits and 5x pricing',async t=>{
 const oldFetch=globalThis.fetch,oldKey=process.env.SMMGLOB_API_KEY;
 process.env.SMMGLOB_API_KEY='mock-only';
 t.after(()=>{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.SMMGLOB_API_KEY;else process.env.SMMGLOB_API_KEY=oldKey;});
 const service=(id,name,extra={})=>({service:id,name,category:name,rate:'1.25',min:'100',max:'5000',type:'Default',...extra});
 const rows=[service(1,'Spotify USA No Drop',{refill:true}),service(2,'YouTube USA No Drop',{refill:true}),service(3,'Facebook USA No Drop',{refill:true}),...['likes','shares','reposts','comments','views'].map((kind,i)=>service(10+i,'TikTok '+kind)),service(20,'Instagram views'),service(21,'Instagram USA No Drop followers',{refill:true}),service(33771,'Instagram likes'),service(30,'TikTok likes',{rate:0}),service(31,'Instagram views',{min:100,max:10}),service(32,'TikTok likes',{type:'Custom Comments'})];
 globalThis.fetch=async(url,init)=>{assert.equal(String(url),'https://smmglob.com/api/v2');assert.equal(init.body.get('action'),'services','Only read-only supplier catalog requests allowed');return Response.json(rows);};
 const {GET}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const get=async query=>{const r=await GET(new Request('https://example.test/api/smmservices?'+query));assert.equal(r.status,200);return r.json();};
 const all=await get('');assert.equal(all.total,10);assert.deepEqual(all.items.map(x=>x.id),['21','2','3','1','20','13','10','12','11','14']);
 for(const x of all.items){assert.equal(x.per1000,6.25);assert.equal(x.min,100);assert.equal(x.max,5000);assert.ok(rows.some(r=>String(r.service)===x.id));}
 const ig=await get('platform=Instagram');assert.equal(ig.total,2);assert.equal(ig.items.find(x=>x.id==='20').refill,false);assert.equal(ig.items.find(x=>x.id==='20').noDrop,false);
 assert.equal((await get('platform=TikTok')).total,5);
 assert.deepEqual((await get('platform=TikTok&q=shares')).items.map(x=>x.id),['11']);
 assert.deepEqual((await get('category=Instagram%20views')).items.map(x=>x.id),['20']);
 assert.equal((await get('platform=Instagram&q=TikTok')).total,0);
});
test('product-first storefront, logo asset and service-specific claims',()=>{
 const page=read('app/page.jsx');assert.ok(page.indexOf('id="services"')<page.indexOf('litix-feature-panel'));assert.ok(!page.includes('<section className="hero">'));
 assert.match(page,/litix-logo\.webp/);assert.ok(existsSync(new URL('../public/assets/brand/litix-logo.webp',import.meta.url)));
 assert.doesNotMatch(page,/Instant Delivery|Programmatic Refills/);
 assert.match(page,/s\.refill\?/);assert.match(page,/s\.noDrop\?/);
});

test('USA first, general next, all requested countries last with platform order inside groups',async t=>{
 const oldFetch=globalThis.fetch,oldKey=process.env.SMMGLOB_API_KEY;
 process.env.SMMGLOB_API_KEY='mock-only';
 t.after(()=>{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.SMMGLOB_API_KEY;else process.env.SMMGLOB_API_KEY=oldKey;});
 const countries=['Turkey','UK','Ireland','Bangladesh','Kenya','Germany','India','France','Spain','Italy','Belgium','Czech Republic','Denmark','Greece','Malaysia','Mexico','Morocco','Pakistan','Poland','Portugal','South Africa','South Korea','Sweden','Ukraine','UAE','Vietnam','Australia','Indonesia','U.K.','U.A.E.'];
 const item=(id,name,extra={})=>({service:id,name,rate:1,min:100,max:10000,type:'Default',...extra});
 const rows=[...countries.map((c,i)=>item(100+i,'Instagram '+c+' views')),item(1,'TikTok USA likes'),item(2,'Instagram views'),item(3,'Instagram 🇺🇸 views'),item(4,'TikTok views'),item(5,'Instagram USA / India views'),item(6,'Instagram views',{country:'Germany'}),item(7,'TikTok 🇮🇩 views'),item(8,'Instagram views',{country:'United States'})];
 globalThis.fetch=async(url,init)=>{assert.equal(init.body.get('action'),'services');return Response.json(rows);};
 const {GET}=await import('data:text/javascript;base64,'+Buffer.from(source+'\n// geography test').toString('base64'));
 const get=async q=>(await GET(new Request('https://example.test/api/smmservices?'+q))).json();
 const first=await get('page=1'),second=await get('page=2'),ids=[...first.items,...second.items].map(x=>Number(x.id));
 assert.equal(ids.length,rows.length);assert.deepEqual(new Set(ids.slice(0,3)),new Set([1,3,8]));assert.equal(ids[2],1);
 assert.deepEqual(ids.slice(3,5),[2,4]);
 for(const id of [...countries.map((_,i)=>100+i),5,6,7])assert.ok(ids.indexOf(id)>=5);
 const filtered=await get('platform=Instagram&q=Germany');assert.deepEqual(filtered.items.map(x=>x.id),['105']);
});
