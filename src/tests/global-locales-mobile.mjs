import {chromium} from "playwright";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
try{
 for(const [code,dir] of [["en","ltr"],["es","ltr"],["pt","ltr"],["fr","ltr"],["de","ltr"],["ar","rtl"]]){
  const context=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/api/**",route=>route.abort("blockedbyclient"));
  const response=await page.goto("http://localhost:3100/global/"+code,{waitUntil:"domcontentloaded"});
  assert.equal(response.status(),200,code+" returns 200");
  const main=page.locator("main.lxglobal");
  assert.equal(await main.getAttribute("lang"),code);
  assert.equal(await main.getAttribute("dir"),dir);
  assert.equal(await page.locator("link[rel=canonical]").getAttribute("href"),"https://litix.net/global/"+code);
  const links=page.locator(".lxglobal-languages a");
  assert.equal(await links.count(),6);
  assert.equal(await page.locator(".lxglobal-languages a[aria-current=page]").getAttribute("href"),"/global/"+code);
  assert.equal(await page.locator('a[href="/#services"]').count(),2,"CTA and service card remain navigable");
  assert.equal(await page.locator('a[href="/track"]').count(),1);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  assert.equal(overflow,false,code+" must not overflow mobile viewport");
  assert.deepEqual(errors,[],"no browser errors "+code);
  console.log("LITIX_GLOBAL_PASS",code,dir,response.status());
  await context.close();
 }
 const desktop=await browser.newPage({viewport:{width:1280,height:800}});
 const r=await desktop.goto("http://localhost:3100/global/ar",{waitUntil:"domcontentloaded"});
 assert.equal(r.status(),200);
 assert.equal(await desktop.locator("main").getAttribute("dir"),"rtl");
 await desktop.close();
 const missing=await browser.newPage();
 const notFound=await missing.goto("http://localhost:3100/global/unknown",{waitUntil:"domcontentloaded"});
 assert.equal(notFound.status(),404);
 await missing.close();
}finally{await browser.close();}
