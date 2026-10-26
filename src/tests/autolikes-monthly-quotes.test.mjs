import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import { quoteMonthlyAutoLikes } from "../lib/autolikes.mjs";

const service={service:33588,name:"Instagram Likes",category:"Instagram",type:"Default",rate:4,min:100,max:10000};
test("monthly quote stays based on the existing retail pricing without hidden additional markup",()=>{
 const q=quoteMonthlyAutoLikes({service,platform:"instagram",quantityPerPost:600,maxPostsPerMonth:10});
 assert.equal(q.maxPostsPerMonth,10);
 assert.equal(q.amountCents,q.monthlyCapacityCents);
 assert.equal(q.monthlyCapacityCents,q.perPostCents*10);
 assert.equal(q.billingInterval,"monthly");
 assert.equal(q.currency,"USD");
});
test("quote cannot promise unlimited posts or take wrong-service pricing",()=>{
 assert.throws(()=>quoteMonthlyAutoLikes({service,platform:"tiktok",quantityPerPost:600,maxPostsPerMonth:10}));
 for(const posts of [0,-1,61,1.5]) assert.throws(()=>quoteMonthlyAutoLikes({service,platform:"instagram",quantityPerPost:600,maxPostsPerMonth:posts}));
 for(const qty of [1,10001,500.2]) assert.throws(()=>quoteMonthlyAutoLikes({service,platform:"instagram",quantityPerPost:qty,maxPostsPerMonth:10}));
});
test("quote endpoint is read-only and authenticated",()=>{
 const src=readFileSync(new URL("../app/api/account/subscribe/quote/route.js",import.meta.url),"utf8");
 assert.match(src,/authenticatedCustomer\(\)/);
 assert.match(src,/sameOrigin\(request\)/);
 assert.match(src,/fetchLikesServices\(platform\)/);
 assert.doesNotMatch(src,/action: ?["']add["']|recurring: ?["']add_subscription["']|NMI_SECURITY_KEY|SMMGLOB_API_KEY/);
});
