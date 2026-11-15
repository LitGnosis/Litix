import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,
 executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
const example={
 id:"curated_instagram_followers_standard",sku:"instagram_followers",
 platform:"Instagram",kind:"followers",tier:"standard",name:"Instagram Followers",
 label:"High Quality",purchasable:true,min:90,max:5000,unitStep:1,
 per1000:11.02,pricingRule:"ceil",startingAmountCents:100,
 quantityCards:[100,250,500,1000,2500,5000].map(quantity=>({
  quantity,totalCents:Math.ceil(11.02*quantity/10),available:true
 }))
};
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:850},
   hasTouch:width<600,isMobile:width<600});
  const page=await context.newPage();
  const pageerrors=[];
  page.on("pageerror",e=>pageerrors.push(e.message));
  await page.route("**/api/catalog/curated",async route=>{
   await new Promise(r=>setTimeout(r,900));
   await route.fulfill({status:200,contentType:"application/json",
    body:JSON.stringify({products:[example],extras:{}})});
  });
  await page.route("**/api/config",route=>route.fulfill({
   status:200,contentType:"application/json",body:'{"ready":false,"publicKey":null}'
  }));
  await page.route("**/api/catalog/v1?*",route=>route.fulfill({
   status:200,contentType:"application/json",
   body:'{"items":[],"allCount":0,"total":0,"checkoutEnabled":false}'
  }));
  await page.route("**/api/checkout/cart-quote",route=>route.fulfill({
   status:200,contentType:"application/json",
   body:JSON.stringify({ready:true,serviceId:example.id,quantity:1000,
    mainAmountCents:1102,totalCents:1402,
    bump:{kind:"likes",quantity:500,amountCents:300,targetRequired:true}})
  }));
  await page.route("**/api/checkout/readiness?*",route=>route.fulfill({
   status:503,contentType:"application/json",body:'{"ready":false}'
  }));
  await page.route("**/api/checkout/v1",()=>{throw Error("Card charge blocked in UI test");});
  await page.goto("http://localhost:3100/",{waitUntil:"domcontentloaded"});
  assert.equal(await page.getByText("Preparing the focused checkout…").count(),0);
  assert.equal(await page.locator(".litix-curated-platforms button").count(),2);
  assert.equal(await page.locator(".litix-curated-kinds button").count(),4);
  assert.equal(await page.locator(".litix-curated-package-grid button").count(),6);
  await page.waitForFunction(()=>document.querySelector(".litix-curated-tier-description")?.textContent?.includes("High Quality"),null,{timeout:9000});
  const bump=page.locator(".litix-cart-bump-toggle input");
  await bump.waitFor({timeout:9000});
  await bump.check();
  await page.waitForFunction(()=>document.querySelector(".totalbox .total")?.textContent?.includes("14.02"),null,{timeout:9000});
  assert.equal(await page.locator(".litix-cart-bump-link input").count(),1);
  assert.equal(await page.locator(".premium-pay-button").isDisabled(),true);
  assert.deepEqual(pageerrors,[]);
  await context.close();
  console.log("PASS immediate preview, dynamic cart bump and no charge",width);
 }
}finally{await browser.close();}
