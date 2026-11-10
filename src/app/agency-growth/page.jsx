import Link from "next/link";
import LitixAgencyGrowthInquiry from "../../components/LitixAgencyGrowthInquiry";
import {LITIX_B2B_OFFERS} from "../../lib/litixB2BOffers.mjs";
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
 {title:"AI-supported business workflows",text:"Discuss opt-in lead acknowledgements, reviewed content scheduling, staff escalations and reporting. Only approved tools and human-reviewed actions can go live."}
];
export default function AgencyGrowth(){
 return <main className="wrap partner-page agency-growth">
  <nav className="nav" aria-label="Litix business growth">
   <Link href="/" className="brand">LITIX</Link>
   <div><Link href="/for-agencies">For agencies</Link><Link href="/demo/lead-operations">Workflow demo</Link><Link href="/shop">Shop</Link><Link href="/track">Order support</Link></div>
  </nav>
  <section className="panel agency-growth-hero">
   <p className="kicker">LITIX · BUSINESSES & AGENCIES</p>
   <h1>Build a marketing plan you can actually measure.</h1>
   <p>Need a clearer way to turn attention into real inquiries? Tell us about your business, budget and priorities. Litix can review the fit for a custom proposal before you commit to any services.</p>
   <div className="partner-actions"><a className="primary" href="#request">Request a business proposal</a><a href="https://calendly.com/spears5417/litix-business-growth-discovery-call">Book a 20-minute discovery call</a></div>
   <p className="small">Worldwide inquiries welcome. No guarantee of leads, sales, followers, rankings or earnings. No payment is collected here.</p>
  </section>
  <section className="panel" id="services">
   <h2>Three scoped services for businesses and agencies</h2>
   <p>These are proposed starting ranges for a qualified sales discussion, not a payment checkout or automatic subscription. Each project is accepted only after Litix confirms delivery capacity and a written agreement.</p>
   <div className="partner-grid agency-sales-offers">
    {LITIX_B2B_OFFERS.map(offer=><article className="partner-card agency-sales-offer" key={offer.id}>
     <p className="kicker">BUSINESS PROPOSAL</p>
     <h3>{offer.name}</h3>
     <p className="agency-sales-price">{offer.price}</p>
     <p>{offer.outcome}</p>
     <h4>Potential scope</h4>
     <ul>{offer.scope.map(task=><li key={task}>{task}</li>)}</ul>
     <p className="small">{offer.pricingNote}. {offer.limits}.</p>
     <a className="primary agency-sales-link" href={`?offer=${offer.id}#request`}>Discuss this service</a>
    </article>)}
   </div>
   <p className="small">All suggested price bands are illustrative USD amounts. No project is sold, paid, activated, or promised by filling out this form. Scope, technical requirements, fees, timelines and responsibilities require written approval.</p>
  </section>
  <section className="panel">
   <h2>Three areas we can discuss</h2>
   <div className="partner-grid">
    {areas.map(a=><article key={a.title} className="partner-card"><h3>{a.title}</h3><p>{a.text}</p></article>)}
   </div>
   <p><Link href="/solutions/automation-ops">Explore AI Marketing Operations</Link> · <Link href="/demo/lead-operations">See a verified Litix lead-response workflow demo</Link></p>
   <p className="small">These are proposal topics, not automatically available subscriptions. Deliverables, provider access, timing, legal eligibility and prices are confirmed individually in writing before any sale.</p>
  </section>
  <section className="panel">
   <p className="kicker">LITIX OWNED TECHNOLOGY</p>
   <h2>Preview our first-party creative planning engine</h2>
   <p>Use the native Litix Growth Studio to prepare twelve reviewed content drafts with platform-specific creative direction and tracked campaign links, then discuss a properly scoped content-operations service. This is not automatic video editing or social posting.</p>
   <div className="partner-actions"><Link className="primary" href="/growth-studio">Open Litix Growth Studio</Link><Link href="/demo/lead-operations">See our lead-response demonstration</Link></div>
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
    <h2>Request a scoped proposal</h2>
    <p>Select a service and tell us your goals. The inquiry is routed for manual qualification, not automatic payment or supplier fulfillment.</p>
    <p>Prefer a conversation? <a href="https://calendly.com/spears5417/litix-business-growth-discovery-call">Book an available 20-minute discovery call</a>. Booking a call does not create a contract or paid order.</p>
    <LitixAgencyGrowthInquiry/>
   </div>
  </section>
  <footer className="partner-footer"><Link href="/">Home</Link><Link href="/partners">Partners</Link><Link href="/company">About</Link><Link href="/press">Media</Link><Link href="/terms">Terms</Link><Link href="/legal/privacy">Privacy</Link></footer>
 </main>;
}
