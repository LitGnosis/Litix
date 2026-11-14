import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
try{
 for(const width of [375,1280]){
  const ctx=await browser.newContext({viewport:{width,height:820},isMobile:width<600,hasTouch:width<600});
  const page=await ctx.newPage();
  await page.goto("http://localhost:3100/",{waitUntil:"domcontentloaded"});
  assert.equal(await page.locator('a[href="/bundles"]').count(),0,"no retired bundle CTAs on homepage");
  await page.goto("http://localhost:3100/workspace",{waitUntil:"domcontentloaded"});
  assert.equal(await page.locator('a[href="/bundles"]').count(),0,"no retired bundle CTAs in workspace");
  for(const path of ["/bundles","/bundles/checkout?package=ig_launch"]){
   await page.goto("http://localhost:3100"+path,{waitUntil:"domcontentloaded"});
   assert.equal(new URL(page.url()).pathname,"/services","old purchase page must redirect to active catalog");
  }
  const get=await ctx.request.get("http://localhost:3100/api/bundles");
  assert.equal(get.status(),410);
  const listing=await get.json();
  assert.deepEqual(listing.packages,[]);
  assert.equal(listing.checkoutEnabled,false);
  for(const path of ["/api/bundles/checkout","/api/bundles/bluevine"]){
   const r=await ctx.request.post("http://localhost:3100"+path,{
    headers:{"content-type":"application/json"},
    data:{packageId:"ig_launch",expectedAmountCents:5382,idempotencyKey:"test-never-charge"}
   });
   assert.equal(r.status(),410,"retired payment boundary must block new charges");
   const body=await r.json();
   assert.equal(body.code,"BUNDLES_RETIRED");
   assert.equal(body.chargeAttempted,false);
  }
  const confirmation=await ctx.request.get("http://localhost:3100/bundles/confirmation");
  assert.notEqual(confirmation.status(),404,"historical order confirmation route stays available");
  console.log("PASS bundle removal + no-charge routes",width);
  await ctx.close();
 }
}finally{await browser.close()}
