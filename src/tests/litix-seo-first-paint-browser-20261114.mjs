import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,
 executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});

const offers=[
 ["Instagram","followers","curated_instagram_followers_standard",11.02],
 ["Instagram","likes","curated_instagram_likes_standard",6],
 ["TikTok","followers","curated_tiktok_followers_standard",33.43],
 ["TikTok","likes","curated_tiktok_likes_standard",11.02]
];
const makeOffer=(platform,kind,id,price)=>({
 id,sku:platform.toLowerCase()+"_"+kind,platform,kind,tier:"standard",
 name:platform+" "+kind,label:"High Quality",
 purchasable:true,preview:false,min:90,max:5000,unitStep:1,
 per1000:price,pricingRule:"ceil",startingAmountCents:100,
 quantityCards:[100,250,500,1000,2500,5000].map(quantity=>({
  quantity,totalCents:Math.ceil(price*quantity/10),available:true
 }))
});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({
   viewport:{width,height:900},hasTouch:width<600,isMobile:width<600
  });
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/api/config",route=>route.fulfill({
   status:200,contentType:"application/json",
   body:'{"ready":false,"publicKey":null}'
  }));
  await page.route("**/api/catalog/v1?*",route=>route.fulfill({
   status:200,contentType:"application/json",
   body:'{"items":[],"allCount":0,"total":0,"checkoutEnabled":false}'
  }));
  await page.route("**/api/catalog/curated",async route=>{
   await new Promise(resolve=>setTimeout(resolve,1750));
   await route.fulfill({
    status:200,contentType:"application/json",
    body:JSON.stringify({products:offers.map(x=>makeOffer(...x)),extras:{}})
   });
  });
  await page.route("**/api/public-activity",route=>route.fulfill({
   status:200,contentType:"application/json",body:'{"available":false}'
  }));
  await page.route("**/api/checkout/v1",()=>{throw Error("Card charge prohibited in no-charge SEO tests")});
  await page.goto("http://localhost:3100/",{waitUntil:"domcontentloaded"});
  assert.equal(await page.getByText("Preparing the focused checkout…").count(),0);
  assert.equal(await page.locator(".litix-curated-platforms button").count(),2);
  assert.equal(await page.locator(".litix-curated-kinds button").count(),4);
  assert.equal(await page.locator(".litix-curated-package-grid button").count(),6);
  const picked=page.locator(".litix-curated-package-grid button[aria-pressed='true']");
  assert.equal(await picked.count(),1);
  assert.match(await picked.innerText(),/1,000/);
  assert.match(await page.locator(".totalbox .total").innerText(),/\$11\.02/);
  const range=await page.locator(".litix-curated-range").innerText();
  assert.equal(range,"90–5,000 units");
  assert.equal(await page.getByText("Choose a package to continue").count(),0);
  assert.equal(await page.getByText("Choose a package in Step 03.").count(),0);
  assert.equal(await page.locator(".premium-pay-button").isDisabled(),true);
  assert.equal(await page.locator(".litix-curated-featured").filter({hasText:/Save \d+%/}).count(),0);
  for(const slug of ["buy-instagram-followers","buy-instagram-likes","buy-tiktok-followers","buy-tiktok-likes"]){
   await page.goto("http://localhost:3100/"+slug,{waitUntil:"domcontentloaded"});
   assert.equal(await page.locator("h1").count(),1,slug+" H1");
   assert.equal(await page.locator(".litix-seo-faq details").count(),5,slug+" FAQs");
   assert.equal(await page.locator(".litix-seo-comparison tbody tr").count(),4,slug+" comparison");
   assert.equal(await page.locator("link[rel=canonical]").getAttribute("href"),
    "https://www.litix.net/"+slug);
   const data=await page.locator('script[type="application/ld+json"]').evaluateAll(
    nodes=>nodes.map(n=>{try{return JSON.parse(n.textContent)}catch{return null}})
   );
   assert.ok(data.some(value=>Array.isArray(value)&&value.some(x=>x["@type"]==="FAQPage")),
    slug+" FAQPage JSON-LD");
   const kind=slug.includes("-likes")?"Likes":"Followers";
   const platform=slug.includes("tiktok")?"TikTok":"Instagram";
   assert.equal(await page.locator('.litix-curated-platforms button[aria-pressed="true"]').innerText(),platform);
   assert.equal(await page.locator('.litix-curated-kinds button[aria-pressed="true"]').innerText(),kind);
   assert.equal(await page.locator(".litix-curated-package-grid button[aria-pressed='true']").count(),1);
  }
  assert.deepEqual(errors,[],"No browser JavaScript exceptions");
  console.log("PASS initial order total + four static SEO routes + no charge at",width);
  await context.close();
 }
}finally{await browser.close();}
