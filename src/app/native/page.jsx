import Link from "next/link";
import LitixNativeStudio from "../../components/LitixNativeStudio";
import "../solutions/solutions.css";
export const metadata={
 title:"Litix Native | Free Self-Service Digital Tools",
 description:"Create downloadable caption kits, 7-day campaign calendars and original link pages in Litix's independent first-party self-service studio. No supplier order or payment required.",
 alternates:{canonical:"https://www.litix.net/native"}
};
export default function LitixNativePage(){
 return <main className="ls-main">
  <nav className="ls-nav" aria-label="Litix Native navigation">
   <Link href="/" className="ls-brand"><img src="/assets/brand/litix-logo.webp" alt="Litix" width="126" height="68"/></Link>
   <div><Link href="/shop">Shop</Link><Link href="/solutions">Tools</Link><Link href="/partners">Partners</Link></div>
  </nav>
  <section className="ls-hero ls-detail-hero">
   <span className="ls-eyebrow">LITIX NATIVE · FIRST-PARTY DIGITAL SERVICES</span>
   <h1>Create. Download. Own your next asset.</h1>
   <p>Litix can produce its own original content kits, campaign plans and link-page files without relying on an outside SMM supplier. Try the independent self-service studio below at no charge.</p>
  </section>
  <LitixNativeStudio/>
  <section className="ls-panel">
   <h2>For agencies and businesses</h2>
   <p>Interested in recurring creative assets, agency reporting, or a verified creator partnership? Share your requirements so Litix can review the service scope before proposing terms.</p>
   <p><Link href="/wholesale">Request agency wholesale access</Link> or <Link href="/publishers">apply as a creator or publisher</Link> to help supply genuine campaigns.</p>
  </section>
  <footer className="ls-footer"><Link href="/legal/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/">Litix home</Link></footer>
 </main>;
}
