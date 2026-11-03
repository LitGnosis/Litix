import test from "node:test";
import assert from "node:assert/strict";
import {parseProfile,parsePost,splitQuantity,targetsFor} from "../src/targets.js";
test("Instagram followers go to profile and likes to media",()=>{
 const p=parseProfile("@litixqa","INSTAGRAM");
 assert.equal(p,"https://www.instagram.com/litixqa/");
 const post=parsePost("https://instagram.com/reel/TestMedia9?igsh=abc","INSTAGRAM",p);
 assert.equal(post,"https://www.instagram.com/reel/TestMedia9/");
 assert.deepEqual(targetsFor("FOLLOWERS",1000,p,[post]),[{link:p,splitIndex:0,quantity:1000}]);
 assert.deepEqual(targetsFor("LIKES",500,p,[post]),[{link:post,splitIndex:0,quantity:500}]);
});
test("splits quantities exactly",()=>{
 const rows=splitQuantity(1001,["a","b","c"]);
 assert.deepEqual(rows.map(x=>x.quantity),[334,334,333]);
 assert.equal(rows.reduce((n,x)=>n+x.quantity,0),1001);
});
test("TikTok posts must match profile",()=>{
 const profile=parseProfile("@litixqa","TIKTOK");
 assert.throws(()=>parsePost("https://www.tiktok.com/@otheruser/video/12345678","TIKTOK",profile),/POST_PROFILE_MISMATCH/);
});
test("rejects unsafe URLs",()=>{
 const p=parseProfile("@litixqa","INSTAGRAM");
 for(const bad of ["http://instagram.com/p/abc","https://evil.com/p/abc",
  "https://instagram.com.evil.com/p/abc","https://localhost/p/abc"])
  assert.throws(()=>parsePost(bad,"INSTAGRAM",p));
});
