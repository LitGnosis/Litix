import {chromium} from "playwright";
import assert from "node:assert/strict";

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
const root="http://localhost:3100";
const media=[
 "https://www.instagram.com/p/LitixTestPost111/",
 "https://www.instagram.com/p/LitixTestPost222/",
 "https://www.instagram.com/reel/LitixTestPost333/"
];
async function runViewport(width,mobile){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:mobile,hasTouch:mobile});
 const page=await context.newPage();
 const observed=[];
 await page.route("**/api/choose-posts/catalog",route=>route.fulfill({status:200,contentType:"application/json",
  body:JSON.stringify({services:[{id:"33337",name:"Instagram Likes Mock",per1000:5,min:100,max:100000,unitStep:1}],status:"live"})}));
 await page.route("**/api/choose-posts/checkout",async route=>{
  if(route.request().method()==="POST"){
   const body=route.request().postDataJSON();observed.push(body);
   return route.fulfill({status:200,contentType:"application/json",
    body:JSON.stringify({orderId:"ltx2_11111111-1111-4111-8111-111111111111",payment:"simulated",fulfillment:"preview_only",message:"No payment or supplier order."})});
  }
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({demo:true,paymentReady:false,customerPaymentMode:"TEST",minimumCheckoutCents:500})});
 });
 await page.route("**/api/choose-posts/media?*",route=>route.fulfill({status:200,contentType:"application/json",
  body:JSON.stringify({username:"litixdemo",available:true,message:"Select your posts.",
   posts:media.map((url,i)=>({url,thumbnail:"data:image/svg+xml,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='#0a6b93'/><text x='20' y='110' font-size='22' fill='white'>Post "+(i+1)+"</text></svg>"),mediaType:"IMAGE"}))})}));
 await page.goto(root+"/choose-posts",{waitUntil:"networkidle"});
 await page.getByLabel("Instagram username").fill("@litixdemo");
 await page.getByRole("button",{name:"Find Posts"}).click();
 await page.locator(".cyp-tile").first().waitFor();
 assert.equal(await page.locator(".cyp-tile").count(),3);
 const gridCols=await page.locator(".cyp-grid").evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(" ").length);
 assert.equal(gridCols,3,"three visual posts columns at "+width+"px");
 await page.locator(".cyp-tile").nth(0).click();await page.locator(".cyp-tile").nth(1).click();
 assert.equal(await page.locator(".cyp-picked-row").count(),2);
 await page.locator(".cyp-tile").nth(0).click();
 assert.equal(await page.locator(".cyp-picked-row").count(),1,"deselection works");
 await page.locator("#cyp-links").fill("https://www.instagram.com/p/ManualPostABC/");
 await page.getByRole("button",{name:"Add post links"}).click();
 assert.equal(await page.locator(".cyp-picked-row").count(),2,"manual fallback included");
 await page.getByLabel("Likes on each post").fill("1000");
 await page.getByLabel("Order email").fill("preview@example.com");
 assert.match(await page.locator(".cyp-total").innerText(),/\$10\.00/,"one cart total = 2 times 5.00");
 const btn=page.getByRole("button",{name:/Wrap Up Your Order/});assert.equal(await btn.isEnabled(),true);
 await btn.click();await page.getByText("Preview order simulated").waitFor();
 assert.equal(observed.length,1,"one checkout request");
 assert.equal(observed[0].simulate,true);
 assert.equal(observed[0].posts.length,2);
 assert.equal(observed[0].expectedAmountCents,1000);
 assert.equal(observed[0].paymentToken,"");
 if(mobile)assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),true,
  "no horizontal page overflow on mobile "+width);
 console.info("PASS Choose Posts responsive "+width+"px: 3-column thumbnails, deselection, manual fallback, exact total, one no-charge request");
 await context.close();
}
try{await runViewport(390,true);await runViewport(412,true);await runViewport(1280,false)}
finally{await browser.close()}
