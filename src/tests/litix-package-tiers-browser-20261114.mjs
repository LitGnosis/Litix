import assert from "node:assert/strict";
import {chromium} from "playwright";

// All remote catalog, PayKings and supplier-order calls are intercepted.
// This checks UI conversions without a real payment or fulfillment attempt.
const browser=await chromium.launch({
 headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]
});
try{
 for(const width of [375,1280]){
  const context=await browser.newContext({
   viewport:{width,height:880},isMobile:width<600,hasTouch:width<600
  });
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/api/config",route=>route.fulfill({
   status:200,contentType:"application/json",body:'{"ready":false,"publicKey":null}'
  }));
  await page.route("**/api/catalog/v1?*",route=>route.fulfill({
   status:200,contentType:"application/json",
   body:'{"catalogStatus":"cached","checkoutEnabled":false,"items":[],"categories":[],"allCount":1196,"total":0}'
  }));
  await page.route("**/api/catalog/checkout-choices?*",route=>route.fulfill({
   status:503,contentType:"application/json",body:'{"error":"test offline"}',delay:8500
  }));
  await page.route("**/api/checkout/readiness?*",route=>route.fulfill({
   status:503,contentType:"application/json",
   body:'{"ready":false,"chargeAttempted":false,"error":"Test mode: unavailable"}'
  }));
  await page.route("**/api/checkout/v1",()=>{throw Error("Checkout should not charge in this test")});
  await page.goto("http://localhost:3100/",{waitUntil:"domcontentloaded"});
  const selector=page.locator("#litix-service-choice");
  await selector.waitFor();
  await page.waitForFunction(()=>{
   const x=document.querySelector("#litix-service-choice");
   return x?.value==="litix_2132"&&!x.disabled;
  },null,{timeout:3000});
  assert.equal(await page.locator("#litix-platform").inputValue(),"Instagram");
  assert.equal(await page.locator("#litix-service-kind").inputValue(),"followers");
  assert.equal(await page.locator("#litix-quantity-custom").inputValue(),"1000");
  const total=page.locator(".totalbox .total");
  assert.match(await total.innerText(),/11\.02/);
  const options=await selector.locator("option").allTextContents();
  assert.ok(options.some(t=>t.includes("High quality")&&t.includes("4K/day")));
  assert.ok(options.some(t=>t.includes("Premium quality")&&t.includes("5K/day")));
  assert.ok(options.some(t=>t.includes("Active-look")&&t.includes("5K/day")));
  assert.ok(options.some(t=>t.includes("Instagram Colombia Followers")));
  assert.ok(!options.some(t=>t.includes("Columbia")));
  assert.ok(!options.some(t=>t.includes("1,244")));
  assert.equal(await page.locator(".nav.litix-home-nav a[href='#checkout']").count(),0);
  const presets=page.getByRole("group",{name:"Quick quantity presets"});
  for(const value of ["250","500","1,000","2,500","5,000"])
   assert.equal(await presets.getByRole("button",{name:value,exact:true}).count(),1);
  await presets.getByRole("button",{name:"250",exact:true}).click();
  assert.equal(await page.locator("#litix-quantity-custom").inputValue(),"250");
  assert.match(await total.innerText(),/2\.76/);
  await page.locator("#litix-quantity-custom").fill("7000");
  await page.locator("#litix-quantity-custom").press("Tab");
  assert.equal(await page.locator("#litix-quantity-custom").inputValue(),"5000");
  assert.match(await total.innerText(),/55\.10/);
  const specialty=page.getByRole("button",{name:/Show Specialty \/ Custom options/});
  await specialty.click();
  const options2=await selector.locator("option").allTextContents();
  assert.ok(options2.some(t=>t.includes("1,244.88")));
  await selector.selectOption("litix_2145");
  assert.equal(await page.locator("#litix-quantity-custom").inputValue(),"200");
  assert.equal(await presets.getByRole("button",{name:"1,000",exact:true}).isDisabled(),true);
  await selector.selectOption("litix_2132");
  assert.equal(await page.locator("#litix-quantity-custom").inputValue(),"1000");
  const faq=page.locator("#faq");
  await faq.getByText("Where can I check my order?").click();
  await faq.getByText("Bookmark your private tracking link for one-click status updates",{exact:false}).waitFor();
  await faq.getByText("When will my order be processed?").click();
  await faq.getByText("Eligible orders can begin processing within minutes",{exact:false}).waitFor();
  assert.deepEqual(errors,[]);
  console.log("PASS Litix distinct tiers, default qty, specialty and FAQ",width);
  await context.close();
 }
}finally{await browser.close()}
