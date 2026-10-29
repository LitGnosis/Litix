import Link from "next/link";
import "../digital-products/digital-products.css";
import "./platform.css";

export const metadata = {
  title: "Litix Growth Platform | SaaS, Marketing & Digital Tools",
  description: "A connected growth workspace for creators, businesses, and agencies: social marketing services, planning tools, digital products, and agency workflows.",
  alternates: { canonical: "https://litix.net/platform" },
  openGraph: {
    title: "Litix Growth Platform",
    description: "Analytics Amplified. Innovation Ignited. Build your next move with Litix.",
    url: "https://litix.net/platform",
    siteName: "Litix",
    type: "website",
  },
};

const workspaces = [
  {
    number: "01",
    label: "SOCIAL GROWTH",
    title: "Put your next campaign in motion.",
    description: "Explore social growth services from one streamlined storefront, with clear service details before you order.",
    href: "/",
    action: "Explore services",
    mark: "↗",
  },
  {
    number: "02",
    label: "CONTENT PLANNING",
    title: "Turn ideas into consistent action.",
    description: "Use the content calendar to bring structure to your publishing rhythm and make the next step easier to see.",
    href: "/growth",
    action: "Open content tools",
    mark: "⌁",
  },
  {
    number: "03",
    label: "DIGITAL PRODUCTS",
    title: "Build with repeatable systems.",
    description: "Explore creator launch frameworks, campaign measurement worksheets, and practical agency templates.",
    href: "/digital-products",
    action: "Explore digital kits",
    mark: "◇",
  },
  {
    number: "04",
    label: "AGENCY WORKFLOWS",
    title: "Deliver a more consistent client experience.",
    description: "Preview the Agency Starter Pack for client intake, project tracking, status reporting, and delivery handoffs.",
    href: "/digital-products/agency-starter-pack",
    action: "Explore agency tools",
    mark: "◎",
  },
];

export default function PlatformPage() {
  return (
    <main className="digital-shell platform-shell">
      <nav className="digital-nav" aria-label="Main navigation">
        <Link className="digital-brand" href="/">LITIX<span>✦</span></Link>
        <div className="digital-navlinks">
          <Link href="/">Social growth</Link>
          <Link href="/growth">Content tools</Link>
          <Link href="/digital-products">Digital kits</Link>
        </div>
      </nav>

      <section className="digital-hero platform-hero">
        <div className="digital-eyebrow"><span /> THE LITIX GROWTH PLATFORM</div>
        <h1>One platform.<br /><span>Every next move.</span></h1>
        <p>Social marketing services, creator tools, digital resources, and agency workflows—connected through one premium experience built to help you plan, execute, and learn.</p>
        <div className="platform-hero-actions">
          <Link className="digital-primary" href="#workspaces">Explore the platform <span aria-hidden="true">↘</span></Link>
          <Link className="platform-secondary" href="/digital-products">Browse digital products <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="digital-proofline"><span>PLAN WITH CLARITY</span><i /> <span>EXECUTE WITH FOCUS</span><i /> <span>LEARN FROM DATA</span></div>
        <div className="digital-orbit" aria-hidden="true"><div className="orbit-ring orbit-ring-one" /><div className="orbit-ring orbit-ring-two" /><div className="orbit-core">L<span>✦</span></div><b className="orbit-label orbit-label-a">FOCUS</b><b className="orbit-label orbit-label-b">MOMENTUM</b><b className="orbit-label orbit-label-c">SYSTEMS</b></div>
      </section>

      <section className="digital-products-section platform-workspaces" id="workspaces">
        <div className="digital-section-heading">
          <div><div className="digital-eyebrow">YOUR GROWTH WORKSPACE</div><h2>Everything starts with the next right move.</h2></div>
          <p>Choose the workspace that matches your goal today. More connected reporting and automation capabilities belong on the roadmap—not advertised as live before they are ready.</p>
        </div>
        <div className="digital-product-grid">
          {workspaces.map((item) => (
            <article className="digital-product-card platform-workspace-card" key={item.number}>
              <div className="digital-card-top"><span className="digital-tier">{item.label}</span><span className="digital-index">{item.number}</span></div>
              <div className="digital-product-symbol" aria-hidden="true">{item.mark}</div>
              <h3>{item.title}</h3>
              <p className="digital-product-summary">{item.description}</p>
              <Link className="digital-product-cta" href={item.href}>{item.action} <span aria-hidden="true">↗</span></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="digital-steps platform-principles">
        <div className="digital-eyebrow">THE LITIX STANDARD</div>
        <h2>Premium should mean more than appearance.<br /><span>It should mean dependable execution.</span></h2>
        <div className="digital-step-grid">
          <article><span>01</span><h3>Clarity first</h3><p>Understand what each service or product includes, what it costs, and what outcomes it can reasonably support.</p></article>
          <article><span>02</span><h3>Built for trust</h3><p>Keep payment data protected, make availability clear, and avoid promises that cannot be verified.</p></article>
          <article><span>03</span><h3>Improve continuously</h3><p>Build toward measurable performance, useful reporting, accessible design, and reliable support.</p></article>
        </div>
      </section>

      <section className="digital-early-access platform-next">
        <div className="digital-early-copy">
          <div className="digital-eyebrow">KEEP BUILDING WITH LITIX</div>
          <h2>Make your next move count.</h2>
          <p>Start with the tools available today, and watch this space as the platform expands. Digital product purchases remain closed until final files, terms, and secure checkout are approved.</p>
          <div className="digital-early-links"><Link href="/">Explore social services ↗</Link><Link href="/digital-products">View digital kits ↗</Link></div>
        </div>
      </section>

      <footer className="digital-footer"><Link className="digital-brand" href="/">LITIX<span>✦</span></Link><span>Analytics Amplified · Innovation Ignited · Metrics that Move</span><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/refunds">Refunds</Link></div></footer>
    </main>
  );
}
