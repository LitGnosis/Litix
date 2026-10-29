import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
try{
 for(const width of [320,375,1280]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<576,hasTouch:width<576});
  const page=await context.newPage(),jsErrors=[],unsafeCalls=[];
  page.on("pageerror",e=>jsErrors.push(e.message));
  page.on("request",r=>{if(r.method()!=="GET"&&/\/api\/(checkout|internal\/boostero)|transactiongateway|api\/v2/.test(r.url()))unsafeCalls.push(r.url())});
  await page.route("**/api/catalog/global?**",async route=>{
   const u=new URL(route.request().url),p=u.searchParams.get("platform")||"";
   const items=[
    {id:"service_opaque_one",platform:"Instagram",kind:"followers",name:"Instagram Premium Followers",category:"Instagram Followers",type:"Default",supplierMinimum:100,supplierMaximum:10000,refill:false,dripfeed:false,purchasable:false,pricePer1000:null},
    {id:"service_opaque_two",platform:"TikTok",kind:"auto_engagement",name:"TikTok New Post Auto Likes",category:"TikTok Subscriptions",type:"Subscriptions",supplierMinimum:100,supplierMaximum:10000,refill:false,dripfeed:false,purchasable:false,pricePer1000:null},
    {id:"service_opaque_three",platform:"YouTube",kind:"views",name:"YouTube Views",category:"YouTube Views",type:"Default",supplierMinimum:100,supplierMaximum:10000,refill:false,dripfeed:false,purchasable:false,pricePer1000:null}
   ].filter(x=>!p||x.platform===p);
   await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    supplier:"boostero",supplierExclusive:true,supplierTotal:1817,validTotal:1814,invalidTotal:3,approvedLiveCount:0,
    page:1,pageSize:24,filteredTotal:items.length,items,
    platforms:{Instagram:376,TikTok:166,YouTube:246},
    kinds:{followers:376,views:246,auto_engagement:166},
    categories:p==="Instagram"?["Instagram Followers"]:p==="TikTok"?["TikTok Subscriptions"]:["Instagram Followers","TikTok Subscriptions","YouTube Views"]
   })});
  });
  await page.goto("http://localhost:3100/global-services",{waitUntil:"domcontentloaded"});
  await page.getByRole("heading",{name:/One global catalog/}).waitFor();
  await page.getByRole("heading",{name:"Instagram Premium Followers"}).waitFor();
  assert.equal(await page.getByText("Not purchasable yet. No payment attempted.").count(),3);
  await page.getByRole("button",{name:"Preview required inputs"}).first().click();
  await page.getByRole("dialog",{name:"Supplier service requirements"}).waitFor();
  await page.getByRole("button",{name:"Validate draft — no purchase"}).click();
  await page.getByText("Draft recorded only in this browser",{exact:false}).waitFor();
  await page.getByRole("button",{name:"Close service requirements"}).click();
  await page.getByRole("button",{name:/TikTok 166/}).click();
  await page.getByRole("heading",{name:"TikTok New Post Auto Likes"}).waitFor();
  await page.getByRole("button",{name:"Preview required inputs"}).click();
  await page.getByText("Boostero bills subscriptions as future posts are processed.",{exact:false}).waitFor();
  await page.getByRole("button",{name:"Close service requirements"}).click();
  const overflow=await page.locator("body").evaluate(el=>el.scrollWidth);
  assert.ok(overflow<=width+1,"No horizontal overflow at "+width+"px: "+overflow);
  assert.deepEqual(unsafeCalls,[],"No supplier submits, payment captures, or checkout calls");
  assert.deepEqual(jsErrors,[],"No script errors");
  console.log("BOOSTERO_GLOBAL_CATALOG_BROWSER_PASS",width+"px","platform,category,subscription,zero-checkout");
  await context.close();
 }
}finally{await browser.close()}
