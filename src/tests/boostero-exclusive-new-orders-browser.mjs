import assert from "node:assert/strict";
import {chromium} from "playwright";

const services=[
  {id:"boostero_5461",name:"Instagram Followers",category:"Instagram Followers",platform:"Instagram",kind:"followers",per1000:15,min:334,max:50000,startingAmountCents:501,purchasable:true,refill:false,noDrop:false},
  {id:"33442",name:"TikTok Saves",category:"TikTok Saves",platform:"TikTok",per1000:5,min:1000,max:50000,startingAmountCents:500,purchasable:false,refill:false,noDrop:false},
  {id:"33679",name:"YouTube Views",category:"YouTube Views",platform:"YouTube",per1000:5,min:1000,max:50000,startingAmountCents:500,purchasable:false,refill:false,noDrop:false}
];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
try {
 for(const width of [320,375,1280]){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width<576,hasTouch:width<576});
  const page=await context.newPage();const errors=[];let paymentCalls=0;
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/api/**",route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.includes("checkout")||path.includes("internal/boostero"))paymentCalls++;
    const payload=path==="/api/catalog/v1"?{items:services,total:3,allCount:3,page:1,categories:["Instagram Followers","TikTok Saves","YouTube Views"],catalogStatus:"live"}:
      path==="/api/config"?{ready:false,publicKey:null}:path==="/api/litix-ai"?{available:false,verified:false}:{};
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(payload)});
  });
  await page.goto("http://localhost:3100/",{waitUntil:"domcontentloaded"});
  const cards=page.locator("#services .service-option");
  await page.waitForFunction(()=>document.querySelectorAll("#services .service-option").length===3);
  assert.equal(await cards.count(),services.length,"No catalog listing was removed");
  assert.equal(await cards.locator(".item:disabled").count(),2,"All unavailable legacy cards disabled");
  for(const id of ["33442","33679"]){
    const card=cards.filter({hasText:id==="33442"?"TikTok Saves":"YouTube Views"});
    assert.equal(await card.locator(".item").isDisabled(),true,id);
    assert.match(await card.innerText(),/Unavailable for new orders/);
    assert.match(await card.innerText(),/\$5\.00/);
  }
  const approved=cards.filter({hasText:"Instagram Followers"});
  assert.equal(await approved.locator(".item").isEnabled(),true);
  await approved.locator(".item").click();
  assert.equal(await page.locator("#checkout input[readonly]").first().inputValue(),"Instagram Followers");
  assert.equal(paymentCalls,0,"No checkout, supplier, or card API calls");
  const grid=await page.locator("#services .cards").evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
  assert.ok(grid.scroll<=grid.client+2,"Service cards fit viewport at "+width+": "+JSON.stringify(grid));
  assert.deepEqual(errors,[],"No JavaScript errors");
  console.log("BOOSTERO_NEW_ORDER_ONLY_BROWSER_PASS",width+"px");
  await context.close();
 }
}finally{await browser.close()}
