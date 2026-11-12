export const metadata={
 title:"Litix | First-Party Digital Marketing Products",
 description:"Original Litix marketing drafts, a free creative kit, AI campaign planning and agency/wholesale blueprint tools.",
 alternates:{canonical:"https://www.litix.net/"}
};
const button={display:"inline-block",padding:"12px 20px",borderRadius:12,textDecoration:"none",background:"#2873be",color:"#fff",fontWeight:700};
const secondary={...button,background:"#133a63",border:"1px solid #6fb7ea"};
const tile={border:"1px solid #355d83",borderRadius:18,padding:"24px",background:"linear-gradient(145deg,#0a1a30,#102c4b)",height:"100%"};
export default function LitixHome(){
 return <main className="wrap" style={{minHeight:"100vh",color:"#e9f3ff"}}>
  <nav className="nav" aria-label="Litix navigation">
   <a className="brand" href="/" aria-label="Litix home"><img src="/assets/brand/litix-logo.webp" className="litix-new-logo" alt="Litix — Innovation, Ignited."/></a>
   <div><a href="/shop">Shop</a><a href="/followers">Buy Followers</a><a href="/ai-content-studio">AI Content Studio</a><a href="/wholesale">Wholesale</a><a href="/agency">Agencies</a><a href="/track">Track Order</a></div>
  </nav>
  <section className="panel" style={{background:"linear-gradient(130deg,#071a32,#113e67)",border:"1px solid #5286b4",padding:"clamp(24px,5vw,54px)",marginTop:22}}>
   <p className="kicker">LITIX DIRECT · DIGITAL MARKETING</p>
   <h1 style={{fontSize:"clamp(34px,7vw,60px)",lineHeight:1.08,margin:"14px 0"}}>Original content and social growth services at Litix.</h1>
   <p style={{fontSize:19,maxWidth:780,lineHeight:1.6,color:"#bdd7ee"}}>Shop currently verified follower services or build original campaign content with Litix-owned tools. Live follower availability and prices are checked before payment.</p>
   <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:24}}>
    <a href="/shop/marketing-drafts" style={button}>Buy 12 Marketing Drafts · $1.00</a>
    <a href="/direct-services" style={secondary}>Try the free Creative Kit</a>
   </div>
  </section>
  <section className="panel" aria-labelledby="available-products" style={{marginTop:26}}>
   <p className="kicker">LITIX-OWNED PRODUCTS</p>
   <h2 id="available-products">Choose a creative product</h2>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,280px),1fr))",gap:16,marginTop:20}}>
    <article style={tile}>
     <p className="kicker">LIVE FOLLOWER PURCHASE</p>
     <h3>TikTok Followers</h3>
     <p>Buy an eligible TikTok follower package. PayKings card checkout is enabled only when the supplier's current service, price, and funding checks pass. Track the real order status privately.</p>
     <p>Delivery may take time; a successful payment is not a guarantee of immediate follower arrival.</p>
     <a href="/followers" style={button}>Buy TikTok Followers</a>
    </article>
    <article style={tile}>
     <p className="kicker">ONE-TIME PURCHASE</p>
     <h3>Original Marketing Drafts</h3>
     <p style={{fontSize:32,fontWeight:800,margin:"10px 0"}}>$1.00</p>
     <p>12 editable marketing drafts. Pay securely using PayKings-hosted fields. Track approval, settlement and digital delivery on your private order page.</p>
     <p style={{fontSize:13,color:"#bad0e4"}}>A card approval is not proof that delivery is complete. Fulfillment is tracked separately.</p>
     <a href="/shop/marketing-drafts" style={button}>View secure checkout</a>
    </article>
    <article style={tile}>
     <p className="kicker">FIRST-PARTY · FREE</p>
     <h3>Creative Kit</h3>
     <p style={{fontSize:32,fontWeight:800,margin:"10px 0"}}>$0</p>
     <p>Generate 12 editable campaign drafts from your own brief, directly with Litix software. No card or third-party supplier required.</p>
     <a href="/direct-services" style={secondary}>Generate free drafts</a>
    </article>
    <article style={tile}>
     <p className="kicker">CREATIVE WORKSPACE · FREE</p>
     <h3>AI Content Studio</h3>
     <p style={{fontSize:32,fontWeight:800,margin:"10px 0"}}>$0</p>
     <p>Build campaign-ready briefs, creative directions and editing prompts. Optional external media tools are separate from the Litix draft generator.</p>
     <a href="/ai-content-studio" style={secondary}>Open content studio</a>
    </article>
   </div>
  </section>
  <section className="panel" style={{marginTop:24}}>
   <p className="kicker">BUSINESS / AGENCY PLANNING</p>
   <h2>Wholesale and agency campaign blueprints</h2>
   <p>Use our campaign-planning tools to create a blueprint for your organization, then contact Litix for separately scoped agency or wholesale work. No recurring subscription is started from these pages.</p>
   <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:20}}>
    <a href="/wholesale" style={secondary}>Wholesale planning</a>
    <a href="/agency" style={secondary}>Agency planning</a>
   </div>
  </section>
  <section className="panel" style={{marginTop:24}}>
   <h2>Already placed an order?</h2>
   <p>Your earlier orders and private tracking records remain available. Keep your complete tracking link private.</p>
   <p><a href="/track">Track an existing order</a> · <a href="mailto:Litixsocial@gmail.com?subject=Litix%20Order%20Support">Email Litix Support</a></p>
  </section>
  <footer style={{padding:"36px 8px 54px",color:"#afc9df"}}>
   LITIX · Innovation, Ignited. · <a href="/terms">Terms</a> · <a href="/legal/privacy">Privacy</a> · <a href="/refunds">Refunds</a>
  </footer>
 </main>;
}
