import Link from "next/link";
import EarlyAccessForm from "./EarlyAccessForm";
import "./digital-products.css";

export const metadata = {
  title: "Digital Growth Studio | Litix",
  description: "Explore Litix digital growth resources for creators, marketing teams, and agencies: launch systems, campaign measurement, and client operations.",
  alternates: { canonical: "https://litix.net/digital-products" },
  openGraph: {
    title: "Digital Growth Studio | Litix",
    description: "Creator-ready launch systems, growth measurement templates, and agency workflows from Litix.",
    url: "https://litix.net/digital-products",
    siteName: "Litix",
    type: "website",
  },
};

const products = [
  {
    id: "creator-launch-kit",
    tier: "FOR CREATORS",
    name: "Creator Launch Kit",
    price: "$19",
    summary: "A practical launch workspace for turning an idea into a clear, repeatable rollout.",
    includes: ["Launch readiness checklist", "30-day content planner", "Campaign brief worksheet", "Post-launch review template"],
    outcome: "Plan your next launch with fewer moving pieces.",
  },
  {
    id: "social-growth-toolkit",
    tier: "FOR GROWTH TEAMS",
    name: "Social Growth Toolkit",
    price: "$29",
    summary: "A simple system to organize experiments, track results, and decide what to improve next.",
    includes: ["Campaign planning worksheet", "Weekly metrics tracker", "Content experiment log", "Monthly performance review"],
    outcome: "Make your next campaign easier to measure.",
    featured: true,
  },
  {
    id: "agency-starter-pack",
    tier: "FOR AGENCIES",
    name: "Agency Starter Pack",
    price: "$49",
    summary: "Reusable client and delivery workflows for small marketing teams building consistent operations.",
    includes: ["Client onboarding checklist", "Campaign kickoff brief", "Reporting template", "Delivery and handoff checklist"],
    outcome: "Create a more consistent client experience.",
  },
];

export default function DigitalProductsPage() {
  return (
    <main className="digital-shell">
      <nav className="digital-nav" aria-label="Main navigation">
        <Link className="digital-brand" href="/">LITIX<span>✦</span></Link>
        <div className="digital-navlinks">
          <Link href="/platform">Platform</Link>
          <Link href="/">Social growth</Link>
          <Link href="/growth">Content calendar</Link>
          <a href="#products">Digital kits</a>
        </div>
      </nav>

      <section className="digital-hero">
        <div className="digital-eyebrow"><span /> THE LITIX DIGITAL WORKSHOP</div>
        <h1>One platform.<br /><span>Every next move.</span></h1>
        <p>Discover practical digital tools for creators, marketing teams, and agencies—from launch planning and campaign measurement to client delivery systems. Build with clarity, learn from data, and scale what works.</p>
        <a className="digital-primary" href="#products">Explore the kits <span aria-hidden="true">↘</span></a>
        <div className="digital-proofline"><span>01 / PLAN</span><i /> <span>02 / EXECUTE</span><i /> <span>03 / LEARN</span></div>
        <div className="digital-orbit" aria-hidden="true"><div className="orbit-ring orbit-ring-one" /><div className="orbit-ring orbit-ring-two" /><div className="orbit-core">L<span>✦</span></div><b className="orbit-label orbit-label-a">FOCUS</b><b className="orbit-label orbit-label-b">MOMENTUM</b><b className="orbit-label orbit-label-c">SYSTEMS</b></div>
      </section>

      <section className="digital-products-section" id="products">
        <div className="digital-section-heading">
          <div><div className="digital-eyebrow">THE STARTING COLLECTION</div><h2>Pick your next advantage.</h2></div>
          <p>Clear, editable frameworks. Start with one kit, then build a workflow that works for you.</p>
        </div>
        <div className="digital-product-grid">
          {products.map((product, index) => (
            <article className={`digital-product-card ${product.featured ? "is-featured" : ""}`} key={product.id}>
              <div className="digital-card-top"><span className="digital-tier">{product.tier}</span><span className="digital-index">0{index + 1}</span></div>
              <div className="digital-product-symbol" aria-hidden="true">{index === 0 ? "↗" : index === 1 ? "⌁" : "◇"}</div>
              <h3>{product.name}</h3>
              <p className="digital-product-summary">{product.summary}</p>
              <div className="digital-price"><strong>{product.price}</strong><span>planned one-time price</span></div>
              <div className="digital-includes-title">BUILT INTO THE KIT</div>
              <ul>{product.includes.map(item => <li key={item}><span>✓</span>{item}</li>)}</ul>
              <p className="digital-outcome">{product.outcome}</p>
              <Link className="digital-product-cta" href={`/digital-products/${product.id}`}>Explore this kit <span aria-hidden="true">↗</span></Link>
            </article>
          ))}
        </div>
        <p className="digital-disclaimer">These are planned product concepts. Each kit page shows whether secure checkout is open; joining early access is not a purchase.</p>
      </section>

      <section className="digital-steps">
        <div className="digital-eyebrow">BUILT FOR REAL WORK</div>
        <h2>Less blank-page time.<br /><span>More meaningful progress.</span></h2>
        <div className="digital-step-grid">
          <article><span>01</span><h3>Start with structure</h3><p>Use a ready-made framework instead of rebuilding the same checklist from scratch.</p></article>
          <article><span>02</span><h3>Make it yours</h3><p>Adapt the worksheets to your goals, your brand, and the way your team works.</p></article>
          <article><span>03</span><h3>Improve as you go</h3><p>Capture outcomes and lessons so the next campaign starts from a stronger baseline.</p></article>
        </div>
      </section>

      <section className="digital-early-access" id="early-access">
        <div className="digital-early-copy"><div className="digital-eyebrow">GET FIRST ACCESS</div><h2>Be first in line for the collection.</h2><p>Join the early-access list to hear when the kits are ready. This is a launch-interest signup only—no payment is taken and no product is being sold yet.</p><div className="digital-early-links"><Link href="/growth">Explore the content calendar ↗</Link><Link href="/">Explore Litix services ↗</Link></div></div>
        <EarlyAccessForm />
      </section>
      <footer className="digital-footer"><Link className="digital-brand" href="/">LITIX<span>✦</span></Link><span>Analytics Amplified · Innovation Ignited · Metrics that Move</span><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/refunds">Refunds</Link></div></footer>
    </main>
  );
}
