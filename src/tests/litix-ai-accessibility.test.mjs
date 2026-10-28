// Read-only, mocked Playwright coverage. No payment, supplier, OpenAI or email calls.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({
  headless:true,
  executablePath:process.env.CHROME_PATH||undefined,
  args:["--no-sandbox"],
});

try {
  for(const [width,reduced] of [[320,true],[390,false],[1280,true]]) {
    const mobile=width<=575;
    const context=await browser.newContext({
      viewport:{width,height:844},isMobile:mobile,hasTouch:mobile,
      reducedMotion:reduced?"reduce":"no-preference",
    });
    const page=await context.newPage(),errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.__litixA11yScroll=[];
      const original=Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView=function(options){
        window.__litixA11yScroll.push(options);
        // The mocked scroll avoids altering unrelated checkout elements.
        if(this?.parentElement?.classList?.contains("lxai-messages"))return;
        if(typeof original==="function")return original.call(this,options);
      };
    });
    await page.route("**/api/litix-ai",route=>route.fulfill({
      status:200,contentType:"application/json",
      body:JSON.stringify(route.request().method()==="POST"?{reply:"Mock AI, no external requests"}:{available:true,verified:false}),
    }));
    await page.route("**/api/config",route=>route.fulfill({
      status:200,contentType:"application/json",body:'{"ready":false,"publicKey":null}',
    }));
    await page.route("**/api/catalog/v1?*",route=>route.fulfill({
      status:200,contentType:"application/json",
      body:'{"items":[],"categories":[],"catalogStatus":"live","allCount":0,"total":0}',
    }));
    await page.goto("http://localhost:3100/",{waitUntil:"domcontentloaded"});
    const launcher=page.locator(".lxai-launcher"),panel=page.locator("#lxai-dialog"),close=page.locator(".lxai-close");
    await launcher.waitFor();
    assert.equal(await launcher.getAttribute("aria-haspopup"),"dialog");
    assert.equal(await launcher.getAttribute("aria-controls"),"lxai-dialog");
    assert.equal(await launcher.getAttribute("aria-expanded"),"false");
    await launcher.click();
    await panel.waitFor();
    assert.equal(await panel.getAttribute("role"),"dialog");
    assert.equal(await launcher.getAttribute("aria-expanded"),"true");
    assert.equal(await close.evaluate(el=>document.activeElement===el),true,"Close gets keyboard focus on open");
    const motions=await page.evaluate(()=>window.__litixA11yScroll.filter(x=>x&&typeof x==="object").map(x=>x.behavior));
    assert.ok(motions.includes(reduced?"auto":"smooth"),"Scroll respects reduced-motion preference");
    await page.keyboard.press("Escape");
    await panel.waitFor({state:"detached"});
    assert.equal(await launcher.evaluate(el=>document.activeElement===el),true,"Escape returns focus to launcher");
    assert.equal(await launcher.getAttribute("aria-expanded"),"false");
    await launcher.press("Enter");
    await panel.waitFor();
    assert.equal(await close.evaluate(el=>document.activeElement===el),true,"Keyboard open focuses close");
    await close.click();
    await panel.waitFor({state:"detached"});
    assert.equal(await launcher.evaluate(el=>document.activeElement===el),true,"Close button returns focus to launcher");
    assert.deepEqual(errors,[],"No browser errors");
    console.log("LITIX_AI_ACCESSIBILITY_PASS",width+"px",reduced?"reduced-motion":"normal-motion");
    await context.close();
  }
} finally {
  await browser.close();
}
