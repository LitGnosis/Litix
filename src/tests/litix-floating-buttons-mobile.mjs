// Browser-level layout regression; all payment and AI endpoints are intercepted.
import {chromium} from "playwright";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:["--no-sandbox"]});
const widths=[320,375,390,430,1280];
const distance=(a,b)=>Math.hypot(Math.max(0,a.left-b.right,b.left-a.right),Math.max(0,a.top-b.bottom,b.top-a.bottom));
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
 const ai=page.locator(".lxai-launcher"),wa=page.locator(".whatsapp-float");
 await ai.waitFor();await wa.waitFor();
 assert.equal(await ai.count(),1,"Exactly one AI floating launcher");
 assert.equal(await wa.count(),1,"Exactly one WhatsApp floating launcher");
 const waHref=await wa.getAttribute("href");assert.ok(waHref.startsWith("https://wa.me/"));
 const a=await rect(ai),w=await rect(wa);
 assert.equal(intersection(a,w),0,"Launcher overlap at "+width+"px");
 assert.ok(distance(a,w)>=12,"Minimum 12px gap; "+width+"px measured "+distance(a,w));
 for(const [name,r] of [["AI",a],["WhatsApp",w]]){
  assert.ok(r.left>=-1&&r.right<=width+1&&r.top>=-1&&r.bottom<=845,name+" must be in view at "+width);
 }
 if(mobile)assert.ok(a.left<w.left,"AI on left, WhatsApp on right");
 else assert.ok(a.bottom<=w.top-12,"Desktop launchers stacked with gap");
 assert.ok(await centerHit(page,".lxai-launcher"),"AI launcher independently clickable "+width);
 assert.ok(await centerHit(page,".whatsapp-float"),"WhatsApp independently clickable "+width);
 await ai.click();
 await page.locator(".lxai-panel").waitFor();
 const p=await rect(page.locator(".lxai-panel"));
 assert.equal(intersection(p,w),0,"Chat panel must not obscure WhatsApp "+width);
 assert.ok(distance(p,w)>=12,"Expanded panel needs 12px gap "+width+"; got "+distance(p,w));
 assert.ok(await centerHit(page,".whatsapp-float"),"WhatsApp clickable with AI expanded "+width);
 assert.equal(await wa.getAttribute("href"),waHref,"Original WhatsApp URL preserved");
 await page.locator("#lxai-entry").fill("Test AI");
 await page.locator(".lxai-compose button").click();
 await page.getByText("UI-only AI test response").waitFor();
 await page.locator(".lxai-close").click();
 await page.locator(".lxai-panel").waitFor({state:"detached"});
 const email=page.locator('#checkout input[type="email"]');
 await email.scrollIntoViewIfNeeded();
 const field=await rect(email);
 const a2=await rect(ai),w2=await rect(wa);
 assert.equal(intersection(field,a2),0,"AI obscures focused checkout email at "+width);
 assert.equal(intersection(field,w2),0,"WhatsApp obscures focused checkout email at "+width);
 assert.ok(await centerHit(page,'#checkout input[type="email"]'),"Checkout field remains clickable "+width);
 const nav=page.locator(".nav").first();
 const nr=await nav.boundingBox();
 if(nr&&nr.y>=0&&nr.y<844)assert.equal(intersection({left:nr.x,right:nr.x+nr.width,top:nr.y,bottom:nr.y+nr.height},a2),0,"Important nav clear");
 const bundle=page.locator('a[href="/bundles"]').first();
 if(await bundle.count()){
  await bundle.scrollIntoViewIfNeeded();const br=await rect(bundle),aa=await rect(ai),ww=await rect(wa);
  assert.equal(intersection(br,aa),0,"AI must not obscure bundle link");
  assert.equal(intersection(br,ww),0,"WhatsApp must not obscure bundle link");
 }
 assert.ok(!problems.some(x=>/LitixAI|cannot read|undefined is not/.test(x)),"No launcher runtime error");
 console.log("PASS FLOATS "+width+"px: "+distance(a,w).toFixed(1)+"px separation, AI and WhatsApp clickable, expanded panel clear, checkout/bundle access");
 await ctx.close();
}
try{for(const w of widths)await verify(w)}finally{await browser.close()}
