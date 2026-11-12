export const metadata={
 title:"Shop Litix Original Digital Marketing Products",
 description:"Shop original Litix marketing drafts and use first-party digital campaign tools.",
 alternates:{canonical:"https://www.litix.net/shop"}
};
const card={background:"#0a213b",border:"1px solid #41698f",borderRadius:16,padding:24};
export default function Shop(){
 return <main className="wrap">
  <nav className="nav" aria-label="Litix shop"><a className="brand" href="/"><img src="/assets/brand/litix-logo.webp" className="litix-new-logo" alt="Litix"/></a><div><a href="/">Home</a><a href="/ai-content-studio">AI Studio</a><a href="/wholesale">Wholesale</a><a href="/agency">Agencies</a><a href="/track">Track Order</a></div></nav>
  <section className="panel" style={{marginTop:22}}><p className="kicker">LITIX DIRECT SHOP</p><h1>Digital marketing tools made by Litix</h1><p>Live TikTok Followers purchase where available, one-time digital marketing content, and free creative workspaces.</p></section>
  <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,290px),1fr))",gap:18,margin:"24px 0"}}>
   <article style={card}><p className="kicker">LIVE FOLLOWER CHECKOUT</p><h2>TikTok Followers</h2><p>Buy an approved follower package with current pricing and supplier-capacity checks before real PayKings payment. Private order tracking included.</p><a className="primary" href="/followers" style={{display:"inline-block",padding:"12px 20px",textDecoration:"none",borderRadius:12}}>Buy TikTok Followers</a></article>
   <article style={card}><p className="kicker">SECURE PAYKINGS CHECKOUT</p><h2>12 Original Marketing Drafts</h2><p style={{fontSize:34,fontWeight:800}}>$1.00</p><p>One-time digital marketing package. Live card payment uses hosted PayKings fields; settlement and delivery status are tracked independently.</p><a className="primary" style={{display:"inline-block",padding:"12px 20px",textDecoration:"none",borderRadius:12}} href="/shop/marketing-drafts">Buy Marketing Drafts</a></article>
   <article style={card}><p className="kicker">NO CARD REQUIRED</p><h2>Creative Kit</h2><p style={{fontSize:34,fontWeight:800}}>Free</p><p>Generate 12 original, editable campaign drafts with the Litix first-party engine.</p><a href="/direct-services">Open Creative Kit</a></article>
   <article style={card}><p className="kicker">NO CARD REQUIRED</p><h2>AI Content Studio</h2><p style={{fontSize:34,fontWeight:800}}>Free</p><p>Create marketing briefs and production prompts using the original Litix creative engine.</p><a href="/ai-content-studio">Open AI Content Studio</a></article>
  </section>
  <section className="panel"><h2>Need an agency or wholesale campaign blueprint?</h2><p>Explore planning tools and request a custom proposal. No unverified recurring billing is offered.</p><p><a href="/agency">Agency Blueprint</a> · <a href="/wholesale">Wholesale Blueprint</a></p></section>
 </main>;
}
