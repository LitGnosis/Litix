#!/usr/bin/env node
'use strict';
// Combine three source patches against a checked-out complete Litix project.
// Executes patches on temporary source copies. Does not modify the real source
// until EVERY selected patch succeeds and existing-file collision checks pass.
const fs=require('node:fs'), path=require('node:path'), os=require('node:os'),cp=require('node:child_process');
const kit=path.resolve(__dirname,'..');
const usage='node scripts/apply-to-repo.cjs --check|--apply /path/to/Litix [--include-refill] [--skip-seo]';
const mode=process.argv[2], arg=process.argv[3];
if(!['--check','--apply'].includes(mode)||!arg){console.error(usage);process.exit(2)}
const input=path.resolve(arg);
const isRoot=p=>['package.json','vercel.json','app/page.js','app/layout.js','app/api/checkout/route.js','lib/db.js','lib/paymentGateway.js','app/track/page.js'].every(f=>fs.existsSync(path.join(p,f)));
const root=isRoot(input)?input:isRoot(path.join(input,'src'))?path.join(input,'src'):null;
if(!root){console.error('BLOCKED: complete current Litix Next.js source required, checked out from LitGnosis/Litix. ZIP does not contain a standalone site.');process.exit(3)}
if(fs.existsSync(path.join(root,'app/api/checkout.js'))){console.error('BLOCKED: unexpected checkout layout; confirm current Vercel project source before proceeding.');process.exit(3)}
const candidatePaths=[
'app/page.js','app/layout.js','app/api/checkout/route.js','app/api/services/route.js','app/track/page.js','lib/db.js','lib/paymentGateway.js','lib/provider.js','lib/orders.js','vercel.json','package.json',
'app/litix-seo.css','app/robots.js','app/sitemap.js','app/about/page.js','app/platform/page.js','app/resources/visibility-acceleration/page.js','app/acceptable-use/page.js',
'lib/orderNotifications.js','app/api/cron/order-notifications/route.js','lib/litixRefillPolicy.mjs','app/api/internal/checkout-canary/route.js'
];
// No bulk repository copy: omitted .git, node_modules, sensitive .env files and build artifacts.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'litix-merge-'));
const starting=new Map();
for(const rel of candidatePaths){const p=path.join(root,rel);if(fs.existsSync(p)){
  if(!fs.statSync(p).isFile())throw Error('Unexpected non-file at '+p);
  starting.set(rel,fs.readFileSync(p));
}}
let working=path.join(temp,'initial');fs.mkdirSync(working);
for(const [rel,bytes] of starting){const dst=path.join(working,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.writeFileSync(dst,bytes)}
const commands=[['Order email/tracking',path.join(kit,'patches/notifications/scripts/install.cjs'),true],
 ['Transparent SEO',path.join(kit,'patches/seo/scripts/apply-seo.cjs'),!process.argv.includes('--skip-seo')],
 ['365-day refill/catalog policy',path.join(kit,'patches/refill/scripts/apply-to-current-litix.mjs'),process.argv.includes('--include-refill')]];
const status=[];
try {
 for(const [label,file,enabled] of commands){
  if(!enabled){status.push(`${label}: INCLUDED, NOT AUTO-APPLIED (optional)`);continue}
  // When the helper and canary already exist, treat refill patch as previously
  // applied only after inspection; do not run its non-idempotent installer.
  if(label.startsWith('365-day')&&fs.existsSync(path.join(working,'lib/litixRefillPolicy.mjs'))){status.push(`${label}: REVIEW REQUIRED (helper exists; no overwrite)`);continue}
  const trial=path.join(temp,'trial-'+status.length);fs.cpSync(working,trial,{recursive:true});
  let args=label.startsWith('Order email')?[file,trial]:[file];
  const p=cp.spawnSync(process.execPath,args,{cwd:trial,encoding:'utf8',timeout:25000,maxBuffer:1024*1024});
  if(p.status!==0){throw Error(`${label} blocked by source compatibility. ${((p.stderr||p.stdout||'')+'').slice(-1100)}`)}
  working=trial;status.push(`${label}: preflight PASS`);
 }
 const output=[];
 function visit(dir,prefix=''){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
   const rel=prefix?prefix+'/'+ent.name:ent.name;
   if(ent.isDirectory())visit(path.join(dir,ent.name),rel);
   else if(ent.isFile()){
    if(!candidatePaths.includes(rel))throw Error('UNEXPECTED created path: '+rel);
    const buf=fs.readFileSync(path.join(dir,ent.name));
    if(!starting.has(rel)||!starting.get(rel).equals(buf))output.push([rel,buf]);
   }else throw Error('Unexpected symlink or special file '+rel)
  }
 }
 visit(working);
 // Replacing an existing SEO page with different content could discard edits.
 // Existing checkout is changed only through compatibility-checked notification hook.
 const seoAssets=['app/litix-seo.css','app/robots.js','app/sitemap.js','app/about/page.js','app/platform/page.js','app/resources/visibility-acceleration/page.js','app/acceptable-use/page.js'];
 for(const [rel] of output){if(starting.has(rel)&&seoAssets.includes(rel))throw Error('SEO conflict: existing customized '+rel+' would be overwritten. Merge manually, not blindly.')}
 console.log('Litix app root:',root);
 for(const item of status)console.log(' - '+item);
 console.log('Proposed source changes:');for(const [rel] of output)console.log('   '+rel);
 if(mode==='--check'){console.log('CHECK OK — no real source files changed.');process.exitCode=0;}
 else {
   // Abort if someone modified a source file during preflight.
   for(const [rel] of output){const file=path.join(root,rel),previous=starting.get(rel);
    if(previous && (!fs.existsSync(file)||!fs.readFileSync(file).equals(previous)))throw Error('Source changed during preflight: '+rel);
    if(!previous && fs.existsSync(file))throw Error('Collision with newly created source: '+rel);
   }
   const written=[];
   try{
    for(const [rel,buf] of output){const file=path.join(root,rel);fs.mkdirSync(path.dirname(file),{recursive:true});
      const existed=fs.existsSync(file);const old=existed?fs.readFileSync(file):null;
      fs.writeFileSync(file,buf);written.push([file,old]);
    }
   }catch(e){for(const [file,old] of written.reverse()){if(old===null)fs.rmSync(file,{force:true});else fs.writeFileSync(file,old)}throw e}
   console.log('APPLY OK — inspect git diff, test against isolated Neon Preview, then deploy Vercel Preview. Production NOT automatically changed.');
 }
}catch(e){console.error('BLOCKED: '+e.message);process.exitCode=1}
finally{fs.rmSync(temp,{force:true,recursive:true})}
