import Link from "next/link";
import LitixPublisherApplication from "../../components/LitixPublisherApplication";
import "../solutions/solutions.css";
export const metadata={
 title:"Partner With Litix | Creator & Publisher Campaigns",
 description:"Join the Litix Native creator and publisher partnership review program for genuine, permissioned campaigns, original content and transparent promotion.",
 alternates:{canonical:"https://www.litix.net/publishers"}
};
export default function LitixPublisherPartners(){
 return <main className="ls-main">
  <nav className="ls-nav" aria-label="Litix creator partnerships">
   <Link href="/" className="ls-brand"><img src="/assets/brand/litix-logo.webp" width="126" height="68" alt="Litix home"/></Link>
   <div><Link href="/native">Native tools</Link><Link href="/partners">Partnerships</Link><Link href="/shop">Shop</Link></div>
  </nav>
  <section className="ls-hero ls-detail-hero">
   <span className="ls-eyebrow">LITIX NATIVE · GLOBAL CREATOR NETWORK</span>
   <h1>Help create genuine campaigns with Litix.</h1>
   <p>We're looking for independent creators, publishers, and legitimate agencies worldwide who can provide original content or approved promotional placements to relevant audiences. Apply to discuss the fit.</p>
   <div className="ls-actions"><Link className="ls-cta" href="#apply">Apply to collaborate</Link><Link className="ls-link" href="/native">Try our free creator tools</Link></div>
  </section>
  <section className="ls-panel">
   <h2>What we're recruiting</h2>
   <ul className="ls-list">
    <li>Creators who make original, licensed promotional content with written permission.</li>
    <li>Publishers with genuine audiences and clearly defined ad or sponsored-placement options.</li>
    <li>Regional and international agencies able to coordinate lawful campaigns and customer support.</li>
    <li>Marketing specialists who can deliver verifiable reports, designs, or local-business content.</li>
   </ul>
   <p className="ls-note">This is an application program, not an active paid job offer or guaranteed commission. Each proposal must be reviewed for audience authenticity, rights, platform requirements, disclosure, pricing and measurable deliverables before work starts.</p>
  </section>
  <section className="ls-panel">
   <h2>How a genuine Litix campaign would work</h2>
   <ol className="ls-list">
    <li>Submit a partnership inquiry with your public portfolio, content niche, location and proposed deliverables.</li>
    <li>Litix verifies identity, applicable content rights, brand fit and any audience or traffic claims.</li>
    <li>Both parties agree on scope, disclosure requirements, approval rights and costs in writing.</li>
    <li>The creator publishes or delivers permitted content, then shares a legitimate report or proof of delivery.</li>
   </ol>
   <p className="ls-note">No purchased likes, follower exchanges, fabricated views, secret endorsements, credential sharing or promises of guaranteed engagement. Actual customer campaign bookings are not enabled by this application.</p>
   <Link className="ls-cta" href="#apply">Request partnership review</Link>
  </section>
  <LitixPublisherApplication/>
  <footer className="ls-footer"><Link href="/legal/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/">Litix home</Link></footer>
 </main>;
}
