import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('homepage retains storefront components and exposes SEO metadata',()=>{
  const home=read('app/page.js'), layout=read('app/layout.js');
  for(const component of ['<FeaturedShop/>','<OrderWidget/>','<PackageStrip/>']) assert.ok(home.includes(component));
  assert.ok(home.includes('LITIX_SEO_HOME_V1'));
  assert.ok(layout.includes("metadataBase: new URL('https://www.litix.net')"));
  assert.ok(layout.includes('application/ld+json'));
  assert.ok(layout.includes('Marketing Automation & Campaign Management'));
});
test('patch is repeatable and fails without writing when homepage anchors change',()=>{
  const root=mkdtempSync(join(tmpdir(),'litix-seo-'));
  try {
    cpSync(new URL('../patches',import.meta.url),join(root,'patches'),{recursive:true});
    mkdirSync(join(root,'app'));
    for(const file of ['layout.js','page.js']) writeFileSync(join(root,'app',file),read('app/'+file));
    const script=join(root,'patches/litix-trusted-seo/scripts/apply-seo.cjs');
    execFileSync(process.execPath,[script],{cwd:root});
    execFileSync(process.execPath,[script],{cwd:root});
    assert.equal(readFileSync(join(root,'app/page.js'),'utf8'),read('app/page.js'));
    assert.equal(readFileSync(join(root,'app/layout.js'),'utf8'),read('app/layout.js'));
    const layout="import './globals.css';\nexport const metadata={title:'old'};\nexport default function Root(){return <html><body/></html>}";
    writeFileSync(join(root,'app/layout.js'),layout);
    writeFileSync(join(root,'app/page.js'),'export default function Home(){return <main/>}');
    assert.throws(()=>execFileSync(process.execPath,[script],{cwd:root,stdio:'pipe'}));
    assert.equal(readFileSync(join(root,'app/layout.js'),'utf8'),layout);
  } finally {rmSync(root,{recursive:true,force:true});}
});
