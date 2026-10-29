import Link from "next/link";
import { notFound } from "next/navigation";
import EarlyAccessForm from "../EarlyAccessForm";
import DigitalProductCheckout from "../DigitalProductCheckout";

const products = {
  "creator-launch-kit": {
    name: "Creator Launch Kit",
    audience: "FOR CREATORS",
    price: "$19",
    summary: "A focused 30-day planning system to turn a launch idea into clear tasks, content, and a post-launch review.",
    promise: "A clearer plan for the work you control—without pretending any template can guarantee results.",
    includes: [
      "One-page launch brief and audience message map",
      "Launch readiness checklist for offer, content, and operations",
      "30-day launch calendar with daily focus and calls to action",
      "Content brief worksheet for repeatable planning",
      "Launch-day runbook and post-launch scorecard",
      "Retrospective prompts to improve the next cycle",
    ],
    previewTitle: "A sample planning prompt",
    preview: "What is the one outcome this launch should create, who is it for, and what single next step should the audience take?",
    faq: [
      ["Who is this for?", "Independent creators, small brands, and solo operators planning a launch or campaign."],
      ["Does it guarantee sales or growth?", "No. It provides planning structure. Outcomes depend on the offer, audience, execution, timing, and other factors."],
      ["How do I know if checkout is open?", "The secure checkout section below shows whether this product is available. Joining early access is not a purchase."],
    ],
  },
  "social-growth-toolkit": {
    name: "Social Growth Toolkit",
    audience: "FOR GROWTH TEAMS",
    price: "$29",
    summary: "A practical campaign workspace for tracking content experiments, measuring performance, and deciding what to try next.",
    promise: "Replace guesswork with documented hypotheses, consistent metrics, and thoughtful review.",
    includes: [
      "Channel baseline and audience signal log",
      "Campaign brief with primary KPI selection",
      "Weekly content planner",
      "Experiment card and spreadsheet-ready tracker",
      "Monthly dashboard with change calculations",
      "Monthly decision memo and ethical growth guardrails",
    ],
    previewTitle: "A sample experiment prompt",
    preview: "If we change one variable for a defined audience, which primary metric should move, and what evidence would change our mind?",
    faq: [
      ["Who is this for?", "Creators, social media managers, and small growth teams who want a repeatable measurement habit."],
      ["Does it promise a certain follower count?", "No. The toolkit helps plan and evaluate work; it does not guarantee platform outcomes."],
      ["Is it available to buy now?", "Not yet. Join early access and we'll share an update when the final files and terms are ready."],
    ],
  },
  "agency-starter-pack": {
    name: "Agency Starter Pack",
    audience: "FOR AGENCIES",
    price: "$49",
    summary: "Reusable onboarding and delivery workflows to help small agencies scope work, keep clients informed, and close projects cleanly.",
    promise: "A more consistent process, adapted to your own services and agreements.",
    includes: [
      "New-client intake and fit assessment",
      "Discovery call agenda and notes",
      "Scope, kickoff, and change-request briefs",
      "Access and asset checklist using least-privilege principles",
      "Weekly delivery checklist and client status report",
      "Decision log, closeout checklist, and retrospective",
    ],
    previewTitle: "A sample kickoff prompt",
    preview: "What is in scope, what is explicitly out of scope, who approves the work, and what evidence defines acceptance?",
    faq: [
      ["Who is this for?", "Freelancers, independent consultants, and small marketing agencies."],
      ["Is this legal advice or a contract?", "No. These are operating templates. Use written agreements appropriate to your business and seek professional advice where needed."],
      ["Is it available to buy now?", "Not yet. Join early access and we'll share an update when the final files and terms are ready."],
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(products).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = products[slug];
  if (!product) return { title: "Digital Product | Litix" };
  return {
    title: product.name + " | Litix Digital Products",
    description: product.summary,
    alternates: { canonical: "https://litix.net/digital-products/" + slug },
    openGraph: {
      title: product.name + " | Litix",
      description: product.summary,
      url: "https://litix.net/digital-products/" + slug,
      siteName: "Litix",
      type: "website",
    },
  };
}

export default async function DigitalProductDetailPage({ params }) {
  const { slug } = await params;
  const product = products[slug];
  if (!product) notFound();

  return (
    <main className="digital-shell">
      <nav className="digital-nav" aria-label="Main navigation">
        <Link className="digital-brand" href="/">LITIX<span>✦</span></Link>
        <div className="digital-navlinks">
          <Link href="/digital-products">All digital kits</Link>
          <Link href="/">Litix services</Link>
        </div>
      </nav>
      <section className="digital-detail-hero">
        <div className="digital-eyebrow"><span /> {product.audience}</div>
        <p className="digital-detail-back"><Link href="/digital-products">← All digital products</Link></p>
        <h1>{product.name}<br /><span>Make the next step clearer.</span></h1>
        <p className="digital-detail-summary">{product.summary}</p>
        <p className="digital-detail-promise">{product.promise}</p>
        <a className="digital-primary" href="#early-access">Get launch updates <span aria-hidden="true">↘</span></a>
        <div className="digital-detail-status">PLANNED PRICE: {product.price} · CHECKOUT STATUS BELOW</div>
      </section>
      <section className="digital-detail-content">
        <div>
          <div className="digital-eyebrow">WHAT'S INCLUDED</div>
          <h2>One kit. A repeatable workflow.</h2>
          <ul className="digital-detail-includes">{product.includes.map((item) => <li key={item}><span>✓</span>{item}</li>)}</ul>
        </div>
        <aside className="digital-preview-card">
          <div className="digital-eyebrow">INSIDE THE WORKFLOW</div>
          <h3>{product.previewTitle}</h3>
          <p>{product.preview}</p>
          <span className="digital-preview-label">SAMPLE PREVIEW · FINAL FILES IN PROGRESS</span>
        </aside>
      </section>
      <DigitalProductCheckout productId={slug} productName={product.name} />
      <section className="digital-detail-faq">
        <div className="digital-eyebrow">BEFORE YOU JOIN</div>
        <h2>Frequently asked questions</h2>
        {product.faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
      </section>
      <section className="digital-early-access digital-detail-signup" id="early-access">
        <div className="digital-early-copy"><div className="digital-eyebrow">GET FIRST ACCESS</div><h2>We'll let you know when it's ready.</h2><p>Join the early-access list for updates on {product.name}. No payment is taken by joining.</p></div>
        <EarlyAccessForm />
      </section>
      <footer className="digital-footer"><Link className="digital-brand" href="/">LITIX<span>✦</span></Link><span>The Platinum Standard in Social Growth.</span><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/refunds">Refunds</Link></div></footer>
    </main>
  );
}
