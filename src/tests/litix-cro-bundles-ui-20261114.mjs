// Real Playwright clicks, all payment calls intercepted. No supplier orders or charges.
import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({
 headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]
});
let attemptedCharges=0;
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/api/bundles",route=>route.fulfill({
  status:200,contentType:"application/json",
  body:JSON.stringify({checkoutEnabled:false,autoFulfillmentEnabled:false,
   bluevineEnabled:false,packages:[],whatsappConfigured:true,publicKey:null})
 }));
 await page.route("**/api/bundles/checkout",route=>{
  attemptedCharges++;
  return route.fulfill({status:409,contentType:"application/json",
   body:'{"error":"Test safety boundary; no charge attempted","chargeAttempted":false}'});
 });
 await page.goto("http://localhost:3100/bundles",{waitUntil:"domcontentloaded"});
 await page.locator("#growth-bundles").waitFor();
 await page.locator("#litix-bundle-select").selectOption("Apex");
 const checkout=page.getByRole("button",{name:/Continue to Secure Checkout/});
 assert.equal(await checkout.isEnabled(),true);
 assert.match(await checkout.innerText(),/\$359\.82/);
 await checkout.click();
 const fallback=page.getByRole("status").filter({hasText:"No charge was attempted."});
 await fallback.waitFor();
 assert.equal(await page.getByRole("button",{name:"Retry secure checkout"}).isEnabled(),true);
 assert.ok((await page.getByRole("link",{name:"WhatsApp Concierge"}).count())>0);
 await page.getByRole("button",{name:"Retry secure checkout"}).click();
 await fallback.waitFor();
 assert.equal(attemptedCharges,0,"no live bundle card charge when release gate is disabled");
 await page.getByRole("link",{name:"Review package details"}).click();
 await page.locator('h1').getByText("Purchase Bundle").waitFor();
 await page.getByRole("button",{name:"Retry PayKings verification"}).click();
 await page.getByText("No card payment can be submitted", {exact:false}).waitFor();
 assert.equal(attemptedCharges,0);
 assert.deepEqual(errors,[]);
 console.log("PASS CRO BUNDLE: active CTA, live-gated preflight, retry, concierge, no charge");
 await page.close();
}finally{await browser.close()}
