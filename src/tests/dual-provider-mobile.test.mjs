// End-to-end 390px mobile UI verification. BOTH gateways and Collect.js are mocked;
// no payment token is genuine and no real charge can be made.
import {chromium} from "playwright";
import assert from "node:assert/strict";
const base="http://localhost:3100";
const tiers={launch:5382,momentum:10782,power:19782,apex:35982};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
try{
 for(const platform of ["ig","tt"]){
  for(const [tier,cents] of Object.entries(tiers)){
   const pkg=platform+"_"+tier;
   const id="lbg_12345678-1234-4234-8234-"+String(platform==="ig"?1:2).padStart(6,"0")+String(cents).padStart(6,"0");
   const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
   const page=await ctx.newPage();
   let mockedGatewayCalls=0,collectCalls=0;
   await page.route("**/api/bundles",route=>route.fulfill({status:200,contentType:"application/json",
     body:JSON.stringify({checkoutEnabled:true,bluevineEnabled:true,whatsappConfigured:true,publicKey:"fake-test-public-key",packages:[]})}));
   await page.route("https://secure.nmi.com/token/Collect.js",async route=>{
    collectCalls++;
    await route.fulfill({status:200,contentType:"application/javascript",body:
     'window.CollectJS={configure:function(o){this.cb=o.callback;setTimeout(function(){o.fieldsAvailableCallback()},0)},startPaymentRequest:function(){this.cb({token:"safe-mock-collect-token"})}};'});
   });
   await page.route("**/api/bundles/checkout",async route=>{
    mockedGatewayCalls++;
    const data=JSON.parse(route.request().postData());
    assert.equal(data.packageId,pkg);
    assert.equal(data.expectedAmountCents,cents);
    assert.equal(data.email,"buyer@example.test");
    assert.equal(data.profile,"@testingcreator");
    assert.equal(data.paymentToken,"safe-mock-collect-token");
    assert.equal(data.whatsappConsent,true);
    assert.ok(/^[a-f0-9-]{36}$/i.test(data.idempotencyKey));
    await route.fulfill({status:202,contentType:"application/json",
      body:JSON.stringify({orderId:id,trackingToken:"mock-private-token",payment:"approved_pending_settlement",status:"Awaiting WhatsApp Submission"})});
   });
   await page.route("**/api/bundles/order?*",route=>route.fulfill({status:200,contentType:"application/json",
     body:JSON.stringify({order:{id,package:(platform==="ig"?"Instagram ":"TikTok ")+tier+" Growth Bundle",
       platform:platform==="ig"?"Instagram":"TikTok",amount:(cents/100).toFixed(2),
       payment:"approved_pending_settlement",paymentProvider:"paykings",status:"Awaiting WhatsApp Submission"},
       posts:[],deliveries:[],instructions:"Choose WhatsApp, email or Instagram to submit up to 10 posts.",
       whatsappUrl:"https://wa.me/12145550100?text=order"})}));
   await page.goto(base+"/bundles",{waitUntil:"networkidle"});
   assert.equal(await page.getByRole("link",{name:"Pay with PayKings"}).count(),4);
   assert.equal(await page.getByRole("link",{name:"Pay with Bluevine"}).count(),4);
   if(platform==="tt")await page.getByRole("button",{name:"TikTok"}).click();
   await page.locator('a.lg-bundle-buy[href*="package='+pkg+'"]').click();
   await page.waitForURL("**/bundles/checkout?*");
   await page.getByRole("button",{name:"Pay with PayKings",exact:true}).waitFor();
   assert.equal(await page.getByRole("button",{name:"Pay with PayKings",exact:true}).getAttribute("aria-pressed"),"true");
   assert.equal(await page.locator('section[aria-label="Bluevine payment option"]').count(),0,"only one gateway exposed");
   await page.locator('input[type="email"]').fill("buyer@example.test");
   await page.locator('input[placeholder="@yourprofile"]').fill("@testingcreator");
   await page.locator('input[type="checkbox"][required]').check();
   const pay=page.getByRole("button",{name:/^Pay with PayKings —/});
   await pay.waitFor();
   await page.waitForFunction(()=>!!window.CollectJS);
   // Collect.js is mocked; the production PayKings gateway is not contacted.
   await page.waitForTimeout(100);
   assert.equal(await pay.isDisabled(),false,"mock card fields are ready");
   await pay.click();
   await page.waitForURL("**/bundles/confirmation?id=*",{timeout:12000});
   assert.equal(mockedGatewayCalls,1);
   assert.equal(collectCalls,1);
   await page.getByRole("heading",{name:"Order confirmation and submission"}).waitFor();
   await page.getByText("Payment is NOT marked paid yet.",{exact:false}).waitFor();
   await page.getByText(id,{exact:false}).first().waitFor();
   assert.equal(await page.getByRole("link",{name:"Send Order Details via WhatsApp"}).count(),1);
   assert.equal(await page.getByRole("link",{name:"Email My Order Details"}).count(),1);
   assert.equal(await page.getByRole("link",{name:"Message LITIX on Instagram"}).count(),1);
   console.info("PASS PAYKINGS MOCK MOBILE",pkg,cents,"one checkout; remains pending independent settlement; no charge");
   await ctx.close();
  }
 }
}finally{await browser.close()}
