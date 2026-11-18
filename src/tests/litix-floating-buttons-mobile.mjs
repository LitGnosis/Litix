// Browser-level layout regression; all payment and AI endpoints are intercepted.
import {chromium} from "playwright";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
const widths=[320,375,390,430,1280];
const intersection=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
const rect=async element=>{const b=await element.boundingBox();assert.ok(b);return {left:b.x,right:b.x+b.width,top:b.y,bottom:b.y+b.height,width:b.width,height:b.height}};
const centerHit=async(page,sel)=>page.locator(sel).first().evaluate(el=>{
 const r=el.getBoundingClientRect(),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
 return !!top&&(top===el||el.contains(top));
});
async function verify(width){
 const mobile=width<576,ctx=await browser.newContext({viewport:{width,height:844},isMobile:mobile,hasTouch:mobile});
 const page=await ctx.newPage(),problems=[];
 page.on("pageerror",err=>problems.push(err.message));
 await page.route("**/api/config",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ready:false,publicKey:null})}));
 await page.route("**/api/litix-ai",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(route.request().method()==="POST"?{reply:"UI-only AI test response"}:{available:true,verified:false})}));
 await page.route("**/api/catalog/v1?*",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({items:[],total:0,allCount:0,categories:[],catalogStatus:"live"})}));
 await page.goto("http://localhost:3100/",{waitUntil:"domcontentloaded"});
 const ai=page.locator(".lxai-launcher"),mobileBar=page.locator(".litix-mobile-checkout-bar");
 await ai.waitFor();
 assert.equal(await ai.count(),1,"Exactly one unified support launcher");
 assert.equal(await page.locator(".whatsapp-float").count(),0,"No duplicate WhatsApp launcher");
 const a=await rect(ai);
 console.log("SUPPORT_GEOMETRY",JSON.stringify({width,ai:a}));
 assert.ok(a.left>=-1&&a.right<=width+1&&a.top>=-1&&a.bottom<=845,"Unified support launcher fits viewport");
 if(width<768){
  const b=await rect(mobileBar);
  assert.equal(intersection(a,b),0,"Support launcher must not obscure sticky checkout");
 }
 assert.ok(await centerHit(page,".lxai-launcher"),"Unified support launcher must be independently clickable");
 await ai.click();
 await page.locator(".lxai-panel").waitFor();
 const p=await rect(page.locator(".lxai-panel"));
 assert.ok(p.left>=-1&&p.right<=width+1,"Expanded modal fits viewport at "+width);
 assert.ok(p.top>=-1&&p.bottom<=845,"Expanded modal fits viewport height at "+width);
 assert.ok(await centerHit(page,".lxai-panel"),"Support modal remains clickable");
 await page.locator("#lxai-entry").fill("Test AI");
 await page.locator(".lxai-compose button").click();
 await page.getByText("UI-only AI test response").waitFor();
 await page.locator(".lxai-close").click();
 await page.locator(".lxai-panel").waitFor({state:"detached"});
 const email=page.locator('#checkout input[type="email"]');
 await email.scrollIntoViewIfNeeded();
 const field=await rect(email),a2=await rect(ai);
 assert.equal(intersection(field,a2),0,"Unified support must not obscure focused checkout email");
 assert.ok(await centerHit(page,'#checkout input[type="email"]'),"Checkout email remains clickable");
 const nav=page.locator(".nav").first();
 const nr=await nav.boundingBox();
 if(nr&&nr.y>=0&&nr.y<844)assert.equal(intersection({left:nr.x,right:nr.x+nr.width,top:nr.y,bottom:nr.y+nr.height},a2),0,"Important nav clear");
 const bundle=page.locator('a[href="/bundles"]').first();
 if(await bundle.count()){
  await bundle.scrollIntoViewIfNeeded();const br=await rect(bundle),aa=await rect(ai);
  assert.equal(intersection(br,aa),0,"AI must not obscure bundle link");

 }
 assert.ok(!problems.some(x=>/LitixAI|cannot read|undefined is not/.test(x)),"No launcher runtime error");
 console.log("PASS SINGLE SUPPORT "+width+"px");
 await ctx.close();
}
try{for(const w of widths)await verify(w)}finally{await browser.close()}
