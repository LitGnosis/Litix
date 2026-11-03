export const metadata = {
  title: "Custom Likes | Instagram & TikTok | Litix",
  description: "Choose 1–5 public Instagram posts or TikTok videos, allocate likes per post, and review one secure Litix checkout."
};

const choices = [
  {platform:"Instagram",serviceId:"litix_4751",label:"Instagram Custom Likes",
   description:"Select public Instagram posts or Reels. Choose a different quantity of likes for each post."},
  {platform:"TikTok",serviceId:"litix_5251",label:"TikTok Custom Likes",
   description:"Select public TikTok videos, including verified share links. Allocate likes across multiple videos."}
];

export default function CustomLikesPage() {
  return <main className="wrap">
    <nav className="nav" aria-label="Litix Custom Likes navigation">
      <a href="/" className="brand" aria-label="Litix home">
        <img src="/assets/brand/litix-logo.webp" className="litix-new-logo" alt="Litix — Innovation, Ignited." />
      </a>
      <div>
        <a href="/">Home</a>
        <a href="/custom-orders">Custom Orders</a>
        <a href="/services">All Litix Services</a>
        <a href="/track">Track Order</a>
      </div>
    </nav>
    <section className="panel" aria-labelledby="litix-custom-likes-title">
      <div className="kicker">LITIX · YOUR POSTS · YOUR QUANTITIES</div>
      <h1 id="litix-custom-likes-title">Custom Likes — Choose Your Posts</h1>
      <p>One checkout for up to five public posts. Select your platform, choose posts from your public gallery when available, or paste direct post links. Set the likes for each post separately and review the total before paying.</p>
      <div className="cols" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,280px),1fr))",gap:16,alignItems:"stretch"}}>
        {choices.map(choice=><article className="panel" key={choice.serviceId} style={{display:"flex",flexDirection:"column",gap:12,margin:0}}>
          <div className="kicker">{choice.platform.toUpperCase()}</div>
          <h2 style={{margin:0}}>{choice.label}</h2>
          <p style={{flex:1}}>{choice.description}</p>
          <a className="primary" style={{display:"inline-flex",justifyContent:"center",alignItems:"center",textAlign:"center",textDecoration:"none",padding:"14px 18px"}}
            href={"/?service="+encodeURIComponent(choice.serviceId)+"&mode=multi#checkout"}>
            Choose Your Posts
          </a>
        </article>)}
      </div>
      <div style={{marginTop:24}}>
        <h2>How it works</h2>
        <ol>
          <li>Choose Instagram or TikTok.</li>
          <li>Pick up to five public posts and verify the links. If the gallery is unavailable, paste links manually.</li>
          <li>Set each post's quantity, enter your email, then review your complete PayKings price and pay once.</li>
          <li>Use the private order tracking link after checkout. Do not pay again to retry an existing order.</li>
        </ol>
        <p className="small muted">Services and gallery availability depend on live verification. Each post must meet the selected service's minimum quantity and price. An unavailable service cannot be charged. Litix will not submit duplicate supplier purchases for an existing order.</p>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
        <a className="alt" href="/custom-orders">See all Custom Orders</a>
        <a className="alt" href="/track">Check an existing order</a>
      </div>
    </section>
  </main>;
}
