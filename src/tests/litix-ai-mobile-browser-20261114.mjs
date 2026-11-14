// No customer data, supplier transactions, PayKings calls or external AI calls.
// Browser emulation checks layout at common iPhone widths and desktop.
import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
try{
 for(const width of [320,375,390,430,1280]){
  const mobile=width<576;
  const context=await browser.newContext({
   viewport:{width,height:844},isMobile:mobile,hasTouch:mobile,
   reducedMotion:"reduce",
  });
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/api/litix-ai",route=>route.fulfill({status:200,contentType:"application/json",
   body:JSON.stringify(route.request().method()==="POST"
    ?{reply:"Orders start after payment and eligibility checks.",mode:"guided"}
    :{available:true,mode:"guided",verified:false})}));
  await page.route("**/api/config",route=>route.fulfill({status:200,contentType:"application/json",
   body:JSON.stringify({ready:false,publicKey:null})}));
  await page.route("**/api/catalog/v1?*",route=>route.fulfill({status:200,contentType:"application/json",
   body:JSON.stringify({items:[],total:0,allCount:0,categories:[],catalogStatus:"cached"})}));
  await page.route("**/api/order-lookup",route=>{
   throw Error("No-charge privacy test must not query a real order");
  });
  await page.goto("http://localhost:3100/",{waitUntil:"domcontentloaded"});
  await page.locator(".lxai-launcher").click();
  const panel=page.locator("#lxai-dialog");
  await panel.waitFor();
  assert.equal(await panel.getAttribute("aria-modal"),"true");
  const modal=await panel.boundingBox();
  assert.ok(modal.x>=-1&&modal.x+modal.width<=width+1,
   `modal horizontal bounds at ${width}px: ${JSON.stringify(modal)}`);
  assert.ok(modal.y>=-1&&modal.y+modal.height<=845,"modal fits vertical viewport");
  assert.equal(await page.locator(".lxai-backdrop").count(),1);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),"hidden");
  const header=page.locator(".lxai-head");
  assert.equal(await header.evaluate(el=>getComputedStyle(el).position),"sticky");
  assert.equal(await header.locator("small").innerText(),"Instant Order & Catalog Concierge");
  assert.equal(await page.locator(".lxai-suggestions button").count(),3);
  assert.equal(await page.getByRole("button",{name:"Show growth bundles"}).count(),0);
  const suggestions=page.locator(".lxai-suggestions");
  const scroller=await suggestions.evaluate(el=>({
   overflow:getComputedStyle(el).overflowX,
   scrollWidth:el.scrollWidth,
   clientWidth:el.clientWidth,
  }));
  assert.equal(scroller.overflow,"auto");
  const last=page.getByRole("button",{name:"How do I track my order?"});
  await last.scrollIntoViewIfNeeded();
  const lastBox=await last.boundingBox();
  assert.ok(lastBox.x>=-1&&lastBox.x+lastBox.width<=width+1,"last chip fully visible after scrolling");
  await page.getByRole("button",{name:"Track order"}).click();
  const id=page.locator(".lxai-track input").nth(0),email=page.locator(".lxai-track input").nth(1);
  assert.equal(await id.inputValue(),"");
  assert.equal(await email.inputValue(),"");
  assert.equal(await id.getAttribute("placeholder"),"e.g. ltx2_xxxxxxxx-xxxx-xxxx-xxxx");
  assert.equal(await email.getAttribute("placeholder"),"e.g. you@example.com");
  assert.equal(await id.getAttribute("autocomplete"),"off");
  assert.equal(await email.getAttribute("autocomplete"),"off");
  assert.equal(await page.locator(".lxai-track>p").first().innerText(),
   "Enter your Litix order number and checkout email to view real-time payment and delivery updates.");
  assert.equal(await page.locator(".lxai-footer small").innerText(),
   "Litix never asks for social passwords or card numbers in support chat.");
  const track=page.locator(".lxai-track");
  const headerBefore=await header.boundingBox();
  await track.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  const headerAfter=await header.boundingBox();
  assert.ok(Math.abs(headerBefore.y-headerAfter.y)<1,"header stays in place during tracking scroll");
  for(const s of [".lxai-track",".lxai-track p",".lxai-track label",".lxai-track input"]){
   for(const bounds of await page.locator(s).evaluateAll(els=>els.map(el=>{
    const r=el.getBoundingClientRect();return {left:r.left,right:r.right};
   }))){
    assert.ok(bounds.left>=-1&&bounds.right<=width+1,`${s} overflow at ${width}px: ${JSON.stringify(bounds)}`);
   }
  }
  await id.fill("ltx2_12345678-aaaa-bbbb-cccc-dddddddddddd");
  await email.fill("test@example.com");
  await page.getByRole("button",{name:"Close assistant"}).click();
  await panel.waitFor({state:"detached"});
  assert.equal(await page.evaluate(()=>document.body.style.overflow),"");
  await page.getByRole("button",{name:"Open LITIX AI"}).click();
  await page.getByRole("button",{name:"Track order"}).click();
  assert.equal(await page.locator(".lxai-track input").nth(0).inputValue(),"","order ID cleared on reopening");
  assert.equal(await page.locator(".lxai-track input").nth(1).inputValue(),"","checkout email cleared on reopening");
  assert.deepEqual(errors,[],"no runtime exceptions");
  console.log("PASS AI MOBILE SAFE AREA",width);
  await context.close();
 }
}finally{await browser.close();}
