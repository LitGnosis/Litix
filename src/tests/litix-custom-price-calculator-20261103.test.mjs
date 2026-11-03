import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {customPriceQuote,customQuantityCents,customPublicCardValid,customRateCents,CUSTOM_MAX_POSTS} from "../lib/litixCustomCalculator.mjs";
import {litixOrderCents} from "../lib/litixRetail60.mjs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const instagramLikes={id:"litix_4751",platform:"Instagram",kind:"likes",purchasable:true,min:150,max:10000,unitStep:1,per1000:6.99};
const instagramFollowers={id:"litix_5461",platform:"Instagram",kind:"followers",purchasable:true,min:100,max:25000,unitStep:1,per1000:15.00};

test("Public calculator fetches selected approved Litix service, not hardcoded or wholesale rates",()=>{
 const ui=read("components/LitixCustomPriceCalculator.jsx");
 assert.match(ui,/fetch\("\/api\/catalog\/v1\?"/);
 assert.match(ui,/customPublicCardValid\(x,product\)/);
 assert.match(ui,/Retry current price/);
 assert.match(ui,/Current prices are unavailable|Could not load current Litix prices/);
 assert.doesNotMatch(ui,/wholesaleCents|BOOSTERO_API_KEY|NMI_SECURITY_KEY|paymentToken/);
 assert.equal(customPublicCardValid(instagramLikes,{id:"litix_4751",platform:"Instagram",kind:"likes"}),true);
 assert.equal(customPublicCardValid({...instagramLikes,purchasable:false},{id:"litix_4751",platform:"Instagram",kind:"likes"}),false);
 assert.equal(customPublicCardValid({...instagramLikes,per1000:0},{id:"litix_4751",platform:"Instagram",kind:"likes"}),false);
 assert.equal(customPublicCardValid(instagramLikes,{id:"litix_5251",platform:"TikTok",kind:"likes"}),false);
});

test("Exact cents match checkout rounding for variable Likes quantities across five posts",()=>{
 assert.equal(customRateCents(instagramLikes),699);
 const quantities=[150,200,500,1000,2000];
 const quote=customPriceQuote(instagramLikes,quantities,"likes");
 const expected=quantities.map(q=>litixOrderCents(699,q));
 assert.deepEqual(quote.lines,expected);
 assert.equal(quote.totalCents,expected.reduce((a,b)=>a+b,0));
 assert.equal(quote.totalUnits,3850);
 assert.equal(CUSTOM_MAX_POSTS,5);
 assert.equal(quote.valid,true);
 assert.equal(customPriceQuote(instagramLikes,[150,150,150,150,150,150],"likes").valid,false);
 assert.equal(customPriceQuote(instagramLikes,[150,150],"followers").valid,false);
 assert.equal(customPriceQuote(instagramLikes,[149],"likes").valid,false);
 assert.equal(customQuantityCents(instagramLikes,150),105);
});

test("Followers calculate before checkout and reject invalid range, step and sub-dollar charges",()=>{
 assert.equal(customPriceQuote(instagramFollowers,[1000],"followers").totalCents,1500);
 assert.equal(customPriceQuote(instagramFollowers,[100],"followers").totalCents,150);
 assert.equal(customPriceQuote(instagramFollowers,[25001],"followers").valid,false);
 assert.equal(customPriceQuote(instagramFollowers,[0],"followers").valid,false);
 assert.equal(customPriceQuote(instagramFollowers,[200.5],"followers").valid,false);
 assert.equal(customPriceQuote({...instagramFollowers,min:100,unitStep:100},[150],"followers").valid,false);
 assert.equal(customPriceQuote({...instagramLikes,min:100,per1000:6.0},[100],"likes").valid,false);
 assert.equal(customPriceQuote({...instagramLikes,min:1000,max:1000000},[1000000,1000000],"likes").valid,false);
});

test("Customer can choose and verify up to five posts before checkout, preserving private checkout handoff",()=>{
 const ui=read("components/LitixCustomPriceCalculator.jsx");
 const home=read("app/page.jsx");
 assert.match(ui,/SocialMultiPostChooser/);
 assert.match(ui,/Add Post/);
 assert.match(ui,/Choose your posts now/);
 assert.match(ui,/\&mode=multi\&posts=/);
 assert.match(ui,/sessionStorage\.setItem\(storageKey/);
 assert.match(ui,/customQuote=1/);
 assert.match(home,/params\.get\("quantities"\)/);
 assert.match(home,/count<=5/);
 assert.match(home,/sessionStorage\.getItem\("litix:custom-quote-v1"\)/);
 assert.match(home,/Date\.now\(\)-Number\(saved\.savedAt\)<600000/);
 assert.match(home,/newTikTokPost\(\{link:url,quantity,verifiedUrl\}\)/);
 assert.match(home,/postAllocations:multiPosts\.map/);
 assert.match(home,/expectedAmountCents:price/);
 const chooser=read("components/SocialMultiPostChooser.jsx");
 assert.match(chooser,/posts\.length<5/);
 assert.match(chooser,/Add another post/);
});

test("Checkout remains responsible for charges and rejects price mismatch",()=>{
 const calc=read("components/LitixCustomPriceCalculator.jsx");
 const handler=read("lib/boosteroOrderHandler.mjs");
 assert.doesNotMatch(calc,/startPaymentRequest|\/api\/checkout\/v1|boosteroProduction\("add"\)/);
 assert.match(handler,/Number\(data\?\.expectedAmountCents\)!==quote\.amountCents/);
 assert.match(handler,/data\.postAllocations\.length>5/);
 assert.match(handler,/totalCents\+=one\.amountCents/);
});
