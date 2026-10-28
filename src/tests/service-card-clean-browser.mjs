import assert from "node:assert/strict";
import {chromium} from "playwright";

const products=[
  {id:"boostero_5461",name:"📸 Instagram Followers ➡️ [ Premium Quality | 5K/Day | Non-Drop 🛡️ ]",category:"Instagram Followers",platform:"Instagram",kind:"followers",per1000:15,min:334,max:10000,startingAmountCents:501,refill:false,noDrop:false,purchasable:true},
  {id:"boostero_4751",name:"👍 Instagram Likes [ High Quality | 10K/Day | No Refill ]",category:"Instagram Likes",platform:"Instagram",kind:"likes",per1000:6.99,min:717,max:10000,startingAmountCents:501,refill:false,noDrop:false,purchasable:true},
  {id:"boostero_5101",name:"TikTok Followers [ Medium Quality | 100K/Day | Non-Drop ]",category:"TikTok Followers",platform:"TikTok",kind:"followers",per1000:14.99,min:478,max:10000,startingAmountCents:717,refill:false,noDrop:false,purchasable:true},
  {id:"boostero_5251",name:"TikTok Likes [ High Quality | 500/Day | No Refill ]",category:"TikTok Likes",platform:"TikTok",kind:"likes",per1000:6.99,min:717,max:10000,startingAmountCents:501,refill:false,noDrop:false,purchasable:true},
];
const expected=[["Instagram Followers","$15.00","Starting at $5.01"],["Instagram Likes","$6.99","Starting at $5.01"],["TikTok Followers","$14.99","Starting at $7.17"],["TikTok Likes","$6.99","Starting at $5.01"]];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
try {
  for(const width of [320,375,1280]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width<576,hasTouch:width<576});
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",err=>errors.push(err.message));
    await page.route("**/api/**",route=>{
      const pathname=new URL(route.request().url()).pathname;
      let body={};
      if(pathname==="/api/catalog/v1")body={items:products,total:products.length,allCount:products.length,categories:products.map(x=>x.category),catalogStatus:"live"};
      else if(pathname==="/api/config")body={ready:false,publicKey:null};
      else if(pathname==="/api/litix-ai")body={available:false,verified:false};
      else if(pathname==="/api/bundles")body={checkoutEnabled:false,bluevineEnabled:false,packages:[]};
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
    });
    await page.goto("http://localhost:3100/",{waitUntil:"domcontentloaded"});
    const cards=page.locator(".service-option");
    await cards.first().waitFor();
    assert.equal(await cards.count(),products.length,"Cards and supplier-backed products must remain 1-to-1.");
    for(let i=0;i<4;i++){
      const item=cards.nth(i),card=item.locator(".item");
      const [title,price,starting]=expected[i];
      assert.equal((await card.locator(".service-card-name").innerText()).trim(),title);
      assert.ok((await card.locator(".service-card-price").innerText()).includes(price),i+" rate");
      assert.ok((await card.locator(".service-card-price").innerText()).includes("per 1,000"),i+" rate unit");
      assert.equal((await card.locator(".service-card-start").innerText()).trim(),starting);
      const visible=await card.innerText();
      assert.doesNotMatch(visible,/quality|(?:no.)?refill|non.drop|boostero|smmglob|(?:\d+K?\/day)|#\d+/i);
      assert.doesNotMatch(await card.getAttribute("aria-label"),/quality|non.drop|refill|boostero|smmglob/i);
      assert.equal(await item.locator('.compare-toggle input[type="checkbox"]').count(),1,"Compare action remains available");
    }
    await cards.first().locator(".item").click();
    assert.equal(await page.locator('#checkout input[readonly]').first().inputValue(),products[0].name,"Selecting the clean card retains its original supplier-associated service object.");
    await cards.first().locator('.compare-toggle input[type="checkbox"]').check();
    const cmp=page.locator(".comparison-panel");
    await cmp.waitFor();
    const panelText=await cmp.innerText();
    assert.match(panelText,/Instagram Followers/);
    assert.doesNotMatch(panelText,/quality|non.drop|refill|boostero|smmglob/i);
    assert.ok((await page.locator("body").evaluate(el=>el.scrollWidth))<=width+2,"No horizontal overflow at "+width);
    assert.deepEqual(errors,[]);
    console.log("CLEAN_SERVICE_CARDS_PASS",width,products.length);
    await context.close();
  }
}finally{await browser.close()}
