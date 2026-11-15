import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({
 headless:true,executablePath:process.env.CHROME_PATH||undefined,
 args:["--no-sandbox"]
});
const product=(platform,kind,tier,price,min=100)=>({
 id:"curated_"+platform.toLowerCase()+"_"+kind+"_"+tier,
 sku:platform.toLowerCase()+"_"+kind,platform,kind,tier,
 name:platform+" "+kind,label:platform==="TikTok"?"Active-look service":"High Quality",
 purchasable:true,preview:false,min,max:10000,unitStep:1,
 per1000:price,pricingRule:"ceil",startingAmountCents:100,
 quantityCards:[100,250,500,1000,2500,5000].map(quantity=>({
  quantity,totalCents:quantity>=min?Math.ceil(price*quantity/10):null,
  available:quantity>=min
 }))
});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({
   viewport:{width,height:850},isMobile:width<600,hasTouch:width<600
  });
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/api/config",route=>route.fulfill({
   status:200,contentType:"application/json",
   body:'{"ready":false,"publicKey":null}'
  }));
  await page.route("**/api/catalog/v1?*",route=>route.fulfill({
   status:200,contentType:"application/json",
   body:'{"items":[],"allCount":0,"total":0,"checkoutEnabled":false}'
  }));
  await page.route("**/api/public-activity",route=>route.fulfill({
   status:200,contentType:"application/json",body:'{"available":false}'
  }));
  await page.route("**/api/catalog/curated",async route=>{
   await new Promise(resolve=>setTimeout(resolve,1600));
   await route.fulfill({
    status:200,contentType:"application/json",
    body:JSON.stringify({products:[
     product("Instagram","followers","standard",11.02,100),
     product("Instagram","likes","standard",6,250),
     product("TikTok","followers","standard",9,250),
     product("TikTok","likes","standard",6,250),
     product("TikTok","comments","standard",79.8,100)
    ],extras:{autoLikesEnabled:false}})
   });
  });
  await page.route("**/api/checkout/v1",()=>{throw Error("No live charge allowed")});
  await page.goto("http://localhost:3100/",{waitUntil:"domcontentloaded"});
  const grid=page.locator(".litix-curated-package-grid");
  await grid.waitFor();
  assert.match(await page.locator(".totalbox .total").innerText(),/\$11\.02/);
  const choose250=grid.getByRole("button",{name:/250\s+Followers/});
  await choose250.click();
  assert.match(await page.locator(".totalbox .total").innerText(),/\$2\.76/);
  await page.waitForFunction(()=>document.querySelector(".litix-curated-notice")?.textContent?.includes("Verified Litix pricing"),null,{timeout:10000});
  assert.equal(await grid.locator('button[aria-pressed="true"]').count(),1);
  assert.match(await grid.locator('button[aria-pressed="true"]').innerText(),/250/);
  assert.match(await page.locator(".totalbox .total").innerText(),/\$2\.76/,
   "Supplier price refresh must not reset buyer quantity to 1,000");
  assert.equal(await page.locator(".premium-pay-button").isDisabled(),true);
  await page.getByRole("group",{name:"Choose social platform"}).getByRole("button",{name:"TikTok"}).click();
  assert.match(await page.locator(".totalbox .total").innerText(),/\$9\.00/);
  assert.match(await page.locator(".litix-curated-tiers").innerText(),/Active \/ Real-Look/);
  assert.equal(await page.locator(".litix-curated-tiers button").count(),1,
   "Do not display the same supplier as an imaginary duplicate VIP");
  await page.getByRole("group",{name:"Choose service type"}).getByRole("button",{name:"Likes"}).click();
  assert.match(await page.locator(".totalbox .total").innerText(),/\$6\.00/);
  assert.equal(await page.getByRole("group",{name:"Choose service type"}).getByRole("button",{name:"Views"}).isDisabled(),true,
   "Genuinely missing supplier services must remain unavailable");
  assert.deepEqual(errors,[]);
  await context.close();
  console.log("PASS verified TikTok standard fallback + retained quantity + disabled unverified payment",width);
 }
}finally{await browser.close();}
