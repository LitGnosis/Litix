import Link from "next/link";
import "../../partners/partners.css";

export const metadata={
  title:"Litix Lead Response Workflow | Verified Demonstration",
  description:"See an honest technical demonstration of Litix's working consent-based inquiry form, idempotent owner notifications, prospect acknowledgements and discovery booking. No fabricated customer outcomes.",
  alternates:{canonical:"https://www.litix.net/demo/lead-operations"}
};
const stages=[
 {title:"1. Consent-based intake",detail:"A business submits an inquiry and explicitly agrees to be contacted. The server validates form fields, checks same-site origin, rejects simple spam and limits request size."},
 {title:"2. Owner alert",detail:"The system sends an idempotent internal email containing only the inquiry needed for a human to review suitability and deliverability. This does not create a charge, a service order or a CRM deal."},
 {title:"3. Prospect acknowledgement",detail:"Only after the internal alert is accepted, the system queues a fixed one-time acknowledgement. It does not promise approval, a price or guaranteed results."},
 {title:"4. Optional discovery booking",detail:"A prospect can book an available 20-minute call. Written scope, fees, roles and fulfillment are agreed separately before any project begins."}
];
export default function LeadOperationsProof(){
 return <main className="wrap partner-page" style={{maxWidth:1120}}>
  <nav className="nav" aria-label="Litix demonstration navigation">
   <Link href="/" className="brand">LITIX</Link>
   <div><Link href="/agency-growth">Business growth</Link><Link href="/solutions/automation-ops">AI operations</Link><Link href="/partners">Partnerships</Link></div>
  </nav>
  <section className="panel partner-hero">
   <p className="kicker">LITIX · VERIFIED INTERNAL DEMONSTRATION</p>
   <h1>A working lead-response workflow, without the hype.</h1>
   <p>See the process behind our own business-inquiry intake and acknowledgement. This is a first-party technical demonstration, not an external client case study or proof of marketing ROI.</p>
   <div className="partner-actions">
    <Link className="primary" href="/agency-growth#request">Discuss your workflow</Link>
    <a href="https://calendly.com/spears5417/litix-business-growth-discovery-call">Book a 20-minute call</a>
   </div>
   <p className="small">No card details, third-party passwords, customer lists, or private CRM records are needed to explore this demonstration.</p>
  </section>
  <section className="panel">
   <h2>What the existing system actually does</h2>
   <div className="partner-grid">
    {stages.map(stage=><article key={stage.title} className="partner-card">
     <h3>{stage.title}</h3><p>{stage.detail}</p>
    </article>)}
   </div>
  </section>
  <section className="panel">
   <h2>Verification and boundaries</h2>
   <p>An explicitly labeled internal test was submitted on November 9, 2026. The form returned success, and both the internal owner notification and one-time acknowledgement were observed in the connected Gmail account. We also confirmed the live site, shop and order-tracking pages responded normally.</p>
   <p>The workflow uses existing server-side validation, Resend delivery and independent idempotency keys. An automated QA suite exercises valid and invalid submissions, acknowledgement failure behavior and no-charge safeguards.</p>
   <p><a href="https://github.com/LitGnosis/Litix/pull/172">Review the implementation and tests on GitHub</a>.</p>
   <p><strong>Not represented as ready:</strong> AI lead scoring, customer CRM writes, autonomous sales calls, approved social publishing, guaranteed appointment conversions or a signed paid client. Those are separate features and engagements requiring user permissions, verified integrations and agreed project scope.</p>
  </section>
  <section className="panel">
   <h2>Make it useful for your own business</h2>
   <p>If you operate a service business or agency, ask about adapting lead forms, opt-in confirmations, handoffs, reporting, and a human-reviewed follow-up process. We'll evaluate current tools and a measurable pilot rather than promise a prebuilt product that isn't available.</p>
   <div className="partner-actions"><Link className="primary" href="/agency-growth#request">Request a project review</Link><a href="https://calendly.com/spears5417/litix-business-growth-discovery-call">Check call availability</a></div>
  </section>
  <footer className="partner-footer"><Link href="/">Litix home</Link><Link href="/legal/privacy">Privacy</Link><Link href="/terms">Terms</Link></footer>
 </main>;
}
