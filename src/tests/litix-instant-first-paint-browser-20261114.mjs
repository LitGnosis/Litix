import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,
 executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},
   hasTouch:width<600,isMobile:width<600});
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/api/config",route=>route.fulfill({
   status:200,contentType:"application/json",body:'{"ready":false,"publicKey":null}'}));
  await page.route("**/api/catalog/v1?*",route=>route.fulfill({
   status:200,contentType:"application/json",
   body:'{"items":[],"allCount":0,"total":0,"checkoutEnabled":false}'}));
  await page.route("**/api/catalog/curated",async route=>{
   await new Promise(resolve=>setTimeout(resolve,1800));
   await route.fulfill({status:200,contentType:"application/json",
    body:JSON.stringify({products:[{
     id:"curated_instagram_followers_standard",platform:"Instagram",kind:"followers",
     tier:"standard",sku:"instagram_followers",name:"Instagram Followers",
     label:"High Quality",min:90,max:5000,unitStep:1,purchasable:true,
     per1000:11.02,pricingRule:"ceil",startingAmountCents:100,
     quantityCards:[100,250,500,1000,2500,5000].map(quantity=>({
      quantity,totalCents:Math.ceil(quantity*11.02/10),available:quantity>=90
     }))
    }],extras:{}})});
  });
  await page.route("**/api/checkout/v1",()=>{throw Error("No charge allowed in first-paint test")});
  await page.goto("http://localhost:3100/",{waitUntil:"domcontentloaded"});
  assert.equal(await page.getByText("Preparing the focused checkout…").count(),0);
  assert.equal(await page.locator(".litix-curated-platforms button").count(),2);
  assert.equal(await page.locator(".litix-curated-kinds button").count(),4);
  assert.equal(await page.locator(".litix-curated-package-grid button").count(),6);
  assert.equal(await page.locator(".litix-curated-browse").getAttribute("href"),"/services");
  assert.equal(await page.locator(".litix-curated-notice").count(),0,
   "Preview need not repeat payment verification claims");
  await page.waitForFunction(()=>document.querySelector(".litix-curated-tier-description")?.textContent?.includes("High Quality"),null,{timeout:10000});
  assert.equal(await page.locator(".premium-pay-button").isDisabled(),true);
  assert.deepEqual(errors,[]);
  console.log("PASS first paint is immediate while live catalog is slow",width);
  await context.close();
 }
}finally{await browser.close();}
