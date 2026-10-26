// Exact fixed-price Instagram/TikTok Growth Bundles. Do not apply general service markup.
export const BUNDLE_INSTRUCTIONS="IMPORTANT: All Growth Bundle orders require WhatsApp confirmation. After purchasing, contact LITIX through WhatsApp and submit links or screenshots for up to 10 posts. Your package quantities are distributed across your selected posts and are not repeated for each post. LITIX manually verifies your selected posts and service allocation before processing your order.";
// Owner's October 26 update: 20% off the previous four prices.
// Followers are delivered to the purchased account/profile, not to individual posts.
const levels=[
 ["launch","Launch",3588,[25000,100000,1000,5000]],
 ["momentum","Momentum",7188,[50000,250000,2500,10000]],
 ["power","Power",13188,[100000,500000,5000,20000]],
 ["apex","Apex",23988,[250000,1000000,10000,50000]],
];
export const BUNDLE_KINDS=["Likes","Views","Shares","Followers"];
export const POST_BUNDLE_KINDS=["Likes","Views","Shares"];
export const GROWTH_BUNDLES=["Instagram","TikTok"].flatMap(platform=>
 levels.map(([slug,tier,priceCents,counts])=>Object.freeze({
  id:(platform==="Instagram"?"ig":"tt")+"_"+slug,
  name:platform+" "+tier+" Growth Bundle",platform,tier,priceCents,
  items:Object.freeze(Object.fromEntries(BUNDLE_KINDS.map((k,i)=>[k,counts[i]]))),
  maxPosts:10, manualApprovalRequired:true, refillPolicy:"Supplier dependent; no guaranteed refill",
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
 "Hello LITIX! I purchased the "+pkg.name+" for "+pkg.platform+
 ". My order number is "+orderId+
 ". I would like to submit my posts for manual fulfillment. I understand that I can submit up to 10 posts.";
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
