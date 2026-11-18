import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,
 executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});

function makeOffer(platform,kind,per1000){
 const sku=platform.toLowerCase()+"_"+kind;
 return {
  id:"curated_"+sku+"_standard",sku,platform,kind,tier:"standard",
  name:platform+" "+kind,label:"High Quality",
  purchasable:true,preview:false,min:90,max:5000,unitStep:1,
  per1000,pricingRule:"ceil",startingAmountCents:100,
  quantityCards:[100,250,500,1000,2500,5000].map(q=>({
   quantity:q,totalCents:Math.ceil(per1000*q/10),available:true
  }))
 };
}
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},
   hasTouch:width<600,isMobile:width<600});
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
  await page.route("**/api/catalog/curated",async route=>{
   await new Promise(resolve=>setTimeout(resolve,1250));
   await route.fulfill({
    status:200,contentType:"application/json",
    body:JSON.stringify({products:[
     makeOffer("Instagram","followers",11.02),
     makeOffer("Instagram","likes",6),
     makeOffer("Instagram","views",3),
     makeOffer("TikTok","followers",33.43),
     makeOffer("TikTok","likes",11.02),
     makeOffer("TikTok","views",3)
    ],extras:{}})
   });
  });
  await page.route("**/api/public-activity",route=>route.fulfill({
   status:200,contentType:"application/json",body:'{"available":false}'
  }));
  await page.route("**/api/checkout/v1",()=>{throw Error("Unexpected live card payment")});
  await page.goto("http://localhost:3100/",{waitUntil:"domcontentloaded"});
  assert.equal(await page.getByText("Preparing the focused checkout…").count(),0);
  assert.equal(await page.getByText("Not currently verified").count(),0);
  assert.equal(await page.getByText("Previously listed · Check live price before checkout").count(),0);
  assert.equal(await page.getByText("Price estimates from a saved catalog.",{exact:false}).count(),0);
  assert.equal(await page.getByText("Choose a package in Step 03.").count(),0);
  assert.equal(await page.getByText("Choose a package to continue.").count(),0);
  assert.equal(await page.locator(".litix-curated-tiers button").count(),1);
  assert.ok(["Checking live supplier limits","90–5,000 units"].includes(
   await page.locator(".litix-curated-range").innerText()));
  assert.equal(await page.locator(".litix-curated-package-grid button[aria-pressed=true]").count(),1);
  assert.match(await page.locator(".litix-curated-package-grid button[aria-pressed=true]").innerText(),/1,000/);
  assert.match(await page.locator(".totalbox .total").innerText(),/\$11\.02/);
  assert.equal(await page.locator('.litix-early-link input').getAttribute("placeholder"),
   "e.g. @username or https://instagram.com");
  assert.equal(await page.locator(".premium-pay-button").isDisabled(),true,
   "PayKings cannot charge without verified payment details");
  await page.waitForFunction(()=>document.querySelector(".litix-curated-range")?.textContent?.includes("5,000 units"),null,{timeout:10000});
  assert.equal(await page.locator(".litix-curated-range").innerText(),"90–5,000 units");
  assert.equal(await page.locator(".litix-curated-tiers button").count(),1,
   "Unverified VIP is fully hidden");
  const kinds=page.getByRole("group",{name:"Choose service type"});
  await kinds.getByRole("button",{name:"Likes"}).click();
  assert.equal(await page.locator('.litix-early-link input').getAttribute("placeholder"),
   "e.g. https://instagram.com... or /reel/...");
  const platforms=page.getByRole("group",{name:"Choose social platform"});
  await platforms.getByRole("button",{name:"TikTok"}).click();
  assert.equal(await page.locator('.litix-early-link input').getAttribute("placeholder"),
   "e.g. @username or https://tiktok.com");
  await kinds.getByRole("button",{name:"Likes"}).click();
  assert.equal(await page.locator('.litix-early-link input').getAttribute("placeholder"),
   "e.g. https://tiktok.com...");
  assert.equal(await page.locator(".litix-curated-featured").filter({hasText:/Save \d+%/}).count(),0);
  assert.deepEqual(errors,[]);
  console.log("PASS mobile/desktop curated copy, featured SSR and placeholders",width);
  await context.close();
 }
}finally{await browser.close();}
