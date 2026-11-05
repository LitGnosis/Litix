import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {LITIX_SOLUTIONS,LITIX_SOLUTION_SLUGS,getLitixSolution} from "../lib/litixSolutions.mjs";
import {validateSolutionInquiry} from "../lib/litixSolutionInquiries.mjs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const lead={name:"QA Prospect",email:"Contact@Example.com",organization:"Example LLC",budget:"unsure",solution:"local",goals:"We need genuine local lead generation and marketing help.",consent:true,faxTrap:""};

test("all revenue divisions have distinct routes, explicit proposal status, and no auto checkout",()=>{
 assert.equal(LITIX_SOLUTIONS.length,12);
 assert.equal(new Set(LITIX_SOLUTION_SLUGS).size,12);
 for(const s of LITIX_SOLUTIONS){
  assert.equal(getLitixSolution(s.slug)?.name,s.name);
  assert.ok(s.scope.length>=2);
 }
 const hub=read("app/solutions/page.jsx"),detail=read("app/solutions/[slug]/page.jsx");
 assert.match(hub,/LITIX_SOLUTIONS\.map/);
 assert.match(detail,/manual|automatically|No checkout|No payment|inquiry/i);
 assert.doesNotMatch(hub,/startPaymentRequest|NMI_SECURITY_KEY|BOOSTERO_API_KEY/);
});
test("solution lead intake validates real business inquiries and requires consent",()=>{
 const ok=validateSolutionInquiry(lead);
 assert.equal(ok.ok,true);
 assert.equal(ok.data.email,"contact@example.com");
 assert.equal(ok.data.solutionName,"Litix Local Growth");
 for(const bad of [
  {...lead,consent:false},{...lead,solution:"undefined-unknown"},
  {...lead,email:"bad"},{...lead,goals:"short"},{...lead,budget:"admin"},
  {...lead,organization:"x".repeat(121)}
 ])assert.equal(validateSolutionInquiry(bad).ok,false);
 assert.equal(validateSolutionInquiry({...lead,faxTrap:"spam"}).spam,true);
});
test("new pages link from storefront and sitemap without touching payment routes",()=>{
 assert.match(read("components/LitixQuickShop.jsx"),/href="\/solutions"/);
 assert.match(read("app/shop/page.jsx"),/href="\/solutions"/);
 assert.match(read("app/sitemap.js"),/LITIX_SOLUTION_SLUGS\.map/);
 assert.match(read("app/api/solutions/inquiry/route.js"),/validateSolutionInquiry/);
 assert.doesNotMatch(read("app/api/solutions/inquiry/route.js"),/\/api\/checkout\/v1|dispatchPrepaidAutoLikes|supplier\("add"\)/);
 assert.match(read("app/legal/privacy/page.jsx"),/Solutions inquiry information/);
});
