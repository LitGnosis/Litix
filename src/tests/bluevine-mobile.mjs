// Isolated local-browser simulations: all payment endpoints are intercepted; NO real charge.
import {chromium} from "playwright";
import assert from "node:assert/strict";
const base="http://localhost:3100";
const urls={
 launch:["https://pay.bluevine.com/p/ecd2c080f8a74e33ac834ed0e9eedc92",5382],
 momentum:["https://pay.bluevine.com/p/23d4ce5549c846b6b50dd4ce233b7723",10782],
 power:["https://pay.bluevine.com/p/5583a248578d48649bb5151c76eb7d4d",19782],
 apex:["https://pay.bluevine.com/p/ae9473e7c1d44aa6bbed123843d945c5",35982]
};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
try{
 for(const platform of ["ig","tt"]){
  for(const [tier,[url,amount]] of Object.entries(urls)){
   const pkg=platform+"_"+tier,ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
   const page=await ctx.newPage();let submitted=0,external=0;const orderId="lbg_12345678-1234-4234-8234-"+String(platform==="ig"?1:2).padStart(6,"0")+String(amount).padStart(6,"0");
   await page.route("**/api/bundles",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({checkoutEnabled:false,bluevineEnabled:true,whatsappConfigured:true,packages:[],publicKey:null})}));
   await page.route("**/api/bundles/bluevine",async route=>{
    submitted++;
    const request=JSON.parse(route.request().postData());
    assert.equal(request.packageId,pkg);
    assert.equal(request.expectedAmountCents,amount);
    assert.equal(request.email,"buyer@example.test");
    assert.equal(request.profile,"@testingcreator");
    assert.equal(request.whatsapp,"+1 214 555 0100");
    assert.equal(request.whatsappConsent,true);
    await route.fulfill({status:201,contentType:"application/json",body:JSON.stringify({orderId,trackingToken:"mock-secret",checkoutUrl:url,payment:"awaiting_payment",status:"Awaiting Payment",pendingNotifications:{owner:true,customer:true}})});
   });
   await page.route("https://pay.bluevine.com/**",route=>{external++;return route.fulfill({status:200,contentType:"text/html",body:"<html><body><h1>SIMULATED BLUEVINE PAYMENT PAGE — NO REAL PAYMENT</h1></body></html>"})});
   await page.route("**/api/bundles/order?*",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({order:{id:orderId,package:(platform==="ig"?"Instagram ":"TikTok ")+tier+" Growth Bundle",payment:"awaiting_payment",paymentProvider:"bluevine",status:"Awaiting Payment"},posts:[],deliveries:[],instructions:"Send up to 10 post links or screenshots through WhatsApp.",whatsappUrl:"https://wa.me/12145550100?text=order"})}));
   await page.goto(base+"/bundles",{waitUntil:"networkidle"});
   assert.equal(await page.getByRole("link",{name:"Pay with Bluevine"}).count(),4,"all four cards retain Bluevine buttons");
   if(platform==="tt")await page.getByRole("button",{name:"TikTok"}).click();
   const link=page.locator('a.lg-bundle-bluevine[href*="package='+pkg+'"]');
   assert.equal(await link.count(),1);
   await link.click();
   await page.waitForURL("**/bundles/checkout?*");
   assert.equal(await page.locator("h2").first().textContent().then(x=>x.includes("$"+(amount/100).toFixed(2))),true);
   await page.locator('input[type="email"]').fill("buyer@example.test");
   await page.locator('input[placeholder="@yourprofile"]').fill("@testingcreator");
   await page.locator('input[type="tel"]').fill("+1 214 555 0100");
   await page.locator('input[type="checkbox"]').check();
   const disabled=await page.getByRole("button",{name:/Pay with Bluevine/}).isDisabled();
   assert.equal(disabled,false);
   await page.getByRole("button",{name:/Pay with Bluevine/}).click();
   await page.waitForURL(url,{timeout:10000});
   assert.equal(submitted,1);
   assert.equal(external,1,"exact hosted URL reached, intercepted without charge");
   await page.goto(base+"/bundles/confirmation?id="+orderId,{waitUntil:"networkidle"});
   await page.getByRole("heading",{name:"Order status and WhatsApp submission"}).waitFor();
   await page.getByText(orderId,{exact:false}).first().waitFor();
   await page.getByText("NOT marked paid",{exact:false}).waitFor();
   await page.getByRole("link",{name:/Message LITIX on WhatsApp/}).waitFor();
   assert.equal(await page.locator('input[type="password"]').count(),0,"no customer login required");
   console.info("PASS simulated mobile",pkg,amount,url,"pending+WhatsApp+tracking; no charge");
   await ctx.close();
  }
 }
}finally{await browser.close()}
