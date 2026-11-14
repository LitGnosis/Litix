// No real payments, supplier adds, OpenAI requests, or customer records.
import assert from "node:assert/strict";
import {chromium} from "playwright";

const orderId="ltx2_12345678-1234-1234-1234-123456789abc";
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
const test=async width=>{
 const context=await browser.newContext({viewport:{width,height:880},isMobile:width<576,hasTouch:width<576});
 const page=await context.newPage();
 const errors=[];
 page.on("pageerror",err=>errors.push(err.message));
 await page.route("**/api/config",route=>route.fulfill({status:200,contentType:"application/json",
   body:JSON.stringify({ready:false,publicKey:null})}));
 await page.route("**/api/catalog/v1?*",route=>route.fulfill({status:200,contentType:"application/json",
   body:JSON.stringify({catalogStatus:"cached",checkoutEnabled:false,items:[],categories:[],allCount:0,total:0})}));
 await page.route("**/api/catalog/checkout-choices?*",route=>route.fulfill({status:200,contentType:"application/json",
   body:JSON.stringify({platforms:[{name:"Instagram",count:1},{name:"Facebook",count:0}],
    platform:"Instagram",kinds:[{value:"likes",label:"Likes",count:1}],
    items:[{id:"litix_1234",name:"Instagram Likes",platform:"Instagram",
      kind:"likes",min:100,max:5000,unitStep:1,per1000:6,
      startingAmountCents:100,purchasable:true}],total:1,
    liveAvailability:false,note:"Browse-only catalog"})}));
 await page.route("**/api/litix-ai",route=>route.fulfill({status:200,contentType:"application/json",
   body:JSON.stringify(route.request().method()==="POST"
     ?{reply:"Guided answer: visit /services",mode:"guided",verified:false}
     :{available:true,mode:"guided",verified:false})}));
 await page.route("**/api/order-lookup",route=>route.fulfill({status:200,contentType:"application/json",
   body:JSON.stringify({order:{id:orderId,service:"Instagram Likes",quantity:100,amount:"1.00",
     payment:"paid",fulfillment:"processing",status:"processing",statusNote:"Saved delivery status."}})}));
 await page.goto("http://localhost:3100/",{waitUntil:"domcontentloaded"});
 await page.locator(".litix-hero-shop").waitFor();
 assert.equal(await page.locator(".litix-early-link input").count(),1);
 await page.locator(".litix-early-link input").fill("https://www.instagram.com/p/abc/");
 await page.locator("#litix-service-choice").waitFor();
 await page.locator("#litix-service-kind").selectOption("likes");
 await page.locator("#litix-service-choice").selectOption("litix_1234");
 assert.equal(await page.locator('#checkout input[placeholder="https://www.instagram.com/p/POST_ID/"]').count(),1);
 assert.equal(await page.locator('#checkout input[placeholder="https://www.instagram.com/p/POST_ID/"]').inputValue(),
  "https://www.instagram.com/p/abc/");
 const grp=page.getByRole("group",{name:"Select a social platform"});
 await grp.getByRole("button",{name:"Facebook"}).click();
 assert.equal(await page.locator('.litix-platform-choices a[href="/shop/facebook/followers"]').count(),1);
 await page.locator(".litix-hero-shop").getByRole("button",{name:"Ask LITIX AI"}).click();
 await page.locator(".lxai-panel").waitFor();
 await page.locator("#lxai-entry").fill("Where is the catalog?");
 await page.locator(".lxai-compose button").click();
 await page.getByText("Guided answer: visit /services").waitFor();
 await page.locator(".lxai-close").click();
 const tracking=page.locator("#tracking");
 await tracking.locator('input[aria-label="Litix order number"]').fill(orderId);
 await tracking.locator('input[aria-label="Checkout email"]').fill("customer@example.com");
 await tracking.getByRole("button",{name:"Check status"}).click();
 await tracking.getByText("Saved delivery status.").waitFor();
 await page.getByRole("button",{name:"7-day content sprint"}).click();
 await page.getByRole("button",{name:"Create campaign"}).click();
 const savedCampaign=page.locator("#campaign-studio .workspace-row").first();
 await savedCampaign.waitFor({state:"attached"});
 const debugCampaign=await savedCampaign.evaluate(el=>{
  const chain=[];let n=el;
  while(n&&chain.length<6){
   const s=getComputedStyle(n),r=n.getBoundingClientRect();
   chain.push({tag:n.tagName,cls:n.className,display:s.display,visibility:s.visibility,
    opacity:s.opacity,contentVisibility:s.contentVisibility,rect:[r.x,r.y,r.width,r.height]});
   n=n.parentElement;
  }
  return chain;
 });
 console.log("CAMPAIGN_RENDER",JSON.stringify(debugCampaign));
 assert.ok((await savedCampaign.textContent()).includes("7-day content sprint"),"Campaign saved in workspace");
 assert.equal(await savedCampaign.isVisible(),true,"New campaign row must be visible");
 assert.equal(await page.locator('.panel.support-banner').count(),0);
 assert.equal(await page.locator('.panel[aria-label="Litix customer support"]').count(),0);
 if(width<576){
  const ai=await page.locator(".lxai-launcher").boundingBox();
  const whats=await page.locator(".whatsapp-float").boundingBox();
  assert.ok(ai&&whats&&ai.x+ai.width+10<whats.x,
   "mobile AI and WhatsApp must stay separate");
  assert.equal(await page.locator(".lxai-launcher").getByText("Ask LITIX AI").isVisible(),true);
 }
 assert.deepEqual(errors,[]);
 await context.close();
 console.log("PASS LITIX HOMEPAGE UI",width);
};
try{for(const width of [375,1280])await test(width)}finally{await browser.close()}
