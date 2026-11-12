import Link from "next/link";

export const metadata={
 title:"AutoLikes New Orders Paused | Litix",
 description:"Litix AutoLikes is not accepting new purchases. Existing customers retain private tracking access and can contact Litix Support.",
 robots:{index:false,follow:true},
 alternates:{canonical:"https://www.litix.net/autolikes"}
};

export default function AutoLikesPausedPage(){
 return <main className="wrap" style={{minHeight:"75vh"}}>
  <nav className="nav" aria-label="Litix navigation">
   <Link className="brand" href="/" aria-label="Litix home">
    <img src="/assets/brand/litix-logo.webp" alt="Litix" className="litix-new-logo"/>
   </Link>
   <div><Link href="/">Home</Link><Link href="/shop">Shop</Link><Link href="/track">Track Order</Link></div>
  </nav>
  <section className="panel" style={{maxWidth:850,margin:"36px auto",padding:"32px"}}>
   <div className="kicker">LITIX · SERVICE UPDATE</div>
   <h1>AutoLikes — New Orders Paused</h1>
   <p>We have paused all new AutoLikes purchases because automatic new-post detection and supplier fulfillment have not been independently verified for reliable resale. No payments can be started from this page.</p>
   <h2>Already purchased AutoLikes?</h2>
   <p>Your existing order, payment record, and private tracking access have <strong>not</strong> been deleted or canceled. Use the secure tracking link in your Litix order email to check its last recorded status. That status may not be a live supplier update.</p>
   <p>If your order was not fulfilled, contact Litix Support with your order number to request a status review and resolution, including refund review where appropriate. Do not submit another order.</p>
   <div style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:24}}>
    <Link className="primary" href="/">Return to Litix Home</Link>
    <a href="mailto:litixsocial@gmail.com?subject=Existing%20AutoLikes%20Order%20Review">Contact Litix Support</a>
   </div>
   <p className="small muted" style={{marginTop:24}}>Other Litix services remain available separately, subject to their own availability and checkout checks. We will only reopen new AutoLikes sales when an authorized post-detection and fulfillment solution is verified end to end.</p>
  </section>
 </main>;
}
