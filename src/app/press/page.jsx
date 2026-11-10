import Link from "next/link";
import "../partners/partners.css";

export const metadata={
 title:"Litix Media Information | Company Facts and Editorial Contact",
 description:"An accurate media fact sheet about Litix.net, its digital-services marketplace and tested lead-response workflows, with contact information for journalists.",
 alternates:{canonical:"https://www.litix.net/press"},
 openGraph:{title:"Litix Media Information",url:"https://www.litix.net/press"}
};

export default function LitixMedia(){
 return <main className="wrap partner-page" style={{maxWidth:1100}}>
  <nav className="nav" aria-label="Litix press information"><Link className="brand" href="/">LITIX</Link><div><Link href="/about">About</Link><Link href="/agency-growth">Business growth</Link><Link href="/shop">Shop</Link></div></nav>
  <section className="panel partner-hero">
   <p className="kicker">MEDIA AND EDITORIAL INFORMATION</p>
   <h1>Litix.net company fact sheet</h1>
   <p>For journalists, podcasters, creators, potential business partners, and editorial teams researching Litix. This page is supplied by the company itself; it is <strong>not</strong> an independent review, earned press mention, third-party endorsement, or statement that any news outlet has published our story.</p>
   <div className="partner-actions"><a className="primary" href="mailto:litixsocial@gmail.com?subject=Litix%20Editorial%20Inquiry">Contact Litix for an interview</a><Link href="/about">Company overview</Link></div>
  </section>
  <section className="panel">
   <h2>Verified public information</h2>
   <div className="partner-grid">
    <article className="partner-card"><h3>Brand name and website</h3><p>Litix — <a href="https://www.litix.net/">www.litix.net</a>. The storefront features a digital-services catalog and customer order tracking.</p></article>
    <article className="partner-card"><h3>Business services</h3><p>Litix also accepts inquiries about practical business marketing workflows, consent-based lead response, analytics, and content operations. These require individually approved proposals and delivery terms.</p></article>
    <article className="partner-card"><h3>Public demonstration</h3><p>A first-party <Link href="/demo/lead-operations">lead-response system demonstration</Link> documents validated intake, email alerts, a transactional acknowledgement, and optional discovery booking.</p></article>
   </div>
   <p className="small">All public offerings are subject to current availability and eligibility. No claim is made about guaranteed rankings, media coverage, customer sales or client results.</p>
  </section>
  <section className="panel">
   <h2>Possible interview topics</h2>
   <ol className="partner-steps">
    <li>Building a small digital-services business with transparent payment, tracking, and supplier-dependence safeguards.</li>
    <li>Why new automated services should be validated with actual delivery tests before charging customers.</li>
    <li>Using consent-based lead forms and one-time acknowledgements instead of unreviewed, fully autonomous sales promises.</li>
    <li>Practical questions for founders evaluating AI content tools, distribution, and reliable service delivery.</li>
   </ol>
   <p>These are suggested discussion topics, not claims of independent media coverage or achievements.</p>
  </section>
  <section className="panel">
   <h2>Media inquiries and brand assets</h2>
   <p><strong>Editorial contact:</strong> <a href="mailto:litixsocial@gmail.com">litixsocial@gmail.com</a>.</p>
   <p><strong>Brand logo:</strong> <a href="/assets/brand/logo.svg">Litix official vector mark</a>. Please request permission before modifying or using the mark commercially.</p>
   <p><strong>Website:</strong> <a href="https://www.litix.net/">www.litix.net</a>. <strong>Service catalog:</strong> <Link href="/shop">Shop</Link>. <strong>Business inquiries:</strong> <Link href="/agency-growth">Business Growth</Link>.</p>
   <p><strong>Transparency:</strong> Paid sponsorships, advertorials, and promotional placements should be identified as such. Editors retain independent publication decisions.</p>
  </section>
  <footer className="partner-footer"><Link href="/">Home</Link><Link href="/about">About Litix</Link><Link href="/legal/privacy">Privacy</Link><Link href="/terms">Terms</Link></footer>
 </main>;
}