"use client";
import Link from "next/link";

const audiences = {
  individuals: {
    eyebrow: "LITIX FOR EVERYDAY GROWTH",
    title: "Your goals. One growth workspace.",
    intro: "Discover promotion services, keep useful services close, and return to your order tracking from one place.",
    benefits: ["Browse the available service catalog", "Save favorites and revisit recent services", "Keep tracking links handy on this browser"],
    next: "A full account with cross-device history and personalized recommendations is part of the planned platform roadmap—not yet an account feature."
  },
  creators: {
    eyebrow: "LITIX FOR CREATORS",
    title: "Make every move count.",
    intro: "Bring your creator workflow together, from discovering promotion options to keeping campaigns and tracking links organized.",
    benefits: ["Explore services for your social channels", "Save frequently used services", "Keep order tracking links available in your workspace"],
    next: "Connected social analytics, AI content planning, publishing calendars, and media kits are planned capabilities; this page does not claim those integrations are live."
  },
  agencies: {
    eyebrow: "LITIX FOR AGENCIES",
    title: "A clearer workflow for client growth.",
    intro: "Use Litix to explore services and keep order references organized while you plan a more unified agency workflow.",
    benefits: ["Browse the current service catalog", "Revisit saved and recently viewed services", "Retain tracking links in the current browser"],
    next: "Multi-client accounts, staff permissions, approval flows, white-label reporting, and consolidated billing are roadmap items, not active agency features yet."
  },
  businesses: {
    eyebrow: "LITIX FOR BUSINESSES",
    title: "Turn your next growth goal into a plan.",
    intro: "Start with your objective, explore relevant services, and organize your next steps in the Litix workspace.",
    benefits: ["Explore available promotion services", "Use the on-page growth-plan starter", "Keep favorites and tracking links close"],
    next: "Connected conversion analytics, CRM integrations, lead attribution, and ROI dashboards require additional integrations and are not represented as currently active."
  }
};

export default function AudienceLanding({ audience }) {
  const data = audiences[audience];
  return <main className="audience-page">
    <header className="audience-header">
      <Link className="audience-brand" href="/">LITIX</Link>
      <nav aria-label="Audience navigation">
        <Link href="/for-individuals">Individuals</Link><Link href="/for-creators">Creators</Link><Link href="/for-agencies">Agencies</Link><Link href="/for-businesses">Businesses</Link>
      </nav>
    </header>
    <section className="audience-hero panel">
      <p className="eyebrow">{data.eyebrow}</p>
      <h1>{data.title}</h1>
      <p className="audience-intro">{data.intro}</p>
      <div className="audience-actions"><Link className="primary" href="/">Explore Litix services</Link><Link className="alt" href="/#workspace">Open growth workspace</Link></div>
    </section>
    <section className="audience-content panel">
      <h2>What you can do today</h2>
      <ul>{data.benefits.map(item => <li key={item}>{item}</li>)}</ul>
      <div className="audience-roadmap"><h2>Building toward more</h2><p>{data.next}</p></div>
      <p className="audience-phrase">Analytics Amplified. Innovation Ignited. Metrics that Move.</p>
    </section>
    <footer className="audience-footer"><Link href="/">Back to Litix</Link><span>Instant Delivery. Programmatic Refills. Stealth Execution.</span></footer>
  </main>;
}
