import Link from "next/link";
import {LITIX_SOLUTIONS} from "../../lib/litixSolutions.mjs";
import "./solutions.css";

export const metadata={
 title:"Litix Solutions | Local Marketing, Creator Tools & Business Services",
 description:"Explore Litix growth solutions: local business marketing, creator tools, video production and more. Free tools are available now; service programs accept pilot inquiries.",
 alternates:{canonical:"https://www.litix.net/solutions"}
};
const featured=LITIX_SOLUTIONS.filter(s=>s.featured);
export default function LitixSolutions(){
 return <main className="ls-main">
  <nav className="ls-nav" aria-label="Litix Solutions navigation">
   <Link href="/" className="ls-brand"><img src="/assets/brand/litix-logo.webp" alt="Litix home" width="126" height="68"/></Link>
   <div><Link href="/shop">Shop</Link><Link href="/growth">Free calendar</Link><Link href="/partners">Partners</Link><Link href="/track">Orders</Link></div>
  </nav>
  <section className="ls-hero">
   <span className="ls-eyebrow">LITIX · INNOVATION, IGNITED</span>
   <h1>More ways to build your business.</h1>
   <p>Discover practical creator tools, small-business marketing ideas and new ways to collaborate. Our free tools are open now; new paid programs begin with a manual proposal, not an automatic charge.</p>
   <div className="ls-actions">
    <Link className="ls-cta" href="/tools/caption-builder">Try a free tool</Link>
    <Link className="ls-link" href="#solutions">Browse the solutions</Link>
   </div>
  </section>
  <section className="ls-section" aria-labelledby="featured-heading">
   <div className="ls-section-head"><span className="ls-eyebrow">FIRST PRIORITIES</span><h2 id="featured-heading">Where we're starting</h2></div>
   <div className="ls-featured">
    {featured.map(s=><article key={s.slug} className="ls-card ls-card-featured">
      <small>{s.group} · Pilot inquiry</small>
      <h3>{s.name}</h3><p>{s.headline}</p>
      <Link href={"/solutions/"+s.slug}>Explore {s.name}</Link>
    </article>)}
   </div>
  </section>
  <section className="ls-section" aria-labelledby="tools-heading">
   <div className="ls-section-head"><span className="ls-eyebrow">AVAILABLE NOW · NO PAYMENT</span><h2 id="tools-heading">Free Litix tools</h2></div>
   <div className="ls-toolgrid">
    <article className="ls-card"><h3>Litix Native Self-Service Studio</h3><p>Create and download original caption kits and custom link pages directly from Litix. Free preview, no outside fulfillment or payment.</p><Link href="/native">Open Litix Native</Link></article>
    <article className="ls-card"><h3>Caption & CTA Builder</h3><p>Make starter captions with different tones and clear calls to action. No login or model account required.</p><Link href="/tools/caption-builder">Create captions</Link></article>
    <article className="ls-card"><h3>Creator Link Page Maker</h3><p>Preview a simple branded link page and export your own HTML. Hosting is not included.</p><Link href="/tools/link-page-builder">Build a link page</Link></article>
    <article className="ls-card"><h3>Local Visibility Checklist</h3><p>Assess local search and marketing basics with a simple self-check. No external account required.</p><Link href="/tools/local-visibility">Run the checklist</Link></article>
    <article className="ls-card"><h3>Growth Calendar & TikTok Metrics</h3><p>Use Litix's existing content calendar and engagement calculator.</p><Link href="/growth">Open calendar</Link> <Link href="/tools/tiktok-engagement">TikTok calculator</Link></article>
   </div>
  </section>
  <section className="ls-section" id="solutions" aria-labelledby="all-heading">
   <div className="ls-section-head"><span className="ls-eyebrow">PARTNERSHIPS & SERVICE PILOTS</span><h2 id="all-heading">Explore every growth idea</h2><p>These proposed services are being evaluated individually. Application does not guarantee acceptance, fulfillment or a fixed price.</p></div>
   <div className="ls-grid">
    {LITIX_SOLUTIONS.map(s=><article className="ls-card" key={s.slug}>
      <small>{s.group} · Proposal stage</small>
      <h3>{s.name}</h3><p>{s.summary}</p>
      <span className="ls-model">{s.model}</span>
      <Link href={"/solutions/"+s.slug}>Details & inquiry</Link>
    </article>)}
   </div>
  </section>
  <section className="ls-panel">
   <h2>Already running an agency?</h2>
   <p>Existing Litix partner inquiries remain available. We don't activate commissions, reseller pricing, marketplace accounts or recurring payments before written agreement and technical verification.</p>
   <Link href="/partners">Apply for a Litix partnership</Link>
  </section>
  <footer className="ls-footer"><Link href="/">Litix</Link><Link href="/legal/privacy">Privacy</Link><Link href="/terms">Terms</Link></footer>
 </main>;
}
