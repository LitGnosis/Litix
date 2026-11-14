import assert from "node:assert/strict";
import {chromium} from "playwright";

// Browser-level stress: API deliberately stalls past the 4-second deadline.
// No real supplier purchases, PayKings charges, or personal data calls.
const browser=await chromium.launch({
 headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]
});
try{
 for(const width of [375,1280]){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width<550,hasTouch:width<550});
  const page=await context.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/api/config",route=>route.fulfill({status:200,contentType:"application/json",
   body:JSON.stringify({ready:false,publicKey:null})}));
  await page.route("**/api/catalog/v1?*",route=>route.fulfill({status:200,contentType:"application/json",
   body:JSON.stringify({catalogStatus:"cached",checkoutEnabled:false,items:[],categories:[],allCount:1196,total:0})}));
  await page.route("**/api/catalog/checkout-choices?*",route=>route.fulfill({status:503,contentType:"application/json",
   body:'{"error":"catalog temporarily offline"}',delay:8500}));
  await page.route("**/api/checkout/readiness?*",route=>route.fulfill({status:503,contentType:"application/json",
   body:'{"ready":false,"chargeAttempted":false,"error":"Live checkout not available"}'}));
  await page.route("**/api/checkout/v1",route=>{throw Error("UI test must never attempt a card charge")});
  await page.goto("http://localhost:3100/",{waitUntil:"domcontentloaded"});
  await page.locator("#litix-service-choice").waitFor();
  await page.waitForFunction(()=>{
   const choice=document.getElementById("litix-service-choice");
   return choice&&choice.options.length>=3&&choice.value.startsWith("litix_")&&!choice.disabled;
  },null,{timeout:3000});
  assert.equal(await page.locator("#litix-platform").inputValue(),"Instagram");
  assert.equal(await page.locator("#litix-service-kind").inputValue(),"followers");
  assert.ok(Number((await page.locator(".totalbox .total").innerText()).replace(/[^\d.]/g,""))>=1);
  assert.equal(await page.getByText("Loading verified services…").count(),0);
  const picks=page.getByRole("group",{name:"Quick service selection"});
  await picks.getByRole("button",{name:"Instagram Likes"}).click();
  assert.equal(await page.locator("#litix-service-kind").inputValue(),"likes");
  assert.equal(await picks.getByRole("button",{name:"Instagram Likes"}).getAttribute("aria-pressed"),"true");
  const link=page.locator('.litix-early-link input[aria-label="Public profile or post link"]');
  assert.equal(await link.count(),1);
  await link.fill("https://www.instagram.com/account/");
  await page.getByText("Instagram Likes and Views require a public post or reel URL", {exact:false}).waitFor();
  await link.fill("https://www.instagram.com/p/AbCd123/");
  await page.getByText("Link format looks valid for Instagram likes.",{exact:false}).waitFor();
  await page.locator("#checkout input[type=email]").fill("customer@example.com");
  assert.ok((await page.getByRole("button",{name:/Verify secure checkout/}).count())>=1,
   "the verification action stays available even without the payment gateway");
  await page.getByRole("button",{name:/Verify secure checkout/}).click();
  await page.getByText("no charge was attempted",{exact:false}).first().waitFor({timeout:3000});
  await picks.getByRole("button",{name:"TikTok Followers"}).click();
  assert.equal(await page.locator("#litix-platform").inputValue(),"TikTok");
  assert.ok((await page.locator("#litix-service-choice option").count())>=1);
  for(const platform of ["YouTube","Facebook","Twitter (X)"]){
   await page.locator("#litix-platform").selectOption(platform);
   assert.equal(await page.locator("#litix-platform").inputValue(),platform);
   assert.ok((await page.locator("#litix-service-choice option").count())>=1,platform);
   assert.ok((await page.locator(".totalbox .total").count())===1,platform);
  }
  assert.equal(await page.locator(".litix-platform-tabs").count(),0);
  assert.equal(await page.locator(".litix-platform-choices").count(),0);
  const faq=page.locator("#faq");
  await faq.getByText("Where can I check my order?").click();
  await faq.getByText("Order Number + Checkout Email lookup form",{exact:false}).waitFor();
  assert.deepEqual(errors,[]);
  console.log("PASS instant offline checkout bootstrap + synced steps",width);
  await context.close();
 }
}finally{await browser.close()}
