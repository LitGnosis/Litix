import Link from "next/link";
import PartnerApplication from "../../components/PartnerApplication";
import "../solutions/solutions.css";
import "../partners/partners.css";

export const metadata={
 title:"Litix Native Wholesale | Agency & Reseller Partnerships",
 description:"Apply to work with Litix Native, a first-party creator-tool supplier. Explore original digital assets and request reviewed agency wholesale access. No active paid API until approved.",
 alternates:{canonical:"https://www.litix.net/wholesale"}
};
export default function LitixWholesalePage(){
 return <main className="ls-main">
  <nav className="ls-nav" aria-label="Litix wholesale navigation">
   <Link href="/" className="ls-brand">LITIX</Link>
   <div><Link href="/native">Native tools</Link><Link href="/shop">Shop</Link><Link href="/partners">Partners</Link></div>
  </nav>
  <section className="ls-hero ls-detail-hero">
   <span className="ls-eyebrow">LITIX NATIVE · B2B WHOLESALE</span>
   <h1>Build with a first-party digital service supplier.</h1>
   <p>Litix creates its own original content tools, campaign planning kits, and branded link-page exports. Agencies can request a partnership review for future wholesale digital services.</p>
   <div className="ls-actions">
    <Link className="ls-cta" href="#apply">Request agency review</Link>
    <Link className="ls-link" href="/native">Test free Litix-owned tools</Link>
   </div>
  </section>
  <section className="ls-section">
   <div className="ls-section-head"><span className="ls-eyebrow">OUR CURRENT CAPABILITIES</span><h2>Original assets Litix can actually produce</h2></div>
   <div className="ls-grid">
    <article className="ls-card"><h3>Caption kits</h3><p>Human-editable original draft captions based on a creator or business brief.</p></article>
    <article className="ls-card"><h3>Branded link pages</h3><p>Exportable standalone HTML pages for licensed business and creator links.</p></article>
    <article className="ls-card"><h3>Campaign planning</h3><p>Original seven-day content plans with optional tagged links. A distinct 30-day premium kit is being prepared for paid fulfillment.</p></article>
   </div>
  </section>
  <section className="ls-panel">
   <h2>How agency access works</h2>
   <ol className="ls-list">
    <li>Submit your business and expected service needs through the application below.</li>
    <li>Litix reviews business identity, service fit, permissions, and the proposed client use.</li>
    <li>After operational approval, Litix can provision scoped API credentials and a written wholesale agreement for specific genuinely deliverable products.</li>
    <li>Prices, billing terms, service limits, and customer support commitments must be agreed before any paid API orders are enabled.</li>
   </ol>
   <p className="ls-note">The reseller API currently supports public service discovery only. New automated partner orders and paid Native checkout remain disabled until the separate security and settlement checks are approved. Litix cannot manufacture authentic followers, likes or views.</p>
  </section>
  <section className="ls-panel" id="apply">
   <h2>Apply for Litix Native wholesale access</h2>
   <PartnerApplication/>
  </section>
  <footer className="ls-footer">
   <Link href="/legal/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/publishers">Creator network</Link>
  </footer>
 </main>;
}
