// Discovery only. Routes reuse the existing live catalog and checkout gates.
// Do not show invented delivery times, supplier guarantees or stale price quotes.
const categories = [
  { label: "Instagram Followers", href: "/shop/instagram/followers", group: "Instagram" },
  { label: "Instagram Likes", href: "/shop/instagram/likes", group: "Instagram" },
  { label: "Instagram Views", href: "/shop/instagram/views", group: "Instagram" },
  { label: "TikTok Followers", href: "/shop/tiktok/followers", group: "TikTok" },
  { label: "TikTok Likes", href: "/shop/tiktok/likes", group: "TikTok" },
  { label: "TikTok Views", href: "/shop/tiktok/views", group: "TikTok" },
  { label: "YouTube Subscribers", href: "/shop/youtube/subscribers", group: "YouTube" },
  { label: "YouTube Likes & Views", href: "/shop/youtube/likes", group: "YouTube" },
  { label: "X Likes & Retweets", href: "/shop/x/likes", group: "X" }
];

export default function LitixQuickShop() {
  return <section className="panel" aria-labelledby="litix-quick-shop-title">
    <div className="kicker">LITIX · QUICK SHOP</div>
    <h1 id="litix-quick-shop-title">Choose your platform. Pick your service.</h1>
    <p>Find the right package in seconds. See prices and quantity limits before payment, with final availability checked at checkout.</p>
    <nav aria-label="Quick shop social media services" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,220px),1fr))",gap:12,margin:"18px 0"}}>
      {categories.map(item=><a key={item.href} className="alt" href={item.href}
        style={{display:"flex",justifyContent:"space-between",alignItems:"center",minHeight:52,padding:"12px 14px",textDecoration:"none",borderRadius:12}}>
        <span>{item.label}</span><span aria-hidden="true">›</span>
      </a>)}
    </nav>
    <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
      <a className="primary" href="/custom-likes" style={{display:"inline-flex",alignItems:"center",padding:"12px 18px",textDecoration:"none"}}>Custom Likes — Choose Your Posts</a>
      <a className="alt" href="/services" style={{display:"inline-flex",alignItems:"center",padding:"12px 18px",textDecoration:"none"}}>Browse Every Litix Service</a>
      <a className="alt" href="/track" style={{display:"inline-flex",alignItems:"center",padding:"12px 18px",textDecoration:"none"}}>Track an Existing Order</a>
    </div>
    <p className="small muted" style={{marginTop:12}}>No password required. Supported services depend on live supplier verification; no purchase is made by browsing.</p>
  </section>;
}
