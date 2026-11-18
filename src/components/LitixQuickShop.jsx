"use client";
import LitixVerifiedActivity from "./LitixVerifiedActivity";

export default function LitixQuickShop(){
 const curated=process.env.NEXT_PUBLIC_LITIX_CURATED_STOREFRONT_ENABLED==="true";
 return <section className="panel litix-hero-shop" aria-labelledby="litix-quick-shop-title">
  <div className="litix-hero-topline">
   <span className="kicker">LITIX · GROW YOUR REACH</span>
   <span className="litix-live-label">CREATOR CHECKOUT</span>
  </div>
  <h1 id="litix-quick-shop-title">Social Growth for Creators, Brands & Agencies</h1>
  <p className="litix-hero-subtitle">
   {curated?"Choose Instagram or TikTok, pick your service, and see package pricing instantly.":"Find the right Instagram, TikTok, YouTube, Facebook or X service."}
   {" "}Paste your public link and review the USD total before secure checkout.
  </p>
  <p className="litix-hero-proof" aria-label="Checkout trust information">
   <span aria-hidden="true">✓</span>
   <strong>For creators &amp; agencies</strong>
   <span className="litix-proof-separator" aria-hidden="true">·</span>
   Secure checkout · Private order tracking
  </p>
  <LitixVerifiedActivity/>
  <div className="litix-hero-steps" aria-label="Three steps to checkout">
   <span><b>01</b> Choose your package</span>
   <span><b>02</b> Paste a public link</span>
   <span><b>03</b> Review secure checkout</span>
  </div>
 </section>;
}
