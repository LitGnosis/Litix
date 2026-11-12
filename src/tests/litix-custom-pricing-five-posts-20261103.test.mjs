import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {customQuote,customLineCents,readCustomDraft,CUSTOM_DRAFT_PREFIX,CUSTOM_DRAFT_MAX_AGE_MS} from "../lib/customQuote.mjs";
import {litixOrderCents} from "../lib/litixRetail60.mjs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

const likes={id:"litix_4751",platform:"Instagram",kind:"likes",purchasable:true,per1000:6.99,min:200,max:100000,unitStep:1};
const followers={id:"litix_5461",platform:"Instagram",kind:"followers",purchasable:true,per1000:15,min:100,max:100000,unitStep:1};

test("calculator uses the SAME cent rounding as the server-side Litix pricing policy",()=>{
 for(const [qty,amount] of [[200,140],[1000,699],[1500,1049]]){
  assert.equal(customLineCents(likes.per1000,qty),amount);
  assert.equal(customLineCents(likes.per1000,qty),litixOrderCents(699,qty));
 }
 const one=customQuote(likes,"likes",0,[{quantity:200}]);
 assert.equal(one.valid,true);assert.equal(one.totalCents,140);
 const multiple=customQuote(likes,"likes",0,[{quantity:200},{quantity:1000},{quantity:1500}]);
 assert.equal(multiple.valid,true);
 assert.equal(multiple.quantity,2700);
 assert.equal(multiple.totalCents,140+699+1049);
 assert.deepEqual(multiple.lines.map(x=>x.cents),[140,699,1049]);
});

test("followers price calculator respects exact live quantity and one-profile design",()=>{
 const q=customQuote(followers,"followers",1500);
 assert.equal(q.valid,true);assert.equal(q.totalCents,2250);
 assert.equal(q.quantity,1500);
 assert.equal(customQuote(followers,"followers",0).valid,false);
 assert.equal(customQuote(followers,"followers",120000).valid,false);
});

test("up to five posts, per-post minimums and total quantity limit are enforced",()=>{
 assert.equal(customQuote(likes,"likes",0,Array.from({length:5},()=>({quantity:1000}))).totalCents,3495);
 assert.equal(customQuote(likes,"likes",0,Array.from({length:6},()=>({quantity:1000}))).valid,false);
 assert.equal(customQuote(likes,"likes",0,[]).valid,false);
 assert.equal(customQuote(likes,"likes",0,[{quantity:199}]).valid,false);
 assert.equal(customQuote(likes,"likes",0,[{quantity:1001.5}]).valid,false);
 assert.equal(customQuote(likes,"likes",0,[{quantity:1000},{quantity:NaN}]).valid,false);
 assert.equal(customQuote({...likes,per1000:3.0,min:100},"likes",0,[{quantity:100}]).valid,false,"$1 minimum per post");
 assert.equal(customQuote({...likes,max:1000000},"likes",0,Array.from({length:2},()=>({quantity:600000}))).valid,false,"max 1m total");
});

test("five-post handoff never trusts a stale, unrelated, or cross-platform draft",()=>{
 const now=1_799_000_000_000;
 const data={version:1,createdAt:now,serviceId:likes.id,kind:"likes",
  posts:[
   {quantity:200,link:"https://www.instagram.com/p/ABC123/",verifiedInput:"https://www.instagram.com/p/ABC123/",verifiedUrl:"https://www.instagram.com/p/ABC123/"},
   {quantity:1000,link:"https://www.instagram.com/reel/XYZ456/",verifiedInput:"https://www.instagram.com/reel/XYZ456/",verifiedUrl:"https://www.instagram.com/reel/XYZ456/"}
  ]};
 const value=readCustomDraft(data,likes,now+5000);
 assert.equal(value.length,2);assert.equal(value[0].status,"verified");
 assert.equal(readCustomDraft(data,{...likes,id:"litix_5251"},now+5000),null);
 assert.equal(readCustomDraft(data,likes,now+CUSTOM_DRAFT_MAX_AGE_MS+1),null);
 assert.equal(readCustomDraft({...data,posts:Array.from({length:6},()=>data.posts[0])},likes,now),null);
 const tampered={...data,posts:[{...data.posts[0],verifiedUrl:"https://evil.example/p/post"}]};
 const untrusted=readCustomDraft(tampered,likes,now);
 assert.equal(untrusted[0].status,"idle","spoofed post verification cannot be treated as checked");
 assert.ok(CUSTOM_DRAFT_PREFIX.startsWith("litix:"));
});

test("Custom page reads supplier-approved public price, enables five selected posts and carries them into checkout",()=>{
 const hub=read("components/LitixCustomHub.jsx");
 const home=read("app/page.jsx"),chooser=read("components/SocialMultiPostChooser.jsx");
 assert.match(hub,/\/api\/catalog\/checkout-choices\?/);
 assert.match(hub,/SocialMultiPostChooser/);
 assert.match(hub,/posts=\{posts\} onChange=\{setPosts\}/);
 assert.match(hub,/customQuote\(liveService,kind,quantity,posts\)/);
 assert.match(hub,/Estimated total/);
 assert.match(hub,/quote\.lines\.map/);
 assert.match(hub,/posts\.map\(p=>/);
 assert.match(hub,/CUSTOM_DRAFT_PREFIX\+id/);
 assert.match(home,/readCustomDraft\(saved,selected\)/);
 assert.match(home,/restored\?\.length/);
 assert.match(chooser,/posts\.length<5/);
 assert.doesNotMatch(hub,/NMI_SECURITY_KEY|BOOSTERO_API_KEY|paymentToken|startPaymentRequest/);
 assert.match(home,/expectedAmountCents:price/);
});
