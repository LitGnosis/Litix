import Link from "next/link";
import PartnerApplication from "../../components/PartnerApplication";
import "./partners.css";

export const metadata = {
  title:"Litix Partnerships | Agency, Referral & Creator Inquiries",
  description:"Explore Litix agency, referral, and creator collaboration opportunities. Submit an inquiry for manual review; terms and eligibility are approved individually.",
  alternates:{canonical:"https://www.litix.net/partners"}
};

const paths=[
  {name:"Agencies and consultants",summary:"Discuss ongoing client needs, service eligibility and partnership terms. Wholesale access is not activated by applying."},
  {name:"Referral and affiliate pilots",summary:"Apply to discuss a trackable referral partnership. Rates, attribution and payouts require written approval and technical verification."},
  {name:"Independent reviewers",summary:"Pitch an honest editorial review or founder conversation. Reviews must disclose sponsorships and retain editorial independence."}
];

export default function PartnersPage(){
  return <main className="wrap partner-page">
    <nav className="nav" aria-label="Partnership navigation">
      <Link className="brand" href="/">LITIX</Link>
      <div><Link href="/shop">Explore services</Link><Link href="/for-agencies">For agencies</Link><Link href="/track">Track order</Link></div>
    </nav>
    <section className="panel partner-hero">
      <p className="kicker">LITIX · PARTNERSHIP PROGRAM</p>
      <h1>Grow with Litix.</h1>
      <p>We're inviting agencies, marketing professionals, creators and business operators to propose long-term partnerships. Tell us how we can work together and our team will review the fit.</p>
      <div className="partner-actions"><a className="primary" href="#apply">Apply for review</a><Link href="/shop">Explore the storefront</Link></div>
    </section>
    <section className="panel">
      <h2>Ways to collaborate</h2>
      <div className="partner-grid">{paths.map(p=><article key={p.name} className="partner-card"><h3>{p.name}</h3><p>{p.summary}</p></article>)}</div>
    </section>
    <section className="panel">
      <h2>How it works</h2>
      <ol className="partner-steps"><li>Tell us about your business, audience and proposal.</li><li>Litix reviews suitability, supported services and applicable platform policies.</li><li>If approved, we agree on written terms before any pricing, tracking codes or compensation go live.</li></ol>
      <p className="small">Submitting this form doesn't create an account, reserve exclusive territory, award a commission, activate wholesale pricing or guarantee acceptance. Any promotion must be accurate, disclosed when sponsored and comply with applicable platform rules.</p>
    </section>
    <section className="panel" id="apply">
      <h2>Partnership inquiry</h2>
      <p>Use this form for qualified business proposals. Please don't include passwords, card information, private order links or sensitive customer data.</p>
      <PartnerApplication/>
    </section>
    <footer className="partner-footer"><Link href="/">Litix home</Link><Link href="/legal/privacy">Privacy</Link><Link href="/terms">Terms</Link></footer>
  </main>;
}
