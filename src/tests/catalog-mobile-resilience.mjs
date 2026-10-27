import {chromium} from "playwright";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
const data=[
 {id:"510",name:"TikTok Likes Demo",category:"TikTok Likes",type:"Default",min:100,supplierMin:100,max:50000,unitStep:1,startingAmountCents:500,per1000:5,refill:true,noDrop:false,purchasable:true},
 {id:"511",name:"TikTok Followers Demo",category:"TikTok Followers",type:"Default",min:100,supplierMin:100,max:50000,unitStep:1,startingAmountCents:500,per1000:6,refill:false,noDrop:false,purchasable:true},
 {id:"512",name:"Instagram Likes Demo",category:"Instagram Likes",type:"Default",min:100,supplierMin:100,max:50000,unitStep:1,startingAmountCents:500,per1000:7,refill:true,noDrop:false,purchasable:true},
 {id:"513",name:"Instagram Followers Demo",category:"Instagram Followers",type:"Default",min:100,supplierMin:100,max:50000,unitStep:1,startingAmountCents:500,per1000:8,refill:false,noDrop:false,purchasable:true},
];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 let state="live",calls=0;
 await page.route("**/api/config",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ready:false,publicKey:null})}));
 await page.route("**/api/catalog/v1?*",route=>{
  calls++;
  const u=new URL(route.request().url()),platform=u.searchParams.get("platform"),kind=u.searchParams.get("kind"),q=(u.searchParams.get("q")||"").toLowerCase(),category=u.searchParams.get("category");
  const items=data.filter(x=>(!platform||platform==="All platforms"||x.name.startsWith(platform))&&(!kind||x.name.toLowerCase().includes(kind))&&(!q||x.name.toLowerCase().includes(q))&&(!category||x.category===category));
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({items,total:items.length,allCount:314,categories:[...new Set(data.map(x=>x.category))],page:1,catalogStatus:state,lastSupplierSuccessAt:"2026-10-27T14:00:00.000Z",supplierRawCount:1000})});
 });
 await page.goto("http://localhost:3100/",{waitUntil:"networkidle"});
 await page.getByText("314 Litix services available",{exact:false}).waitFor();
 assert.equal(await page.locator(".service-option").count(),4);
 assert.equal(await page.getByText("Supplier catalog available · services ready").count(),1);
 await page.getByRole("button",{name:"TikTok services"}).click();
 await page.getByText("2 match current filters",{exact:false}).waitFor();
 assert.equal(await page.locator(".service-option").count(),2);
 await page.getByRole("button",{name:"TikTok Followers",exact:true}).click();
 await page.getByText("1 match current filters",{exact:false}).waitFor();
 assert.equal(await page.locator(".service-option").count(),1);
 assert.match(await page.locator(".service-option").innerText(),/TikTok Followers Demo/);
 assert.match(await page.locator(".service-option").innerText(),/USD\s*6\.00/);
 await page.locator(".service-option .item").click();
 assert.equal(await page.locator('#checkout input[readonly]').inputValue(),"TikTok Followers Demo");
 await page.getByRole("button",{name:"Instagram services"}).click();
 await page.getByText("2 match current filters",{exact:false}).waitFor();
 assert.equal(await page.locator(".service-option").count(),2);
 await page.getByRole("textbox",{name:"Service search"}).fill("nonsense");
 await page.locator(".catalog-status").getByText("no services match these filters").waitFor();
 assert.equal(await page.locator(".service-option").count(),0);
 assert.equal(await page.getByText("314 Litix services available",{exact:false}).count(),1);
 await page.getByRole("textbox",{name:"Service search"}).fill("");
 await page.getByText("2 match current filters",{exact:false}).waitFor();
 state="cached";
 await page.getByRole("button",{name:"Refresh catalog"}).click();
 await page.getByText("Showing recently verified catalog · reconnecting to supplier").waitFor();
 assert.ok(calls>=7);
 console.info("PASS SMMGLOB CATALOG MOBILE: TikTok/Instagram services, search, filters, $/1000, selection, zero matches and cached status; no charges");
 await context.close();
}finally{await browser.close()}
