const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
test('retirement removes preset sales and preserves custom checkout and auto boost',()=>{
 const root=path.resolve(__dirname,'..'), temp=fs.mkdtempSync(path.join(os.tmpdir(),'retirement-'));
 try{
  for(const f of ['app/page.js','app/api/checkout/route.js']){fs.mkdirSync(path.dirname(path.join(temp,f)),{recursive:true});fs.copyFileSync(path.join(root,f),path.join(temp,f));}
  cp.execFileSync(process.execPath,[path.join(root,'patches/remove-preset-packages/apply.cjs')],{cwd:temp});
  const read=f=>fs.readFileSync(path.join(temp,f),'utf8');
  assert.doesNotMatch(read('app/page.js'),/PackageStrip|href="\/packages"/);
  assert.match(read('app/page.js'),/href="\/auto-boost"/);
  assert.match(read('app/api/checkout/route.js'),/if\(b.packageId\)return.*PACKAGES_RETIRED/);
  assert.match(read('app/api/checkout/route.js'),/createPaymentCheckout/);
  assert.match(read('app/api/packages/purchase/route.js'),/status:410/);
  assert.match(read('app/api/packages/route.js'),/packages:\[\]/);
  for(const f of ['app/packages/page.js','app/packages/followers/page.js'])assert.match(read(f),/redirect\('\/#order'\)/);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
