import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,cpSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
test('Auto Boost overlay applies after legacy overlays, is repeatable and leaves other pages alone',()=>{
 const root=mkdtempSync(join(tmpdir(),'boost-test-'));
 try{
  cpSync(new URL('../patches/litix-auto-boost',import.meta.url),join(root,'patch'),{recursive:true});
  mkdirSync(join(root,'app/auto-boost'),{recursive:true});
  writeFileSync(join(root,'app/page.js'),'storefront sentinel');
  writeFileSync(join(root,'app/auto-boost/page.js'),"import AutoBoostClient from './AutoBoostClient'; export default function Page(){return <AutoBoostClient/>}");
  const run=()=>execFileSync(process.execPath,[join(root,'patch/apply.cjs')],{cwd:root});
  run();const page=readFileSync(join(root,'app/auto-boost/page.js'),'utf8');run();
  assert.equal(readFileSync(join(root,'app/auto-boost/page.js'),'utf8'),page);
  assert.equal(readFileSync(join(root,'app/page.js'),'utf8'),'storefront sentinel');
  const client=readFileSync(join(root,'app/auto-boost/AutoBoostClient.js'),'utf8');
  assert.ok(client.includes('disabled>Preview only'));
  assert.ok(client.includes('<ExistingCampaigns/>'));
  assert.ok(!client.includes("fetch('/api/checkout'"));
 }finally{rmSync(root,{recursive:true,force:true});}
});
