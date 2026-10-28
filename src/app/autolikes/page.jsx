export const metadata = {
  title: "AutoLikes Checkout — Coming Soon | Litix",
  description: "AutoLikes subscriptions are coming soon. Existing Litix one-time services and secure checkout remain available.",
};

export default function AutoLikesComingSoonPage() {
  return (
    <main className="wrap">
      <nav className="nav" aria-label="Main navigation">
        <a className="brand" href="/" aria-label="Return to Litix home">
          <img src="/assets/brand/litix-logo.webp" alt="Litix" className="litix-new-logo" />
        </a>
        <div><a href="/">Home</a><a href="/#services">Services</a><a href="/track">Track Order</a></div>
      </nav>
      <section
        className="panel"
        aria-labelledby="autolikes-coming-soon-heading"
        style={{maxWidth:720,margin:"clamp(42px, 8vw, 90px) auto",padding:"clamp(24px, 5vw, 44px)"}}
      >
        <div className="kicker">LITIX AUTOLIKES</div>
        <h1 id="autolikes-coming-soon-heading" style={{fontSize:"clamp(32px, 5vw, 48px)",margin:"16px 0 10px",lineHeight:1.15}}>
          AutoLikes Checkout
        </h1>
        <p role="status" style={{display:"inline-block",padding:"9px 16px",margin:"9px 0 18px",border:"1px solid #7bd7ff",borderRadius:999,color:"#bfeaff",fontWeight:800,letterSpacing:".12em"}}>
          COMING SOON
        </p>
        <p style={{color:"#c9def2",fontSize:17,lineHeight:1.7,margin:"12px 0"}}>
          We're getting automatic likes and monthly AutoLikes subscriptions ready.
          Subscription checkout is not available yet while we finish secure billing
          and automatic new-post processing.
        </p>
        <p className="checkout-hint" style={{fontSize:14,marginTop:12}}>
          No AutoLikes payment can be submitted on this page. Our existing one-time
          services and order tracking are still available as usual.
        </p>
        <a href="/#services" className="pay" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",textDecoration:"none",marginTop:16,minHeight:48}}>
          Shop available Litix services
        </a>
      </section>
    </main>
  );
}
