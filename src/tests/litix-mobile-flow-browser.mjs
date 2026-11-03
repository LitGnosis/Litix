// Production-like mobile browser acceptance: no real payment, supplier request or DB writes.
// Run against local Next.js with all /api routes mocked.
import {chromium} from "playwright";
import assert from "node:assert/strict";

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
let checks=0;
try{
 for(const width of [320,390,1280]){
  const mobile=width<650;
  const context=await browser.newContext({viewport:{width,height:850},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();
  const errors=[];
  let checkoutRequests=0;
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/api/**",route=>{
   const p=new URL(route.request().url()).pathname;
   // Read-only GET /api/catalog/checkout-choices is not a payment.
   if(route.request().method()!=="GET"&&/(checkout|boostero|payment)/i.test(p))checkoutRequests++;
   const obj=p==="/api/bundles"?{bluevineEnabled:true,checkoutEnabled:true,autoFulfillmentEnabled:false,packages:[]}:
    p==="/api/config"?{ready:false,publicKey:null}:
    p==="/api/litix-ai"?{available:false,verified:false}:
    p.startsWith("/api/catalog/")?{items:[],platforms:[],kinds:[],categories:[],total:0,allCount:0}: {};
   return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(obj)});
  });
  await page.goto("http://localhost:3100/custom-likes",{waitUntil:"domcontentloaded"});
  const hub=page.locator(".litix-custom-hub");
  await hub.getByRole("heading",{name:"Custom Likes & Followers"}).waitFor();
  await hub.getByRole("button",{name:"TikTok"}).click();
  await hub.getByRole("button",{name:"Followers",exact:true}).click();
  await hub.getByRole("heading",{name:"TikTok Custom Followers"}).waitFor();
  assert.match(await hub.locator(".litix-metal-cta").getAttribute("href"),/service=litix_5101#checkout/);
  await hub.getByRole("button",{name:"Likes",exact:true}).click();
  await hub.getByRole("heading",{name:"TikTok Custom Likes"}).waitFor();
  assert.match(await hub.locator(".litix-metal-cta").getAttribute("href"),/service=litix_5251&mode=multi#checkout/);
  if(mobile){
   const layout=await page.evaluate(()=>{
    const nav=document.querySelector(".nav").getBoundingClientRect();
    const heading=document.querySelector(".litix-custom-intro h1").getBoundingClientRect();
    return {navBottom:nav.bottom,headingTop:heading.top,position:getComputedStyle(document.querySelector(".nav")).position,
     scrollWidth:document.documentElement.scrollWidth,width:innerWidth};
   });
   assert.equal(layout.position,"relative","header must not stick over content");
   assert.ok(layout.headingTop>=layout.navBottom-2,JSON.stringify(layout));
   assert.ok(layout.scrollWidth<=layout.width+2,"no mobile overflow "+JSON.stringify(layout));
  }
  checks+=3;
  await page.goto("http://localhost:3100/bundles",{waitUntil:"domcontentloaded"});
  await page.locator("#litix-bundle-select").selectOption("Apex");
  await page.getByRole("heading",{name:"Instagram Apex Growth Bundle"}).waitFor();
  assert.equal(await page.locator(".lg-bundles-selected").count(),1);
  assert.match(await page.locator(".lg-bundles-selected").innerText(),/\$359\.82/);
  await page.locator(".lg-bundles-tabs").getByRole("button",{name:"TikTok"}).click();
  await page.getByRole("heading",{name:"TikTok Apex Growth Bundle"}).waitFor();
  assert.match(await page.getByRole("link",{name:"Pay with Bluevine"}).getAttribute("href"),/package=tt_apex&method=bluevine/);
  assert.match(await page.getByRole("link",{name:"Pay with PayKings"}).getAttribute("href"),/package=tt_apex&method=paykings/);
  checks+=4;
  await page.goto("http://localhost:3100/",{waitUntil:"domcontentloaded"});
  await page.locator(".litix-platform-tabs").getByRole("button",{name:"TikTok"}).click();
  const options=await page.locator(".litix-platform-choices a").allTextContents();
  assert.equal(options.length,3);
  assert.ok(options.some(z=>z.includes("Followers"))&&options.some(z=>z.includes("Likes")));
  assert.equal(checkoutRequests,0,"no purchase, supplier or charge made in UI test");
  assert.deepEqual(errors,[],"no browser JavaScript runtime errors");
  checks+=3;
  console.log("LITIX_MOBILE_FLOW_PASS",width+"px");
  await context.close();
 }
}finally{await browser.close()}
console.log("LITIX_MOBILE_FLOW_CHECKS",checks);
