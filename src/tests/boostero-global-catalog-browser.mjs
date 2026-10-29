import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
try{
 for(const width of [320,375,1280]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<576,hasTouch:width<576});
  const page=await context.newPage(),errors=[],unsafe=[],quotes=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("request",r=>{if(r.method()!=="GET"&&!r.url().includes("/api/catalog/global/quote"))unsafe.push(r.url())});
  const base=[
   {id:"service_opaque_one",platform:"Instagram",kind:"followers",name:"Instagram Premium Followers",category:"Instagram Followers",type:"Default",supplierMinimum:100,supplierMaximum:10000,minimum:100,maximum:10000,refill:false,dripfeed:false,purchasable:false},
   {id:"service_opaque_two",platform:"TikTok",kind:"auto_engagement",name:"TikTok New Post Auto Likes",category:"TikTok Subscriptions",type:"Subscriptions",supplierMinimum:100,supplierMaximum:1000,minimum:100,maximum:1000,refill:false,dripfeed:false,purchasable:false},
   {id:"service_opaque_three",platform:"YouTube",kind:"views",name:"YouTube Views",category:"YouTube Views",type:"Default",supplierMinimum:100,supplierMaximum:10000,minimum:100,maximum:10000,refill:false,dripfeed:false,purchasable:false}
  ];
  await page.route("**/api/catalog/global?**",async route=>{
   const p=new URL(route.request().url()).searchParams.get("platform")||"";
   const items=base.filter(x=>!p||x.platform===p);
   await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    supplierTotal:1817,validTotal:1814,approvedLiveCount:0,page:1,pageSize:24,filteredTotal:items.length,
    items,choices:items,categories:[...new Set(items.map(x=>x.category))],
    platforms:{Instagram:376,TikTok:166,YouTube:246},kinds:{followers:376,auto_engagement:166,views:246}
   })});
  });
  await page.route("**/api/catalog/global/quote",async route=>{
   const payload=route.request().postDataJSON();quotes.push(payload);
   const qty=Number(payload.input.quantity||0);
   const isSubscription=payload.id==="service_opaque_two";
   await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(
    isSubscription?{validInput:true,canPurchase:false,reason:"recurring_future_post_billing_not_verified",noPaymentAttempted:true}:
    {validInput:true,canPurchase:false,reason:"activation_pending_backend_approval",customerAmountCents:qty*1.6,retailPer1000Cents:1600,noPaymentAttempted:true}
   )});
  });
  await page.goto("http://localhost:3100/global-services",{waitUntil:"domcontentloaded"});
  await page.getByRole("heading",{name:/One global catalog/}).waitFor();
  await page.getByRole("heading",{name:"Choose category and service"}).waitFor();
  await page.getByRole("button",{name:"Select this service"}).first().click();
  await page.getByLabel("Public link / profile URL").fill("https://www.instagram.com/testprofile/");
  await page.getByLabel("Quantity").fill("1000");
  await page.getByText("$16.00").first().waitFor();
  assert.equal(await page.getByRole("button",{name:"Checkout unavailable for this service"}).count(),1);
  await page.getByRole("button",{name:/TikTok 166/}).click();
  await page.locator(".lgc-card").filter({hasText:"TikTok New Post Auto Likes"}).waitFor();
  await page.locator(".lgc-card").filter({hasText:"TikTok New Post Auto Likes"}).getByRole("button",{name:"Select this service"}).click();
  await page.getByLabel("Username").fill("testprofile");
  await page.getByText("recurring future post billing not verified").waitFor();
  assert.ok(quotes.some(q=>q.id==="service_opaque_one"&&Number(q.input.quantity)===1000));
  assert.ok(quotes.some(q=>q.id==="service_opaque_two"));
  const overflow=await page.locator("body").evaluate(el=>el.scrollWidth);
  assert.ok(overflow<=width+1, "horizontal overflow at "+width+"px: "+overflow);
  assert.deepEqual(unsafe,[],"No charges or supplier orders from browsing");
  assert.deepEqual(errors,[],"No JS errors");
  console.log("LITIX_ORDER_WIZARD_BROWSER_PASS",width+"px");
  await context.close();
 }
}finally{await browser.close()}
