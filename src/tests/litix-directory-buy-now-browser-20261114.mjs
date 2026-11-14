import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({
 headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]
});
const item=(id,rate)=>({
 id,name:"Instagram Followers",category:"Instagram - USA Services",
 platform:"Instagram",kind:"followers",min:90,max:5000,
 per1000:rate,unitStep:1,purchasable:true,type:"Standard"
});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({
   viewport:{width,height:900},isMobile:width<600,hasTouch:width<600
  });
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",err=>errors.push(err.message));
  await page.route("**/api/catalog/global?*",route=>route.fulfill({
   status:200,contentType:"application/json",
   body:JSON.stringify({
    items:[item("litix_2132",11.02),item("litix_3474",14.37),
     item("litix_5093",19.32),item("litix_4751",9.99)],
    platforms:[{name:"Instagram",count:1196}],
    categories:[{name:"Instagram - USA Services",count:1196}],
    total:1196,allCount:1196,verifiedPurchasableCount:1196,page:1,pageSize:24
   })
  }));
  await page.route("**/api/checkout/v1",()=>{throw Error("UI test must never charge a card");});
  await page.goto("http://localhost:3100/services",{waitUntil:"domcontentloaded"});
  const cards=page.locator(".litix-directory-service");
  await page.waitForFunction(()=>document.querySelectorAll(".litix-directory-service").length===4);
  assert.match(await page.locator(".litix-directory-result-header").innerText(),/1,196 matching Litix services/);
  for(const [i,tier,rate] of [
   [0,"High quality · Up to 4,000/day","$11.02"],
   [1,"Premium quality · Up to 5,000/day","$14.37"],
   [2,"Real-Look Profiles · Up to 5,000/day","$19.32"]
  ]){
   const card=cards.nth(i);
   assert.equal(await card.locator(".litix-directory-service-tier").innerText(),tier);
   assert.ok((await card.locator(".litix-directory-service-category").innerText()).includes("Instagram"));
   assert.ok((await card.locator(".litix-directory-service-price").innerText()).includes(rate));
   const cta=card.locator(".litix-directory-buy");
   assert.equal(await cta.innerText(),"BUY NOW");
   assert.equal(await cta.getAttribute("href"),"/?service="+["litix_2132","litix_3474","litix_5093"][i]+"#checkout");
   assert.match(await cta.evaluate(node=>getComputedStyle(node).backgroundImage),/linear-gradient/);
  }
  assert.equal(await cards.nth(3).locator(".litix-directory-buy").innerText(),"Choose Your Posts");
  assert.equal(await cards.nth(3).locator(".litix-directory-buy").getAttribute("href"),
   "/?service=litix_4751&mode=multi#checkout");
  const button=cards.first().locator(".litix-directory-buy");
  await button.click();
  await page.waitForURL(/\/\?service=litix_2132#checkout$/);
  assert.equal(new URL(page.url()).searchParams.get("service"),"litix_2132");
  assert.deepEqual(errors,[]);
  console.log("PASS Litix directory buy now, verified tiers, PayKings navigation",width);
  await context.close();
 }
}finally{await browser.close();}
