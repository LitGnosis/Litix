"use client";
import {useState} from "react";

// Navigation only. We never manufacture prices, timing or supplier guarantees.
const categories = [
  { label: "Instagram Followers", href: "/shop/instagram/followers", group: "Instagram",kind:"Followers" },
  { label: "Instagram Likes", href: "/shop/instagram/likes", group: "Instagram",kind:"Likes" },
  { label: "Instagram Views", href: "/shop/instagram/views", group: "Instagram",kind:"Views" },
  { label: "TikTok Followers", href: "/shop/tiktok/followers", group: "TikTok",kind:"Followers" },
  { label: "TikTok Likes", href: "/shop/tiktok/likes", group: "TikTok",kind:"Likes" },
  { label: "TikTok Views", href: "/shop/tiktok/views", group: "TikTok",kind:"Views" },
  { label: "YouTube Subscribers", href: "/shop/youtube/subscribers", group: "YouTube",kind:"Subscribers" },
  { label: "YouTube Likes & Views", href: "/shop/youtube/likes", group: "YouTube",kind:"Likes & Views" },
  { label: "X Likes & Retweets", href: "/shop/x/likes", group: "X",kind:"Likes & Retweets" },
  { label: "Facebook Followers", href: "/shop/facebook/followers", group:"Facebook",kind:"Followers" },
  { label: "Facebook Likes", href: "/shop/facebook/likes", group:"Facebook",kind:"Likes" },
  { label: "Facebook Views", href: "/shop/facebook/views", group:"Facebook",kind:"Views" }
];
const platforms=["Instagram","TikTok","YouTube","Facebook","X"];
export default function LitixQuickShop(){
 const [platform,setPlatform]=useState("Instagram");
 const choices=categories.filter(item=>item.group===platform);
 return <section className="panel litix-hero-shop" aria-labelledby="litix-quick-shop-title">
  <div className="litix-hero-topline"><span className="kicker">LITIX · INNOVATION, IGNITED.</span><span className="litix-live-label">BLUE METALLIC EXPERIENCE</span></div>
  <h1 id="litix-quick-shop-title">Choose your platform.<br/>Get to checkout faster.</h1>
  <p className="litix-hero-subtitle">Followers, Likes, Views and more—find a verified Litix service, customize your quantity, and review the price before you pay.</p>
  <div className="litix-hero-steps" aria-label="Three easy steps">
   <span><b>01</b> Pick a service</span><span><b>02</b> Paste a public link</span><span><b>03</b> Check out securely</span>
  </div>
  <div className="litix-platform-tabs" role="group" aria-label="Select a social platform">
   {platforms.map(value=><button key={value} type="button" className={platform===value?"selected":""}
    aria-pressed={platform===value} onClick={()=>setPlatform(value)}>{value}</button>)}
  </div>
  <nav className="litix-platform-choices" aria-label={platform+" shopping categories"}>
   {choices.map(item=><a key={item.href} href={item.href} className="litix-choice-link">
    <span>{item.kind}</span><span aria-hidden="true">›</span></a>)}
  </nav>
  <div className="litix-shop-actions">
   <a className="litix-metal-cta" href="#checkout">Shop a Single Service <span aria-hidden="true">›</span></a>
  </div>
  <p className="litix-hero-footnote">Public links only · No social password required · Every order receives an independent price and availability check before payment.</p>
 </section>;
}
