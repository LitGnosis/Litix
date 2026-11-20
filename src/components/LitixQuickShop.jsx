"use client";
import LitixVerifiedActivity from "./LitixVerifiedActivity";
export default function LitixQuickShop(){
 const curated=process.env.NEXT_PUBLIC_LITIX_CURATED_STOREFRONT_ENABLED==="true";
 return <section className="panel litix-hero-shop litix-ignited-hero" aria-labelledby="litix-quick-shop-title">
  <div className="litix-hero-topline"><span className="kicker">LITIX — INNOVATION, IGNITED.</span><span className="litix-live-label">DIGITAL GROWTH PLATFORM</span></div>
  <p className="litix-brand-promise">Your Brand. Your Audience. Your Next Level.</p>
  <h1 id="litix-quick-shop-title">Level Up Your <span>Social Media</span> with Litix.</h1>
  <p className="litix-hero-subtitle">
   {curated?"Start with Instagram or TikTok, or explore all five platforms in our catalog.":"Choose Instagram, TikTok, YouTube, Facebook or X to get started."}
   {" "}Choose your service, review transparent USD pricing, and complete your order securely.
  </p>
  <div className="litix-hero-actions"><a className="litix-hero-cta" href="#checkout">Explore services &amp; pricing <span aria-hidden="true">↗</span></a><a className="litix-hero-secondary" href="#tracking">Track an order</a></div>
  <div className="litix-ignited-trust" aria-label="Security and verification information">
   <span>Secure PayKings Checkout</span><span>No Passwords Required</span>
   <span>Live Service Verification at Checkout</span><span>Private Order Tracking</span>
  </div>
  <LitixVerifiedActivity/>
 </section>;
}
