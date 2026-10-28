import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
try{
 for(const width of [390,412,1280]){
  await test("live read-only Boostero storefront works at "+width+"px",async()=>{
   const context=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600});
   const page=await context.newPage();
   const unauthorized=[];
   page.on("request",request=>{
    const u=new URL(request.url());
    if(request.method()!=="GET"&&/\/api\/(?:checkout|internal\/boostero|bundles\/checkout)/.test(u.pathname))
     unauthorized.push(request.method()+" "+u.pathname);
   });
   try{
    const response=await page.goto("https://www.litix.net/",{waitUntil:"domcontentloaded",timeout:60000});
    assert.ok(response?.ok(),"Live site HTTP error");
    await page.waitForFunction(()=>document.querySelectorAll("#services .service-option").length===4,null,{timeout:45000});
    const cards=page.locator("#services .service-option");
    assert.equal(await cards.count(),4);
    const texts=await cards.allInnerTexts(),all=texts.join(" | ");
    for(const name of ["Instagram Followers","Instagram Likes","TikTok Followers","TikTok Likes"]){
     assert.ok(all.includes(name),"Missing approved "+name);
    }
    for(const forbidden of ["TikTok Share","TikTok Saves","Instagram Impressions","Unavailable for new orders","SMMGLOB"]){
     assert.ok(!all.includes(forbidden),"Retired or unavailable card visible: "+forbidden);
    }
    assert.ok(texts.some(x=>/\$15\.00/.test(x)),"Existing $15 price missing");
    assert.ok(texts.filter(x=>/\$6\.99/.test(x)).length===2,"Existing two $6.99 prices missing");
    assert.equal(unauthorized.length,0,"No customer payment/order request permitted");
    const grid=await page.locator("#services .cards").evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
    assert.ok(grid.scroll<=grid.client+3,"Catalog horizontal overflow: "+JSON.stringify(grid));
    console.log("LIVE_BOOSTERO_ONLY_MOBILE_PASS="+width+";ACTIVE=4;LEGACY=0;NO_CHARGES");
   }finally{await context.close()}
  });
 }
}finally{await browser.close()}
