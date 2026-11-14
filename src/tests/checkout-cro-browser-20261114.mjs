import assert from "node:assert/strict";
import {chromium} from "playwright";

// All payment operations are mocked: no card token or charge is ever created.
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{
  window.__mockPaymentCalls=0;
  window.CollectJS={
   configure(options){queueMicrotask(()=>options.fieldsAvailableCallback?.());},
   startPaymentRequest(){window.__mockPaymentCalls++;}
  };
 });
 const page=await context.newPage();
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 let readinessCount=0;
 await page.route("**/api/config",route=>route.fulfill({status:200,contentType:"application/json",
  body:JSON.stringify({ready:true,publicKey:"mock-browser-tokenization-key"})}));
 await page.route("**/api/catalog/v1?*",route=>route.fulfill({status:200,contentType:"application/json",
  body:JSON.stringify({catalogStatus:"cached",checkoutEnabled:true,items:[],categories:[],allCount:100,total:0})}));
 await page.route("**/api/catalog/checkout-choices?*",route=>route.fulfill({status:200,contentType:"application/json",
  body:JSON.stringify({catalogStatus:"static",items:[]})}));
 await page.route("**/api/checkout/readiness?*",route=>{
  readinessCount++;
  const q=new URL(route.request().url()).searchParams;
  return route.fulfill({status:200,contentType:"application/json",
   body:JSON.stringify({ready:true,serviceId:q.get("serviceId"),quantity:Number(q.get("quantity")),
    amountCents:Number(q.get("expectedAmountCents")),chargeAttempted:false})});
 });
 await page.route("**/api/checkout/v1",route=>{throw Error("No-charge UI regression must not submit a token");});
 await page.goto("http://localhost:3100/",{waitUntil:"domcontentloaded"});
 const trust=page.locator("#checkout .litix-checkout-trust li");
 assert.equal(await trust.count(),3,"three source-grounded trust indicators beneath PayKings CTA");
 assert.match(await trust.allInnerTexts().then(v=>v.join(" | ").replace(/\s+/g," ")),/Live service verification.*Private order tracking.*PayKings-hosted card fields/);
 assert.equal(await page.locator("#checkout input[aria-label='Public profile or post link']").getAttribute("placeholder"),
  "e.g. @username or https://instagram.com/username");
 assert.equal(await page.locator("#litix-link-feedback").innerText(),"","no duplicate URL prompt before input");
 const cta=page.locator("#checkout button.premium-pay-button");
 await cta.waitFor();
 assert.equal(await cta.count(),1);
 assert.equal(await cta.isDisabled(),true,"CTA is visible and disabled with blank required fields");
 assert.match(await cta.innerText(),/Continue to Secure Checkout/);
 assert.equal(await page.locator(".selected-service-meta").count(),0);
 assert.equal(await page.locator("#checkout .totalbox .small").innerText(),"Total (USD)");
 assert.equal(await page.locator(".premium-checkout-helper").innerText(),"Paste a valid public profile or post link to continue.");
 const allowed=await page.locator(".litix-quick-chosen").innerText();
 assert.match(allowed,/Allowed quantity: \d[\d,]*–\d[\d,]*/);
 assert.doesNotMatch(allowed,/–\s+\d/);
 await page.locator("#checkout input[aria-label='Public profile or post link']").fill("https://www.instagram.com/testcreator/");
 await page.getByText("Enter your email address for your receipt and private tracking link.",{exact:true}).waitFor();
 await page.locator("#checkout input[type=email]").fill("qa@example.com");
 await page.locator("#litix-quantity-custom").fill("1");
 await page.getByText(/Enter a quantity between [\d,]+ and [\d,]+\./).waitFor();
 await page.locator("#litix-quantity-custom").fill("1000");
 await page.waitForFunction(()=>!document.querySelector(".premium-checkout-helper"));
 await page.waitForFunction(()=>{
  const el=document.querySelector("#checkout button.premium-pay-button");
  return el && !el.disabled && el.textContent.includes("Pay with PayKings");
 },null,{timeout:15000});
 assert.match(await cta.innerText(),/Pay with PayKings.*USD/);
 const initialReadiness=readinessCount;
 await cta.click();
 await page.waitForFunction(()=>window.__mockPaymentCalls===1,null,{timeout:15000});
 assert.ok(readinessCount>initialReadiness,"click must re-check live price/eligibility");
 assert.equal(await page.locator(".premium-pay-spinner").count(),1,"CTA displays processing spinner");
 const footer=await page.locator("footer.end").innerText();
 assert.ok(footer.includes("Innovation, Ignited. Direct Social Media Growth & Campaign Workflows"));
 for(const [href,label] of [["/legal/privacy","Privacy Policy"],["/terms","Terms of Service"],["/refunds","Refunds & Order Issues"]]){
  const link=page.locator(`footer.end .legal-links a[href="${href}"]`);
  assert.equal(await link.count(),1,`footer legal link ${href} appears once`);
  assert.equal(await link.innerText(),label);
  assert.equal(await page.locator(`#faq a[href="${href}"]`).count(),0);
 }
 assert.equal(await page.locator(".checkout-hint").count(),0);
 assert.equal(await page.locator(".premium-checkout-security").count(),1);
 assert.deepEqual(errors,[]);
 console.log("PASS checkout CRO: visible invalid CTA, enabled valid CTA, live preflight, no charge");
 await context.close();
}finally{await browser.close()}
