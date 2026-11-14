// Exact fixed-price Instagram/TikTok Growth Bundles. Do not apply general service markup.
export const BUNDLE_INSTRUCTIONS="A single Litix Growth Bundle covers the package totals shown. After placing your order, send the order number and up to 10 public post links to the Litix Concierge. Likes, Views and Shares are allocated across your selected posts, while Followers apply once to your profile. Litix verifies the payment and confirms delivery eligibility before routing the order. The same quantities are not repeated for every post.";
// Owner's October 26 update: 20% increase above the previous four prices.
// Followers are delivered to the purchased account/profile, not to individual posts.
const levels=[
 ["launch","Launch",5382,[25000,100000,1000,5000]],
 ["momentum","Momentum",10782,[50000,250000,2500,10000]],
 ["power","Power",19782,[100000,500000,5000,20000]],
 ["apex","Apex",35982,[250000,1000000,10000,50000]],
];
export const BUNDLE_KINDS=["Likes","Views","Shares","Followers"];
export const POST_BUNDLE_KINDS=["Likes","Views","Shares"];
export const GROWTH_BUNDLES=["Instagram","TikTok"].flatMap(platform=>
 levels.map(([slug,tier,priceCents,counts])=>Object.freeze({
  id:(platform==="Instagram"?"ig":"tt")+"_"+slug,
  name:platform+" "+tier+" Growth Bundle",platform,tier,priceCents,
  items:Object.freeze(Object.fromEntries(BUNDLE_KINDS.map((k,i)=>[k,counts[i]]))),
  maxPosts:10, manualApprovalRequired:true, refillPolicy:"Refill eligibility varies; no guaranteed refill",
 }))
);
export function growthBundle(id){return GROWTH_BUNDLES.find(x=>x.id===id)||null}
export const validWhatsApp=value=>{
 const n=String(value||"").replace(/\D/g,"");
 return n.length>=10&&n.length<=15?n:null;
};
export function configuredWhatsApp(){
 // No hardcoded fallback or assumed business telephone number.
 return validWhatsApp(process.env.LITIX_BUNDLES_WHATSAPP_NUMBER||process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);
}
export const bundleWhatsappMessage=(pkg,orderId)=>
 "Hello LITIX! My order number is "+orderId+". Bundle: "+pkg.name+". Platform: "+pkg.platform+
 ". I would like to submit my payment receipt and up to 10 selected post links or screenshots for manual review. I will attach my receipt/screenshots and type my post links here. Payment is awaiting independent verification.";
export function validPost(value,platform){
 try{
  const u=new URL(String(value||"").trim());
  if(u.protocol!=="https:"||u.username||u.password)return false;
  const h=u.hostname.toLowerCase().replace(/^www\./,"");
  if(platform==="Instagram")return h==="instagram.com"&&/^\/(p|reel|tv)\/[\w-]+\/?$/.test(u.pathname);
  return h==="tiktok.com"&&/^\/@[\w.-]+\/video\/\d+\/?$/.test(u.pathname);
 }catch{return false}
}
export function allocationsValid(bundle,allocations){
 if(!bundle||!Array.isArray(allocations)||allocations.length<1||allocations.length>10)return false;
 const urls=new Set(),totals=Object.fromEntries(POST_BUNDLE_KINDS.map(k=>[k,0]));
 for(const post of allocations){
  if(!validPost(post.url,bundle.platform)||urls.has(post.url))return false;
  urls.add(post.url);
  if(Object.keys(post).some(k=>k!=="url" && !POST_BUNDLE_KINDS.includes(k)))return false;
  for(const k of POST_BUNDLE_KINDS){
   const n=post[k]??0;
   if(!Number.isSafeInteger(n)||n<0)return false;
   totals[k]+=n;
   if(totals[k]>bundle.items[k])return false;
  }
 }
 return true;
}
