// Exact fixed-price Instagram/TikTok Growth Bundles. Do not apply general service markup.
export const BUNDLE_INSTRUCTIONS="IMPORTANT: All Growth Bundle orders require WhatsApp confirmation. After purchasing, contact LITIX through WhatsApp and submit links or screenshots for up to 10 posts. Your package quantities are distributed across your selected posts and are not repeated for each post. LITIX manually verifies your selected posts and service allocation before processing your order.";
const levels=[
 ["launch","Launch",4485,[25000,100000,10000,1000,1000,100]],
 ["momentum","Momentum",8985,[50000,250000,25000,2500,2500,250]],
 ["power","Power",16485,[100000,500000,50000,5000,5000,500]],
 ["apex","Apex",29985,[250000,1000000,100000,10000,10000,1000]],
];
export const BUNDLE_KINDS=["Likes","Views","Impressions","Shares","Saves","Reposts"];
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
 const urls=new Set(),totals=Object.fromEntries(BUNDLE_KINDS.map(k=>[k,0]));
 for(const post of allocations){
  if(!validPost(post.url,bundle.platform)||urls.has(post.url))return false;
  urls.add(post.url);
  for(const k of BUNDLE_KINDS){
   const n=post[k]??0;
   if(!Number.isSafeInteger(n)||n<0)return false;
   totals[k]+=n;
   if(totals[k]>bundle.items[k])return false;
  }
 }
 return true;
}
