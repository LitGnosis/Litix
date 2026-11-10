import Link from "next/link";
import LitixAgencyGrowthInquiry from "../../components/LitixAgencyGrowthInquiry";
import "../partners/partners.css";
import "./agency-growth.css";

export const metadata={
 title:"Business Growth Proposals | Litix Agencies & Brands",
 description:"Request a tailored, manually reviewed plan for a small business, creator brand or marketing agency. Discuss conversion tracking, local visibility, content workflows and client reporting. No payment required.",
 alternates:{canonical:"https://www.litix.net/agency-growth"},
 openGraph:{title:"Grow Measurable Business Results | Litix",description:"Explore a practical marketing operations plan and request a scoped proposal. No guaranteed results or unverified delivery claims.",url:"https://www.litix.net/agency-growth"}
};
const areas=[
 {title:"Business conversion basics",text:"Review the visitor journey, calls to action and how qualified inquiries can be tracked without collecting unnecessary personal data."},
 {title:"Content and campaign workflow",text:"Discuss publishing calendars, creative review, permitted distribution and how to evaluate which channels drive real inquiries."},
 {title:"Agency client operations",text:"Scope a repeatable client-order and reporting process, with verified deliverables, clear responsibilities and exception handling."}
];
export default function AgencyGrowth(){
 return <main className="wrap partner-page agency-growth">
  <nav className="nav" aria-label="Litix business growth">
   <Link href="/" className="brand">LITIX</Link>
   <div><Link href="/for-agencies">For agencies</Link><Link href="/shop">Shop</Link><Link href="/track">Order support</Link></div>
  </nav>
  <section className="panel agency-growth-hero">
   <p className="kicker">LITIX · BUSINESSES & AGENCIES</p>
   <h1>Build a marketing plan you can actually measure.</h1>
   <p>Need a clearer way to turn attention into real inquiries? Tell us about your business, budget and priorities. Litix can review the fit for a custom proposal before you commit to any services.</p>
   <div className="partner-actions"><a className="primary" href="#request">Request a business proposal</a><Link href="/tools/local-visibility">Try the free visibility checklist</Link></div>
   <p className="small">Worldwide inquiries welcome. No guarantee of leads, sales, followers, rankings or earnings. No payment is collected here.</p>
  </section>
  <section className="panel">
   <h2>Three areas we can discuss</h2>
   <div className="partner-grid">
    {areas.map(a=><article key={a.title} className="partner-card"><h3>{a.title}</h3><p>{a.text}</p></article>)}
   </div>
   <p className="small">These are proposal topics, not automatically available subscriptions. Deliverables, provider access, timing, legal eligibility and prices are confirmed individually in writing before any sale.</p>
  </section>
  <section className="panel agency-growth-grid">
   <div>
    <h2>How a partnership starts</h2>
    <ol className="partner-steps">
     <li>Share the business problem, target customer and estimated monthly budget.</li>
     <li>Litix evaluates whether a permitted and deliverable solution can be scoped.</li>
     <li>If there's a fit, agree on written scope, clear fees and measurable reporting before any work begins.</li>
    </ol>
    <p>Already buying Litix services for clients? <Link href="/for-agencies">See our agency purchasing information</Link>. Need help with an existing paid order? <Link href="/track">Use order tracking</Link> instead.</p>
   </div>
   <div id="request" className="agency-growth-form">
    <p className="kicker">NO PAYMENT · MANUAL REVIEW</p>
    <h2>Tell us what you need</h2>
    <LitixAgencyGrowthInquiry/>
   </div>
  </section>
  <footer className="partner-footer"><Link href="/">Home</Link><Link href="/partners">Partners</Link><Link href="/terms">Terms</Link><Link href="/legal/privacy">Privacy</Link></footer>
 </main>;
}
