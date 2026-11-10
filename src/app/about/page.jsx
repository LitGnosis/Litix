import Link from "next/link";
import "../partners/partners.css";

export const metadata={
 title:"About Litix | Social Media Services & Business Workflow Tools",
 description:"Learn what Litix.net offers, how its customer orders work, and what its proposed AI marketing operations services do and do not include.",
 alternates:{canonical:"https://www.litix.net/about"},
 openGraph:{title:"About Litix.net",url:"https://www.litix.net/about"}
};
const facts=[
 {question:"What is Litix.net?",answer:"Litix is an independent online marketplace for digital social media services. It also provides free creator tools and accepts manually reviewed inquiries from businesses interested in marketing and workflow operations."},
 {question:"How do customers order or track services?",answer:"Customers can browse currently available services in the shop and follow the payment and order instructions for each eligible purchase. Existing orders can be checked through the tracking page. Availability and delivery depend on the specific service and its terms."},
 {question:"Does Litix guarantee sales, followers or search rankings?",answer:"No. Marketing outcomes, search placement, and the business results of engagement or visibility activities are not guaranteed. Customers should review individual service terms and platform rules before purchasing."},
 {question:"Are automatic likes on new posts available?",answer:"New AutoLikes purchases are currently paused while supplier-side future-post delivery is verified. This is separate from existing order tracking and other services."},
 {question:"Does Litix offer AI automation or marketing retainers?",answer:"Businesses can request a proposal about consent-based lead capture, reviewed content workflows, analytics, and reporting. These are custom inquiries, not automatically activated subscriptions. Work begins only after a suitable scope and delivery arrangements have been agreed."}
];
export default function AboutLitix(){
 return <main className="wrap partner-page" style={{maxWidth:1100}}>
  <nav className="nav" aria-label="Litix information"><Link href="/" className="brand">LITIX</Link>
   <div><Link href="/shop">Shop</Link><Link href="/agency-growth">Business growth</Link><Link href="/press">Media</Link><Link href="/track">Track order</Link></div>
  </nav>
  <section className="panel partner-hero">
   <p className="kicker">LITIX · COMPANY FACTS</p>
   <h1>About Litix.net</h1>
   <p>Litix is an independent digital-services storefront built around clear service information, customer payment and order tracking, and practical tools for creators and businesses.</p>
   <p>The storefront and custom business-proposal process serve different needs: a listed product may be purchased only where checkout is available, while custom services require manual review before any agreement.</p>
   <div className="partner-actions"><Link className="primary" href="/shop">Browse current services</Link><Link href="/agency-growth">Discuss business workflows</Link></div>
  </section>
  <section className="panel">
   <h2>What you can verify</h2>
   <div className="partner-grid">
    <article className="partner-card"><h3>Services and orders</h3><p>Explore the live <Link href="/shop">shop</Link> and the existing <Link href="/track">order tracker</Link>. Available products and eligibility can change.</p></article>
    <article className="partner-card"><h3>Business inquiries</h3><p>The <Link href="/agency-growth">growth inquiry</Link> collects consent-based requests for scoped proposals; it does not take payment or activate a contract.</p></article>
    <article className="partner-card"><h3>First-party technology</h3><p>Read our <Link href="/demo/lead-operations">lead-response demonstration</Link> about tested notification and acknowledgement workflows. It is not a customer testimonial.</p></article>
   </div>
  </section>
  <section className="panel">
   <h2>Frequently asked questions</h2>
   {facts.map(item=><div key={item.question} style={{padding:"12px 0",borderBottom:"1px solid rgba(180,200,235,.18)"}}>
    <h3>{item.question}</h3><p>{item.answer}</p>
   </div>)}
  </section>
  <section className="panel"><h2>Contact and editorial inquiries</h2>
   <p>Questions about an existing order? Use <Link href="/track">order tracking</Link>. Business and editorial requests can be directed to <a href="mailto:litixsocial@gmail.com">litixsocial@gmail.com</a>.</p>
   <p><Link href="/press">View the Litix media fact sheet</Link> for background and accurate company links.</p>
  </section>
  <footer className="partner-footer"><Link href="/">Home</Link><Link href="/terms">Terms</Link><Link href="/legal/privacy">Privacy</Link><Link href="/press">Media information</Link></footer>
 </main>;
}