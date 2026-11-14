"use client";

export default function LitixQuickShop(){
 return <section className="panel litix-hero-shop" aria-labelledby="litix-quick-shop-title">
  <div className="litix-hero-topline">
   <span className="kicker">LITIX · INNOVATION, IGNITED.</span>
   <span className="litix-live-label">DIRECT SERVICE CHECKOUT</span>
  </div>
  <h1 id="litix-quick-shop-title">Choose a service. See your price. Check out securely.</h1>
  <p className="litix-hero-subtitle">
   Pick Instagram, TikTok, YouTube, Facebook or X in the Fast Checkout below.
   Select a verified package, paste your public link and review the USD total before paying.
  </p>
  <p className="litix-hero-proof" aria-label="Checkout trust information">
   <span aria-hidden="true">✓</span>
   <strong>For creators &amp; agencies</strong>
   <span className="litix-proof-separator" aria-hidden="true">·</span>
   No social passwords required
   <span className="litix-proof-separator" aria-hidden="true">·</span>
   PayKings-hosted card fields
  </p>
  <div className="litix-hero-steps" aria-label="Three steps to checkout">
   <span><b>01</b> Choose your package</span>
   <span><b>02</b> Paste a public link</span>
   <span><b>03</b> Review secure checkout</span>
  </div>
  <p className="litix-hero-footnote">
   The final price and service availability are independently verified before payment.
  </p>
 </section>;
}
