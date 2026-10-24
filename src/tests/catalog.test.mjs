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
 for(const x of all.items){assert.equal(x.per1000,x.id==='10'?11.25:6.25);assert.equal(x.min,100);assert.equal(x.max,5000);assert.ok(rows.some(r=>String(r.service)===x.id));}
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

test('catalog discounts above $30 once and labels USD explicitly',async t=>{
 const oldFetch=globalThis.fetch,oldKey=process.env.SMMGLOB_API_KEY;
 process.env.SMMGLOB_API_KEY='mock-only';
 t.after(()=>{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.SMMGLOB_API_KEY;else process.env.SMMGLOB_API_KEY=oldKey;});
 const rows=[[1,'Instagram likes',6],[2,'Instagram views',6.01],[3,'TikTok likes',4],[4,'Instagram shares',20]].map(([service,name,rate])=>({service,name,rate,min:100,max:10000,type:'Default'}));
 globalThis.fetch=async(url,init)=>{assert.equal(init.body.get('action'),'services');return Response.json(rows);};
 const {GET}=await import('data:text/javascript;base64,'+Buffer.from(source+'\n// discounted catalog').toString('base64'));
 const result=await (await GET(new Request('https://example.test/api/smmservices'))).json();
 const rates=Object.fromEntries(result.items.map(x=>[x.id,x.per1000]));
 assert.equal(rates['1'],30);assert.ok(Math.abs(rates['2']-19.5325)<1e-9);assert.equal(rates['3'],23.400000000000002);assert.equal(rates['4'],65);
 const page=read('app/page.jsx');assert.match(page,/All prices are in USD/);assert.match(page,/currencyDisplay:"code"/);
});

test('Instagram and TikTok followers are discoverable without USA/refill/no-drop claims',async t=>{
 const oldFetch=globalThis.fetch,oldKey=process.env.SMMGLOB_API_KEY;
 process.env.SMMGLOB_API_KEY='mock-only';
 t.after(()=>{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.SMMGLOB_API_KEY;else process.env.SMMGLOB_API_KEY=oldKey;});
 const item=(service,name,extra={})=>({service,name,category:name,rate:2,min:100,max:10000,type:'Default',...extra});
 const rows=[item(1,'Instagram followers'),item(2,'TikTok followers'),item(3,'IG global followers'),item(4,'Tik Tok worldwide followers'),item(5,'Instagram followers',{rate:0}),item(6,'TikTok followers',{type:'Custom Comments'}),item(7,'Facebook followers'),item(33771,'Instagram followers')];
 globalThis.fetch=async(url,init)=>{assert.equal(init.body.get('action'),'services');return Response.json(rows);};
 const {GET}=await import('data:text/javascript;base64,'+Buffer.from(source+'\n// followers regression').toString('base64'));
 const get=async q=>(await GET(new Request('https://example.test/api/smmservices?'+q))).json();
 assert.equal((await get('')).total,4);
 for(const [platform,ids] of [['Instagram',['1','3']],['TikTok',['2','4']]]){
  const result=await get('platform='+platform+'&q=followers');
  assert.deepEqual(new Set(result.items.map(x=>x.id)),new Set(ids));
  for(const x of result.items){assert.equal(x.per1000,10);assert.equal(x.purchasable,true);assert.equal(x.refill,false);assert.equal(x.noDrop,false);}
 }
 const page=read('app/page.jsx');assert.match(page,/aria-label="Follower services"/);assert.match(page,/setQuery\("followers"\)/);
});

test('followers lead each social platform with American, general, then other-country services',async t=>{
 const oldFetch=globalThis.fetch,oldKey=process.env.SMMGLOB_API_KEY;
 process.env.SMMGLOB_API_KEY='mock-only';
 t.after(()=>{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.SMMGLOB_API_KEY;else process.env.SMMGLOB_API_KEY=oldKey;});
 const rows=['Instagram','TikTok'].flatMap((platform,i)=>['Germany followers','regular followers','American followers','USA likes','USA / India followers','followers'].map((kind,j)=>({service:i*10+j,name:platform+' '+kind,rate:1,min:100,max:10000,type:'Default'})));
 globalThis.fetch=async(url,init)=>{assert.equal(init.body.get('action'),'services');return Response.json(rows);};
 const {GET}=await import('data:text/javascript;base64,'+Buffer.from(source+'\n// followers first').toString('base64'));
 for(const platform of ['Instagram','TikTok']){
  const result=await (await GET(new Request('https://example.test/api/smmservices?platform='+platform))).json();
  const names=result.items.map(x=>x.name.replace(platform+' ',''));
  assert.deepEqual(names,['American followers','followers','regular followers','Germany followers','USA / India followers','USA likes']);
 }
});

test('matched refill durations use approved tiers and cover wholesale without guessing unmatched coverage',async t=>{
 const oldFetch=globalThis.fetch,oldKey=process.env.SMMGLOB_API_KEY;
 process.env.SMMGLOB_API_KEY='mock-only';
 t.after(()=>{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.SMMGLOB_API_KEY;else process.env.SMMGLOB_API_KEY=oldKey;});
 const item=(service,name,rate=1,extra={})=>({service,name,rate,refill:true,min:100,max:10000,type:'Default',...extra});
 const rows=[item(1,'Instagram followers 30 day refill'),item(2,'Instagram followers 60 day refill'),item(3,'Instagram followers 90 day refill'),item(4,'Instagram followers lifetime refill'),item(5,'TikTok followers 90 day refill'),item(6,'Instagram premium followers 30 day refill'),item(7,'Instagram premium followers 60 day refill',30),item(8,'Instagram premium followers lifetime refill'),item(9,'Instagram followers 60 day refill',1,{refill:false}),item(33677,'Instagram followers 90 day refill',2)];
 globalThis.fetch=async(url,init)=>{assert.equal(init.body.get('action'),'services');return Response.json(rows);};
 const {GET}=await import('data:text/javascript;base64,'+Buffer.from(source+'\n// refill tiers').toString('base64'));
 const result=await (await GET(new Request('https://example.test/api/smmservices'))).json();
 const rates=Object.fromEntries(result.items.map(x=>[x.id,x.per1000]));
 assert.deepEqual(['1','2','3','4'].map(id=>rates[id]),[5,7.5,10,15]);
 assert.equal(rates['5'],5,'unmatched duration keeps independently calculated price');
 assert.deepEqual(['6','7','8'].map(id=>rates[id]),[20,30,60]);
 assert.equal(rates['9'],5,'no actual refill eligibility means no tier');
 assert.equal(rates['33677'],12,'explicit profit override is preserved');
});
