import test from "node:test";
import assert from "node:assert/strict";
import {normalizeProfile,canonicalPost,normalizePosts,divideLikes} from "../lib/postPicker.mjs";

test("Instagram and TikTok handles accept usernames and genuine public profile URLs",()=>{
  assert.equal(normalizeProfile("instagram","@JoeyGotMeLit"),"joeygotmelit");
  assert.equal(normalizeProfile("tiktok","https://www.tiktok.com/@creator.test"),"creator.test");
  assert.equal(normalizeProfile("instagram","https://www.instagram.com/creator/?hl=en"),"creator");
});
test("Bad handles and external URLs fail closed",()=>{
  assert.equal(normalizeProfile("instagram","https://evil.com/creator"),null);
  assert.equal(normalizeProfile("tiktok","https://www.tiktok.com/@creator/video/7695973485574753544"),null);
  assert.equal(normalizeProfile("instagram","@bad..username"),null);
  assert.equal(normalizeProfile("tiktok","http://www.tiktok.com/@creator"),null);
  assert.equal(normalizeProfile("youtube","@creator"),null);
});
test("Valid canonical post URLs strip tracking and reject unsupported hosts",()=>{
  assert.equal(canonicalPost("instagram","https://www.instagram.com/reel/DeIXf9SNQVO/?utm_source=x"),"https://www.instagram.com/reel/DeIXf9SNQVO/");
  assert.equal(canonicalPost("tiktok","https://www.tiktok.com/@creator/video/7695973485574753544?lang=en"),"https://www.tiktok.com/@creator/video/7695973485574753544");
  assert.equal(canonicalPost("tiktok","https://vm.tiktok.com/ZM123"),null);
  assert.equal(canonicalPost("instagram","https://www.instagram.com.evil.com/p/ABCDE123/"),null);
});
test("Instagram provider rows normalize, deduplicate, and reject mismatched account",()=>{
  const good={type:"post",owner:{username:"creator"},url:"https://www.instagram.com/p/DeAYvsnn4la/",media:{thumbnailUrl:"https://scontent.fbcdn.net/post.jpg"},mediaType:"IMAGE"};
  const wrong={...good,url:"https://www.instagram.com/p/DeIXf9SNQVO/",owner:{username:"other"}};
  assert.equal(normalizePosts("instagram","creator",[good,good,wrong]).length,1);
});
test("TikTok provider rows normalize only valid post thumbnails",()=>{
  const row={postPage:"https://www.tiktok.com/@creator/video/7695973485574753544",channel:{username:"creator"},video:{thumbnail:"https://p16.tiktokcdn.com/image.webp"},title:"One public video"};
  const posts=normalizePosts("tiktok","creator",[row]);
  assert.equal(posts.length,1);
  assert.equal(posts[0].kind,"video");
  assert.equal(posts[0].caption,"One public video");
});
test("Three-post split preserves exact total and rejects invalid quantities",()=>{
  assert.deepEqual(divideLikes(1000,3),[334,333,333]);
  assert.deepEqual(divideLikes(300,3),[100,100,100]);
  assert.equal(divideLikes(2,3),null);
  assert.equal(divideLikes(300.5,3),null);
  assert.equal(divideLikes(300,9),null);
});

// A transient empty scraper response must not lock a public profile out for 10 minutes.
test("empty Apify results are retryable, successful lookups remain cached",async()=>{
 const {readFileSync}=await import("node:fs");
 const source=readFileSync(new URL("../app/api/post-picker/route.js",import.meta.url),"utf8");
 assert.match(source,/if\(posts\.length>0\)cached\.set\(cacheKey,\{time:Date\.now\(\),value\}\)/);
 assert.match(source,/Try again or enter direct post links below/);
});

test("independent TikTok actor output converts into selectable creator-verified thumbnails",()=>{
 const row={
  webVideoUrl:"https://www.tiktok.com/@joeygotmelit/video/7702448953609948429",
  authorMeta:{name:"joeygotmelit"},
  videoMeta:{coverUrl:"https://p16-sign.tiktokcdn.com/cover.webp"},
  text:"Example public video"
 };
 const post=normalizePosts("tiktok","joeygotmelit",[row]);
 assert.equal(post.length,1);
 assert.equal(post[0].url,"https://www.tiktok.com/@joeygotmelit/video/7702448953609948429");
 assert.match(post[0].thumbnail,/https:\/\/p16-sign\.tiktokcdn\.com/);
 assert.equal(normalizePosts("tiktok","othercreator",[row]).length,0);
 assert.equal(normalizePosts("tiktok","joeygotmelit",[{...row,authorMeta:{name:"othercreator"}}]).length,0);
});
test("TikTok scraper fallbacks use fixed actors and safe bounded lookup",async()=>{
 const {readFileSync}=await import("node:fs");
 const src=readFileSync(new URL("../app/api/post-picker/route.js",import.meta.url),"utf8");
 assert.match(src,/tokfluence~tiktok-profile-scraper/);
 assert.match(src,/profiles:\[handle\],resultsPerPage:12,maxResults:12/);
 assert.match(src,/normalizePosts\("tiktok",handle,rows\)/);
 assert.match(src,/if\(posts.length>0\)cached\.set\(cacheKey,\{time:Date\.now\(\),value\}\)/);
});
