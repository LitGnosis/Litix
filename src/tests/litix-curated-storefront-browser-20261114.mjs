import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,
 executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
const format=(quantity,rate)=>Math.round(quantity*rate/1000*100);
function item(platform,kind,tier,per1000){
 const name=platform+" "+kind[0].toUpperCase()+kind.slice(1);
 return {id:"curated_"+platform.toLowerCase()+"_"+kind+"_"+tier,
  sku:platform.toLowerCase()+"_"+kind,platform,kind,tier,name,
  label:platform==="TikTok"?"High Quality · Up to 10,000/day":"High Quality",
  min:100,max:5000,unitStep:1,per1000,pricingRule:"nearest",
  purchasable:true,startingAmountCents:100,
  quantityCards:[100,250,500,1000,2500,5000].map(quantity=>({
   quantity,totalCents:format(quantity,per1000),available:true
  }))
 };
}
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({
   viewport:{width,height:850},isMobile:width<600,hasTouch:width<600
  });
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/api/config",route=>route.fulfill({status:200,contentType:"application/json",
   body:'{"ready":false,"publicKey":null}'}));
  await page.route("**/api/catalog/curated",route=>route.fulfill({status:200,contentType:"application/json",
   body:JSON.stringify({products:[
    item("Instagram","followers","standard",11.02),
    item("Instagram","followers","vip",19.32),
    item("Instagram","likes","standard",6.00),
    item("TikTok","followers","standard",9.00),
    item("TikTok","likes","standard",6.00),
    item("TikTok","views","standard",3.00),
    item("TikTok","comments","standard",7.00),
    item("TikTok","shares","standard",3.00)
   ],extras:{autoLikesEnabled:false,autoViewsEnabled:false}})}));
  await page.route("**/api/catalog/v1?*",route=>route.fulfill({status:200,contentType:"application/json",
   body:JSON.stringify({items:[],total:0,allCount:0,checkoutEnabled:false})}));
  await page.route("**/api/checkout/readiness?*",route=>route.fulfill({status:503,contentType:"application/json",
   body:'{"ready":false,"chargeAttempted":false}'}));
  await page.route("**/api/checkout/v1",()=>{throw Error("No live PayKings sale permitted in browser tests")});
  await page.goto("http://localhost:3100/",{waitUntil:"domcontentloaded"});
  const root=page.locator(".litix-curated");
  await root.waitFor({timeout:10000});
  await page.waitForFunction(()=>document.querySelectorAll(".litix-curated-package-grid button").length===6);
  assert.equal(await page.locator("#litix-platform").count(),0);
  assert.equal(await page.locator("#litix-service-choice").count(),0);
  const platforms=root.getByRole("group",{name:"Choose social platform"});
  assert.equal(await platforms.getByRole("button").count(),2);
  const types=root.getByRole("group",{name:"Choose service type"});
  assert.equal(await types.getByRole("button").count(),4);
  let cards=root.getByRole("group",{name:"Quantity package cards"}).getByRole("button");
  assert.equal(await cards.count(),6);
  assert.match(await cards.nth(3).innerText(),/1,000.*Followers.*\$11\.02/s);
  await cards.nth(1).click();
  assert.match(await page.locator(".totalbox .total").innerText(),/2\.76/);
  await platforms.getByRole("button",{name:"TikTok"}).click();
  await types.getByRole("button",{name:"Views"}).click();
  assert.match(await page.locator(".totalbox .total").innerText(),/3\.00/);
  assert.equal(await root.getByRole("button",{name:/Real \/ Active/}).count(),0,
   "Do not invent a VIP tier when no live distinct VIP offer exists");
  assert.equal(await root.getByRole("button",{name:"Auto Likes"}).count(),0);
  assert.equal(await root.getByRole("button",{name:/Custom Comments/}).count(),0);
  assert.equal(await root.getByRole("link",{name:"TikTok Shares"}).getAttribute("href"),
   "/services?platform=TikTok&kind=shares");
  assert.equal(await root.getByRole("link",{name:"TikTok Saves"}).getAttribute("href"),
   "/services?platform=TikTok&kind=saves");
  assert.equal(await page.getByRole("link",{name:/Browse full catalog/}).getAttribute("href"),"/services");
  const pay=page.locator("#checkout button.premium-pay-button");
  assert.equal(await pay.count(),1);
  assert.equal(await pay.isDisabled(),true);
  assert.deepEqual(errors,[]);
  console.log("PASS curated storefront no-charge",width);
  await context.close();
 }
}finally{await browser.close();}
