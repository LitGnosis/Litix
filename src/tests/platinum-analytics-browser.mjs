// Real browser QA for privacy-local Analytics Studio: no gateway, supplier or API requests.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
try{
 for(const width of [320,375,1280]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<576,hasTouch:width<576,acceptDownloads:true});
  const page=await context.newPage(),errors=[],forbidden=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("request",r=>{if(r.method()!=="GET"&&(r.url().includes("/api/")||r.url().includes("transactiongateway")||r.url().includes("boostero")))forbidden.push(r.url())});
  await page.goto("http://localhost:3100/analytics",{waitUntil:"domcontentloaded"});
  await page.getByRole("heading",{name:"Analytics Studio"}).waitFor();
  await page.getByRole("button",{name:"Create your first campaign"}).click();
  await page.getByLabel("Campaign name").fill("Creator launch 2030");
  await page.getByLabel("Platform").selectOption("Instagram");
  await page.getByLabel("Goal (optional)").fill("Track creator campaign reach and leads");
  await page.getByRole("button",{name:"Create campaign",exact:true}).click();
  await page.getByText("Campaign created. Metrics remain private in this browser.").waitFor();
  await page.getByRole("button",{name:"+ Add snapshot"}).click();
  await page.getByLabel("Snapshot date").fill("2030-01-15");
  for(const [name,value] of [["Followers","1000"],["Impressions","2000"],["Views","1500"],["Likes","200"],["Comments","20"],["Shares","10"],["Link clicks","100"],["Leads","5"],["Spend (USD cents)","1500"]])await page.getByLabel(name,{exact:true}).fill(value);
  await page.getByRole("button",{name:"Save private snapshot"}).click();
  await page.getByRole("button",{name:"+ Add snapshot"}).click();
  await page.getByLabel("Snapshot date").fill("2030-01-16");
  for(const [name,value] of [["Followers","1300"],["Impressions","5000"],["Views","3200"],["Likes","250"],["Comments","30"],["Shares","20"],["Link clicks","200"],["Leads","10"],["Spend (USD cents)","4000"]])await page.getByLabel(name,{exact:true}).fill(value);
  await page.getByRole("button",{name:"Save private snapshot"}).click();
  await page.getByRole("region",{name:"Latest recorded campaign metrics"}).getByText("6%").waitFor();
  await page.reload({waitUntil:"domcontentloaded"});
  await page.getByRole("heading",{name:"Analytics Studio"}).waitFor();
  await page.getByRole("heading",{name:"Creator launch 2030"}).waitFor();
  assert.equal(await page.locator(".la-table tbody tr").count(),2,"Snapshots persisted across reload");
  const downloadEvent=page.waitForEvent("download");
  await page.getByRole("button",{name:"Export CSV"}).click();
  const download=await downloadEvent;
  assert.equal(download.suggestedFilename(),"litix-platinum-analytics.csv");
  const csv=await readFile(await download.path(),"utf8");
  assert.match(csv,/Creator launch 2030/);assert.match(csv,/2030-01-16/);assert.match(csv,/"User entered","No"/);
  const overflow=await page.locator("body").evaluate(el=>el.scrollWidth);
  assert.ok(overflow<=width+1,"No horizontal body overflow at "+width+"px: "+overflow);
  assert.deepEqual(forbidden,[],"No charge/supplier API network requests");
  assert.deepEqual(errors,[],"No browser runtime exceptions");
  console.log("PLATINUM_ANALYTICS_BROWSER_PASS",width+"px","create,snapshots,metrics,reload,CSV,no-payments");
  await context.close();
 }
}finally{await browser.close()}
