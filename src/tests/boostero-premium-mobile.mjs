import {chromium} from "playwright";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
const widths=[320,390,768,1280];
const cards=[
 {id:"boostero_5461",name:"Instagram Premium Followers",category:"Instagram Followers",platform:"Instagram",kind:"Followers",per1000:4.8,min:1042,supplierMin:10,max:500000,unitStep:1,startingAmountCents:501,refill:false,purchasable:false},
 {id:"boostero_4751",name:"Instagram Likes Quality",category:"Instagram Likes",platform:"Instagram",kind:"Likes",per1000:0.2352,min:21259,supplierMin:100,max:1000000,unitStep:1,startingAmountCents:501,refill:false,purchasable:false},
 {id:"boostero_5101",name:"TikTok Followers",category:"TikTok Followers",platform:"TikTok",kind:"Followers",per1000:3.352,min:1492,supplierMin:10,max:100000,unitStep:1,startingAmountCents:501,refill:false,purchasable:false},
 {id:"boostero_5251",name:"TikTok Likes",category:"TikTok Likes",platform:"TikTok",kind:"Likes",per1000:1.088,min:4596,supplierMin:10,max:100000,unitStep:1,startingAmountCents:501,refill:false,purchasable:false},
 {id:"boostero_4771",name:"YouTube Likes",category:"YouTube Likes",platform:"YouTube",kind:"Likes",per1000:0.7392,min:6765,supplierMin:50,max:100000,unitStep:1,startingAmountCents:501,refill:false,purchasable:false}
];
async function verify(width){
 const ctx=await browser.newContext({viewport:{width,height:870},isMobile:width<600,hasTouch:width<600});
 const page=await ctx.newPage();let chargeCount=0;
 await page.route("**/api/premium/catalog?*",route=>{
  const params=new URL(route.request().url()).searchParams;
  const platform=params.get("platform"),category=params.get("category"),q=params.get("q")||"";
  const items=cards.filter(s=>(!platform||platform==="All platforms"||platform===s.platform)&&
    (!category||category===s.category)&&(!q||s.name.toLowerCase().includes(q.toLowerCase())));
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
   items,total:items.length,page:1,platforms:["Instagram","TikTok","YouTube"],
   categories:["Instagram Followers","Instagram Likes","TikTok Followers","TikTok Likes","YouTube Likes"],
   previewOnly:true,purchasingEnabled:false
  })});
 });
 await page.route("**/api/checkout/**",route=>{chargeCount++;return route.abort()});
 try{
  await page.goto("http://localhost:3100/premium-preview",{waitUntil:"domcontentloaded"});
  await page.locator(".premium-card").first().waitFor();
  assert.deepEqual(await page.locator(".premium-card .premium-kind").allTextContents(),
    ["Instagram Followers","Instagram Likes","TikTok Followers","TikTok Likes","YouTube Likes"]);
  await page.locator(".premium-card").first().getByRole("button",{name:"Configure order"}).click();
  await page.locator(".premium-order-grid input[type=url]").fill("https://instagram.com/example");
  await page.getByRole("button",{name:"Review quote"}).click();
  assert.match(await page.locator(".premium-summary").innerText(),/\$5\.01/);
  assert.equal(await page.locator(".premium-summary button").isDisabled(),true);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
  assert.equal(overflow,false,"No horizontal overflow at "+width);
  assert.equal(chargeCount,0);
  console.log("PASS PREMIUM 60% UI "+width+"px: correct order, links, price, disabled checkout");
 }finally{await ctx.close()}
}
try{for(const w of widths)await verify(w)}finally{await browser.close()}
