// Local-only Playwright checks. The tested content calendar never charges cards, sends
// content to platform APIs, submits supplier orders or touches production data.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
try{
  for(const width of [375,1280]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width<576,hasTouch:width<576,acceptDownloads:true});
    const page=await context.newPage(),issues=[];
    page.on("pageerror",e=>issues.push(e.message));
    await page.route("**/api/litix-ai",route=>route.fulfill({status:200,contentType:"application/json",body:'{"available":false,"verified":false}'}));
    await page.goto("http://localhost:3100/growth",{waitUntil:"domcontentloaded"});
    await page.getByRole("heading",{name:"Content Calendar"}).waitFor();
    assert.ok((await page.locator("body").evaluate(el=>el.scrollWidth))<=width+1,"No horizontal overflow at "+width);
    await page.getByLabel("Content title").fill("Organic creator launch");
    await page.getByLabel("Publish date").fill("2030-01-15");
    await page.getByLabel("Social platform").selectOption("TikTok");
    await page.getByLabel("Caption or creative notes").fill("Original hook: here is our new product.");
    await page.getByRole("button",{name:"Save to calendar"}).click();
    await page.getByText("Calendar item added in this browser.").waitFor();
    const upcoming=page.locator(".lgrowth-upcoming-item");
    assert.equal(await upcoming.count(),1);
    await page.reload({waitUntil:"domcontentloaded"});
    await upcoming.waitFor();
    assert.equal(await upcoming.count(),1,"Saved post survives a browser reload");
    await upcoming.getByRole("button",{name:"Edit"}).click();
    await page.getByLabel("Content title").fill("Organic creator launch (updated)");
    await page.getByRole("button",{name:"Save changes"}).click();
    assert.match(await upcoming.innerText(),/updated/);
    const promise=page.waitForEvent("download");
    await page.getByRole("button",{name:/Export CSV/}).click();
    const download=await promise;
    assert.equal(download.suggestedFilename(),"litix-growth-calendar.csv");
    const csv=await readFile(await download.path(),"utf8");
    assert.match(csv,/Organic creator launch \(updated\)/);
    assert.match(csv,/2030-01-15/);
    page.once("dialog",dialog=>dialog.accept());
    await upcoming.getByRole("button",{name:/Delete/}).click();
    assert.equal(await upcoming.count(),0);
    assert.ok((await page.locator("body").evaluate(el=>el.scrollWidth))<=width+1,"Calendar stays responsive at "+width);
    assert.deepEqual(issues,[],"No browser script errors");
    console.log("GROWTH_CALENDAR_E2E_PASS",width+"px", "create,reload,edit,export,delete");
    await context.close();
  }
}finally{await browser.close()}
