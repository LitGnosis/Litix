"use client";
import {useEffect,useState} from "react";

// IDs are approved in the Litix supplier allowlist. Actual checkout verifies
// real-time eligibility, quantity and pricing before charging a customer.
export const CUSTOM_PRODUCTS=Object.freeze([
 {platform:"Instagram",kind:"likes",id:"litix_4751",title:"Instagram Custom Likes",
  blurb:"Choose up to five public posts or Reels. Set a separate likes quantity for each post.",
  button:"Choose Instagram Posts",detail:"Multiple posts · one payment · private order tracking"},
 {platform:"Instagram",kind:"followers",id:"litix_5461",title:"Instagram Custom Followers",
  blurb:"Choose your follower quantity and enter the public profile at secure checkout.",
  button:"Customize Instagram Followers",detail:"Public profile · adjustable quantity · no password"},
 {platform:"TikTok",kind:"likes",id:"litix_5251",title:"TikTok Custom Likes",
  blurb:"Choose up to five public videos. Paste direct or verified TikTok share links.",
  button:"Choose TikTok Videos",detail:"Multiple videos · one payment · private order tracking"},
 {platform:"TikTok",kind:"followers",id:"litix_5101",title:"TikTok Custom Followers",
  blurb:"Set your follower quantity and enter your public TikTok profile at secure checkout.",
  button:"Customize TikTok Followers",detail:"Public profile · adjustable quantity · no password"}
]);

export function customProductLink(product){
 return "/?service="+encodeURIComponent(product.id)+(product.kind==="likes"?"&mode=multi":"")+"#checkout";
}
export default function LitixCustomHub(){
 const [platform,setPlatform]=useState("Instagram");
 const [kind,setKind]=useState("likes");
 useEffect(()=>{
  const p=new URLSearchParams(window.location.search);
  if(p.get("platform")==="tiktok")setPlatform("TikTok");
  if(p.get("kind")==="followers")setKind("followers");
 },[]);
 const selected=CUSTOM_PRODUCTS.find(p=>p.platform===platform&&p.kind===kind);
 return <div className="litix-custom-hub">
   <div className="litix-custom-intro">
     <span className="kicker">CUSTOMIZE IN SECONDS</span>
     <h1>Custom Likes &amp; Followers</h1>
     <p>Choose a platform, pick Likes or Followers, and set your quantity. Litix handles the rest through the existing secure checkout.</p>
   </div>
   <div className="litix-choice-panel" role="group" aria-label="Customize your Litix order">
     <div className="litix-choice-row">
       <strong>01 · Platform</strong>
       <div className="litix-segments" role="group" aria-label="Platform">
         {["Instagram","TikTok"].map(value=><button key={value} type="button"
           className={platform===value?"active":""} aria-pressed={platform===value}
           onClick={()=>setPlatform(value)}>{value}</button>)}
       </div>
     </div>
     <div className="litix-choice-row">
       <strong>02 · What do you want?</strong>
       <div className="litix-segments" role="group" aria-label="Service type">
         {[["likes","Likes"],["followers","Followers"]].map(([value,label])=><button key={value}
           type="button" className={kind===value?"active":""} aria-pressed={kind===value}
           onClick={()=>setKind(value)}>{label}</button>)}
       </div>
     </div>
   </div>
   <article className="litix-custom-result" aria-live="polite">
     <div className="litix-custom-result-top">
       <span className="kicker">{selected.platform.toUpperCase()} / {selected.kind.toUpperCase()}</span>
       <span className="litix-result-status">Verified service selection</span>
     </div>
     <h2>{selected.title}</h2>
     <p>{selected.blurb}</p>
     <p className="litix-custom-facts">{selected.detail}</p>
     <a className="litix-metal-cta" href={customProductLink(selected)}>{selected.button} <span aria-hidden="true">›</span></a>
     <p className="litix-custom-fine">Final USD pricing and supplier availability are checked before payment. No order is placed by selecting a service.</p>
   </article>
   <div className="litix-custom-support-links">
     <a href="/shop">Explore more services</a>
     <a href="/bundles">View Growth Bundles</a>
     <a href="/track">Track an order</a>
   </div>
   <details className="litix-compact-details">
     <summary>How do custom orders work?</summary>
     <ol>
       <li>Choose Instagram or TikTok and select Likes or Followers.</li>
       <li>For Likes, choose public posts or videos and set a quantity for each. For Followers, select a quantity for one public profile.</li>
       <li>Review your total and pay once using Litix secure PayKings checkout.</li>
       <li>Keep the private tracking link; do not place a duplicate order to retry delivery.</li>
     </ol>
     <p>Multi-post automation depends on verified supplier compatibility; orders requiring review will be identified rather than silently repurchased.</p>
   </details>
 </div>;
}
