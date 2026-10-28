// Browser-only presentation test. All catalog, payment, bundle, and AI calls are mocked.
// No production database, supplier API, or gateway requests are made.
import {chromium} from "playwright";
import assert from "node:assert/strict";

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
const widths=[320,375,390,430,1280];
const item=(id,category,per1000)=>({
 id,name:category+" test service",category,platform:category.split(" ")[0],
 per1000,min:100,max:100000,unitStep:1,startingAmountCents:500,
 purchasable:true,refill:false,noDrop:false
});
const source=[
 item("other-1","YouTube Views",1),
 item("tt-like-12","TikTok Likes",12.5),
 item("ig-follow-15","Instagram Followers",15),
 item("ig-like-13","Instagram Likes",13),
 item("tt-follow-17","TikTok Followers",17),
 item("ig-follow-7","Instagram Followers",7.5),
 item("tt-like-5","TikTok Likes",5.99),
 item("tt-follow-8","TikTok Followers",8.99),
 item("ig-like-6","Instagram Likes",6.1),
 item("other-2","Facebook Shares",1.5)
];
const expected=["ig-follow-7","ig-follow-15","ig-like-6","ig-like-13",
 "tt-follow-8","tt-follow-17","tt-like-5","tt-like-12","other-1","other-2"];
async function verify(width){
 const mobile=width<576,context=await browser.newContext({viewport:{width,height:840},isMobile:mobile,hasTouch:mobile});
 const page=await context.newPage();
 let refreshes=0,orderRequests=0;
 await page.route("**/api/config",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ready:false,publicKey:""})}));
 await page.route("**/api/litix-ai",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({available:false})}));
 await page.route("**/api/catalog/v1?*",route=>{
  const params=new URL(route.request().url()).searchParams,platform=params.get("platform"),kind=params.get("kind"),category=params.get("category"),q=params.get("q");
  refreshes++;
  let data=source.filter(s=>(!platform||platform==="All platforms"||s.platform===platform)&&
   (!kind||s.category.toLowerCase().endsWith(kind))&&(!category||s.category===category)&&
   (!q||s.name.toLowerCase().includes(q.toLowerCase())));
  if(refreshes%2===0)data=data.slice().reverse();
  return route.fulfill({status:200,contentType:"application/json",
   body:JSON.stringify({items:data,allCount:data.length,total:data.length,page:1,
    categories:[...new Set(source.map(s=>s.category))],catalogStatus:"live"})});
 });
 await page.route("**/api/checkout/**",route=>{orderRequests++;return route.fulfill({status:403,body:"NO ORDERS IN UI TEST"})});
 try{
  await page.goto("http://localhost:3100/",{waitUntil:"domcontentloaded"});
  const cards=page.locator("#services .service-option");
  await cards.first().waitFor();
  await page.waitForFunction(()=>document.querySelectorAll("#services .service-option").length===10);
  const cardIds=async()=>cards.evaluateAll(els=>els.map(el=>el.querySelector(".item .foot .tag")?.textContent?.replace(/^#/,"")));
  assert.deepEqual(await cardIds(),expected,"Custom Orders priority and price at "+width+"px");
  // A background service update must not replace retailer's numerical order.
  await page.getByRole("button",{name:"Refresh catalog"}).click();
  await page.waitForFunction(()=>document.querySelectorAll("#services .service-option").length===10);
  assert.deepEqual(await cardIds(),expected,"Stable priority after catalog refresh at "+width+"px");
  await page.getByRole("button",{name:"Instagram Likes",exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll("#services .service-option").length===2);
  assert.deepEqual(await cardIds(),["ig-like-6","ig-like-13"],"Like prices asc at "+width+"px");
  await page.getByRole("button",{name:"TikTok Followers",exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll("#services .service-option").length===2 &&
    document.querySelector("#services .service-option .foot .tag")?.textContent?.includes("tt-follow-8"));
  assert.deepEqual(await cardIds(),["tt-follow-8","tt-follow-17"],"TikTok follower prices asc at "+width+"px");
  assert.equal(orderRequests,0,"No checkout requests allowed in sorting tests");
  console.log("PASS CUSTOM_ORDERS_SORT "+width+"px: exact four-category ordering, refresh, quick filters, no payment");
 }finally{await context.close()}
}
try{for(const width of widths)await verify(width)}finally{await browser.close()}
