// Browser proof that five *distinct* public TikTok post links, quantities and
// preview totals reach the existing PayKings checkout without a charge.
import {chromium} from "playwright";
import assert from "node:assert/strict";

const cards=[
 {id:"litix_4751",platform:"Instagram",kind:"likes",name:"Instagram Likes",purchasable:true,per1000:6.99,min:200,max:100000,unitStep:1},
 {id:"litix_5461",platform:"Instagram",kind:"followers",name:"Instagram Followers",purchasable:true,per1000:15,min:100,max:100000,unitStep:1},
 {id:"litix_5251",platform:"TikTok",kind:"likes",name:"TikTok Likes",purchasable:true,per1000:6.99,min:200,max:100000,unitStep:1},
 {id:"litix_5101",platform:"TikTok",kind:"followers",name:"TikTok Followers",purchasable:true,per1000:14.99,min:100,max:100000,unitStep:1}
];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 const errors=[],unsafeRequests=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/api/**",route=>{
  const request=route.request(),url=new URL(request.url()),p=url.pathname;
  if(request.method()!=="GET"&&/(checkout|boostero|nmi|payment)/i.test(p))unsafeRequests.push(p);
  let d={};
  if(p==="/api/catalog/checkout-choices")
   d={items:cards.filter(x=>x.platform===(url.searchParams.get("platform")||"Instagram")),liveAvailability:true};
  else if(p==="/api/catalog/v1"){
   const q=url.searchParams.get("q");
   d={items:q?cards.filter(x=>x.id===q):cards,allCount:cards.length,total:cards.length,categories:[],catalogStatus:"live"};
  }
  else if(p==="/api/tiktok/resolve"){
   const input=request.postDataJSON()?.link||"";
   if(!/^https:\/\/www\.tiktok\.com\/@[\w.]+\/video\/\d{19}$/.test(input))
    return route.fulfill({status:422,contentType:"application/json",body:JSON.stringify({error:"Invalid test post"})});
   d={url:input};
  }
  else if(p==="/api/config")d={ready:false,publicKey:null};
  else if(p==="/api/bundles")d={checkoutEnabled:true,bluevineEnabled:true,packages:[]};
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(d)});
 });
 await page.goto("http://localhost:3100/custom-likes",{waitUntil:"domcontentloaded"});
 const hub=page.locator(".litix-custom-hub");
 await hub.getByRole("button",{name:"TikTok",exact:true}).click();
 await hub.locator(".litix-custom-calculator").waitFor();
 const rate=await hub.locator(".litix-custom-rate").innerText();
 assert.match(rate,/\$6\.99/);
 await hub.getByRole("button",{name:"Choose your posts (up to 5)"}).click();
 const chooser=hub.locator("#litix-hub-post-picker");
 for(let i=1;i<5;i++)await chooser.getByRole("button",{name:"Add another post"}).click();
 assert.equal(await chooser.locator(".litix-picker-entry").count(),5);
 assert.equal(await chooser.getByRole("button",{name:"Add another post"}).count(),0,"cannot choose 6th post");
 const quantities=[200,300,400,500,600];
 for(let i=0;i<5;i++){
  const entry=chooser.locator(".litix-picker-entry").nth(i);
  const link="https://www.tiktok.com/@litixsocial/video/735000000000000000"+(i+1);
  await entry.locator('input[type="url"]').fill(link);
  await entry.locator('input[type="number"]').fill(String(quantities[i]));
  await entry.getByRole("button",{name:"Verify post"}).click();
  await entry.getByRole("button",{name:/Verified/}).waitFor();
 }
 await hub.locator(".litix-custom-estimate").getByText("$14.00").waitFor();
 assert.equal(await hub.locator(".litix-custom-post-summary").getByText(/Post \d/).count(),5);
 await hub.getByRole("link",{name:/Review TikTok Likes Order/}).click();
 await page.waitForURL(url=>url.pathname==="/"&&url.searchParams.get("service")==="litix_5251"&&!!url.searchParams.get("draft"));
 await page.locator("#checkout .litix-picker-entry").first().waitFor({timeout:20000});
 assert.equal(await page.locator("#checkout .litix-picker-entry").count(),5,"all five post links transferred");
 const restored=await page.locator("#checkout .litix-picker-entry").allTextContents();
 assert.equal(restored.length,5);
 assert.match(await page.locator("#checkout .totalbox").last().innerText(),/14\.00/);
 assert.equal(unsafeRequests.length,0,"never issue a payment/supplier charge while inspecting");
 assert.deepEqual(errors,[],"no browser JavaScript errors");
 console.log("LITIX_CUSTOM_FIVE_POSTS_PASS",JSON.stringify({posts:5,quantity:2000,amountCents:1400,charged:false}));
 await context.close();
}finally{await browser.close()}
