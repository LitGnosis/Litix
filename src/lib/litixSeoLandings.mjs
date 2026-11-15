const sharedFaq=(platform,service)=>[
 {
  question:"Do I have to provide my "+platform+" password?",
  answer:"No. Litix only requests an eligible public "+platform+" profile or post link, your requested quantity, and your checkout email. Never submit account passwords."
 },
 {
  question:"How will I know when my order has started?",
  answer:"Litix checks payment approval and current service eligibility, then submits eligible orders for fulfillment. Start times vary and are not guaranteed. Follow your private order-tracking link for recorded progress."
 },
 {
  question:"Can I review the price before paying?",
  answer:"Yes. Package cards may initially show an earlier retail estimate. The live supplier-supported price, quantity limits, and payment availability must be verified before any PayKings charge."
 },
 {
  question:"Where can I get order support?",
  answer:"Use your Litix order number and checkout email on the tracking page, or contact Litix support if the latest recorded status needs review."
 }
];
export const LITIX_SEO_LANDINGS=Object.freeze({
 "buy-instagram-followers":{
  slug:"buy-instagram-followers",sku:"curated_instagram_followers_standard",
  platform:"Instagram",kind:"Followers",
  title:"Buy Instagram Followers | Secure Checkout & Order Tracking | Litix",
  description:"Explore Instagram follower quantities and live-verified USD pricing with Litix. No social password required; PayKings checkout and private order tracking.",
  h1:"Buy Instagram Followers with Clear Pricing",
  intro:"Choose your Instagram follower quantity, enter a supported public profile link, and review the latest verified USD total before paying. Delivery start times and results depend on the available service.",
  summary:"One clearly selected follower package, public-profile validation, a secure payment flow, and order tracking in one place.",
  checklist:[
   ["Target","A supported public Instagram profile URL or username, not a post link"],
   ["Quantity","Six easy package options plus a custom amount within live limits"],
   ["Payment","Your final USD price is independently rechecked before PayKings authorization"],
   ["Updates","A private link displays recorded payment and delivery progress"]
  ],
  extraFaq:{
   question:"Should I paste an Instagram post link for Followers?",
   answer:"No. Followers use an eligible public Instagram profile. To order likes or views on a post, choose the corresponding post-based service."
  }
 },
 "buy-instagram-likes":{
  slug:"buy-instagram-likes",sku:"curated_instagram_likes_standard",
  platform:"Instagram",kind:"Likes",
  title:"Buy Instagram Likes for Posts & Reels | Litix",
  description:"Select a supported Instagram Likes quantity, verify your public post or reel link, review current pricing, and track your Litix purchase privately.",
  h1:"Buy Instagram Likes for Your Public Posts",
  intro:"Pick the number of Likes for an eligible Instagram post or reel, add its public URL, and confirm the live retail total. This is a post-specific service, not a profile-follower order.",
  summary:"A direct post or reel selection experience with a verified checkout and recorded delivery updates.",
  checklist:[
   ["Target","An eligible public Instagram post or reel URL"],
   ["Quantity","Clear package cards with limits confirmed against the selected service"],
   ["Payment","PayKings-hosted card inputs after current service and USD quote verification"],
   ["Updates","Private tracking for order submission and reported fulfillment"]
  ],
  extraFaq:{
   question:"Can Likes be applied to my Instagram profile instead of a post?",
   answer:"No. Likes require an eligible public post or reel link. For profile growth, select the separate Instagram Followers service."
  }
 },
 "buy-tiktok-followers":{
  slug:"buy-tiktok-followers",sku:"curated_tiktok_followers_standard",
  platform:"TikTok",kind:"Followers",
  title:"Buy TikTok Followers | Verify Price Before Paying | Litix",
  description:"Explore TikTok follower package sizes, current verified USD checkout prices and private delivery tracking. No TikTok password needed.",
  h1:"Buy TikTok Followers with an Easy Checkout",
  intro:"Choose a follower package for an eligible public TikTok profile, enter its link, then review the live quote and PayKings payment details. Current service availability controls what can be ordered.",
  summary:"A focused TikTok follower checkout with profile-specific link checks and a clear private order status page.",
  checklist:[
   ["Target","An eligible public TikTok profile or username"],
   ["Quantity","Choose 100 to 5,000 where the live supplier's limits permit"],
   ["Payment","A supplier-verified retail quote before payment authorization"],
   ["Updates","Check order submission and remaining delivery through private tracking"]
  ],
  extraFaq:{
   question:"Will every TikTok follower quantity always be available?",
   answer:"No. Supplier minimums, maximums and availability can change. Disabled options cannot be purchased, and Litix checks live eligibility before payment."
  }
 },
 "buy-tiktok-likes":{
  slug:"buy-tiktok-likes",sku:"curated_tiktok_likes_standard",
  platform:"TikTok",kind:"Likes",
  title:"Buy TikTok Likes for Videos | Litix Checkout & Tracking",
  description:"Choose TikTok video Likes with a verified public video link, supported quantity, current USD quote, secure PayKings fields and private tracking.",
  h1:"Buy TikTok Likes for a Public Video",
  intro:"Choose a TikTok Likes quantity, add the eligible video link, and review the actual checkout price. Litix validates supported video destinations and separately confirms payment and order status.",
  summary:"A TikTok video-focused checkout with supported link formats and transparent order updates.",
  checklist:[
   ["Target","A supported public TikTok video link; eligible short share links are verified"],
   ["Quantity","Six visual package choices, subject to live minimum and maximum limits"],
   ["Payment","Current quote verification before PayKings card authorization"],
   ["Updates","Recorded supplier status in your private Litix tracking page"]
  ],
  extraFaq:{
   question:"Can I paste a short TikTok share link?",
   answer:"Litix supports certain official TikTok short share links. It must resolve to an eligible public video before checkout; an unsupported or unresolved link will not be charged."
  }
 }
});
export function seoLanding(slug){
 const data=LITIX_SEO_LANDINGS[slug];
 if(!data)throw Error("Unsupported Litix SEO landing page");
 return {
  ...data,
  faq:[...sharedFaq(data.platform,data.kind.toLowerCase()),data.extraFaq]
 };
}
export function seoLandingMetadata(slug){
 const page=seoLanding(slug),canonical="https://www.litix.net/"+page.slug;
 return {
  title:page.title,
  description:page.description,
  alternates:{canonical},
  robots:{index:true,follow:true},
  openGraph:{title:page.title,description:page.description,url:canonical,
   type:"website",siteName:"Litix"},
  twitter:{card:"summary",title:page.title,description:page.description}
 };
}
