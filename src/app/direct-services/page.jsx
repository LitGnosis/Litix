import Link from "next/link";
import LitixDirectStudio from "../../components/LitixDirectStudio";
import "./direct-services.css";

export const metadata = {
 title: "Litix Direct Services | First-Party SMM Creative Fulfillment",
 description: "Create and instantly receive twelve original social-media marketing creative drafts directly from Litix. No reseller, payment or social-platform account needed.",
 alternates: { canonical: "https://www.litix.net/direct-services" },
 robots: { index: true, follow: true }
};

export default function DirectServicesPage() {
 return <main className="litix-direct">
  <nav className="litix-direct-nav" aria-label="Litix direct services navigation">
   <Link href="/" aria-label="Litix home" className="litix-direct-brand"><img src="/assets/brand/litix-logo.webp" alt="Litix" width="128" height="50"/></Link>
   <div><Link href="/services">All Services</Link><Link href="/growth-studio">Growth Studio</Link><Link href="/track">Track Orders</Link></div>
  </nav>
  <header className="litix-direct-hero">
   <p className="litix-direct-eyebrow">LITIX DIRECT · FIRST-PARTY TECHNOLOGY</p>
   <h1>Social marketing creative, fulfilled by Litix.</h1>
   <p>Build a campaign brief and receive twelve ready-to-edit social media content drafts, video directions and measurable campaign links instantly. The software that creates this deliverable belongs to Litix. No third-party fulfillment account is involved.</p>
   <div className="litix-direct-points"><span>Instant digital delivery</span><span>12 drafts · 4 channels</span><span>No card required</span></div>
   <p className="litix-direct-note">This first-party service produces drafts—not artificial likes, followers or views. It does not publish posts or guarantee reach or sales.</p>
  </header>
  <LitixDirectStudio/>
  <footer className="litix-direct-footer"><Link href="/">Litix Home</Link><Link href="/agency-growth">Business Growth</Link><Link href="/terms">Terms</Link><Link href="/legal/privacy">Privacy</Link></footer>
 </main>;
}