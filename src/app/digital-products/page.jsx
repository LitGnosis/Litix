import Link from "next/link";
import "./digital-products.css";

export const metadata = {
  title: "Digital Products | Litix",
  description: "Practical creator and agency templates from Litix: launch planning, social growth tracking, and client workflow systems.",
  alternates: { canonical: "https://litix.net/digital-products" },
  openGraph: {
    title: "Digital Products | Litix",
    description: "Creator-ready planning kits and agency workflow templates from Litix.",
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
          <Link href="/">Social growth</Link>
          <Link href="/growth">Content calendar</Link>
          <a href="#products">Digital kits</a>
        </div>
      </nav>

      <section className="digital-hero">
        <div className="digital-eyebrow"><span /> THE LITIX DIGITAL WORKSHOP</div>
        <h1>Build smarter.<br /><span>Launch with a system.</span></h1>
        <p>Practical planning kits for creators, growth teams, and agencies who want fewer scattered documents and a clearer next step.</p>
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
              <div className="digital-price"><strong>{product.price}</strong><span>one-time price concept</span></div>
              <div className="digital-includes-title">BUILT INTO THE KIT</div>
              <ul>{product.includes.map(item => <li key={item}><span>✓</span>{item}</li>)}</ul>
              <p className="digital-outcome">{product.outcome}</p>
              <a className="digital-product-cta" href="#early-access"> {product.featured ? "Get launch updates" : "Join early access"} <span aria-hidden="true">↗</span></a>
            </article>
          ))}
        </div>
        <p className="digital-disclaimer">These are proposed product concepts and planned prices. Checkout and downloadable files are not yet available for purchase.</p>
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
        <div><div className="digital-eyebrow">NEXT UP</div><h2>Digital tools, built the Litix way.</h2><p>We're shaping the first collection around useful templates—not empty promises. Explore the existing Litix planning workspace while the downloadable kits are prepared.</p></div>
        <div className="digital-early-actions"><Link className="digital-primary" href="/growth">Open content calendar <span aria-hidden="true">↗</span></Link><Link className="digital-secondary" href="/">Explore Litix services</Link></div>
      </section>
      <footer className="digital-footer"><Link className="digital-brand" href="/">LITIX<span>✦</span></Link><span>The Platinum Standard in Social Growth.</span><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/refunds">Refunds</Link></div></footer>
    </main>
  );
}
