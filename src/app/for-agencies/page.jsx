import Link from "next/link";
import "../partners/partners.css";

export const metadata={
 title:"Litix for Global Agencies | Client Service Purchasing & Partnerships",
 description:"Agencies worldwide can explore Litix's existing catalog, see currently available bundles, track orders and request a manually reviewed client-service partnership. Prices and availability confirmed at checkout.",
 alternates:{canonical:"https://www.litix.net/for-agencies"},
 openGraph:{title:"Global Agency Partnerships | Litix",description:"A practical ordering and tracking workflow for agencies and client-service teams. Request partnership terms and review currently available services.",url:"https://www.litix.net/for-agencies"}
};
const paths=[
 {heading:"Start with available services",copy:"Review the current catalog, service minimums, public prices and eligibility before placing a customer order.",href:"/shop",cta:"Browse available services"},
 {heading:"Plan larger client orders",copy:"Explore Litix's existing bundles and confirm exactly what each package includes, its fulfillment availability and checkout terms.",href:"/bundles",cta:"Explore existing bundles"},
 {heading:"Discuss recurring agency volume",copy:"Tell us your markets, estimated monthly client volume and operational needs. Commercial terms are reviewed manually—no automatic wholesale discounts or credit are promised.",href:"/partners?utm_source=agency_page&utm_medium=owned&utm_campaign=global_agencies#apply",cta:"Request agency review"}
];
export default function GlobalAgencyPage(){
 return <main className="wrap partner-page">
  <nav className="nav" aria-label="Litix global agency navigation">
   <Link className="brand" href="/">LITIX</Link>
   <div><Link href="/shop">Shop</Link><Link href="/bundles">Bundles</Link><Link href="/track">Track an order</Link></div>
  </nav>
  <section className="panel partner-hero">
   <p className="kicker">LITIX · GLOBAL AGENCY PARTNERSHIPS</p>
   <h1>One storefront. Clients around the world.</h1>
   <p>Manage client-service purchasing without juggling multiple storefronts. Discover Litix's existing services, review available bundles and request an agency partnership for your business.</p>
   <div className="partner-actions">
    <Link className="primary" href="/agency-growth?utm_source=agency_page&utm_medium=owned&utm_campaign=agency_inquiry#request">Request a business growth proposal</Link>
    <Link href="/shop">Explore live services</Link>
    <a href="https://calendly.com/spears5417/litix-business-growth-discovery-call">Book a discovery call</a>
   </div>
   <p className="small">Worldwide inquiries welcome. Actual service eligibility, supported payment methods, fulfillment and local requirements are reviewed individually; the checkout currently uses USD.</p>
  </section>
  <section className="panel">
   <h2>Three ways to grow with Litix</h2>
   <div className="partner-grid">{paths.map(p=><article className="partner-card" key={p.heading}>
    <h3>{p.heading}</h3><p>{p.copy}</p><Link href={p.href}>{p.cta}</Link>
   </article>)}</div>
  </section>
  <section className="panel">
   <h2>For agencies operating in multiple markets</h2>
   <ol className="partner-steps">
    <li>Choose the relevant public service or bundle and review its terms, pricing and platform restrictions.</li>
    <li>Keep a separate order reference for each customer campaign and share only authorized public account or post destinations.</li>
    <li>Track verified payment and delivery status through Litix. Escalate exceptions before placing replacements or duplicate orders.</li>
    <li>For repeat purchasing, submit an agency inquiry with your market, typical order sizes, estimated volume and business website.</li>
   </ol>
   <p className="small">Agency accounts with consolidated billing, client subaccounts, white-label reporting, automated refills and partner commission payouts are not currently activated. Ask about commercial terms before promising those features to your clients.</p>
  </section>
  <section className="panel">
   <h2>Global inquiries in six languages</h2>
   <p>Explore Litix's informational pages in English, Spanish, Portuguese, French, German and Arabic. Actual prices, checkout and legal terms remain in English/USD.</p>
   <p><Link href="/global/en">English</Link> · <Link href="/global/es">Español</Link> · <Link href="/global/pt">Português</Link> · <Link href="/global/fr">Français</Link> · <Link href="/global/de">Deutsch</Link> · <Link href="/global/ar">العربية</Link></p>
   <p>Partner promotions must be accurate, disclosed where sponsored and consistent with applicable platform policies. Orders do not guarantee social metrics, earnings or audience growth.</p>
   <div className="partner-actions"><Link className="primary" href="/partners?utm_source=agency_page&utm_medium=owned&utm_campaign=global_agencies#apply">Apply for partnership review</Link><Link href="/track">Track an existing order</Link></div>
  </section>
  <footer className="partner-footer"><Link href="/">Litix home</Link><Link href="/legal/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/refunds">Refund policy</Link></footer>
 </main>;
}
