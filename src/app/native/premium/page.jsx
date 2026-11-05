import Link from "next/link";
import LitixNativePremiumCheckout from "../../../components/LitixNativePremiumCheckout";
import "../../solutions/solutions.css";
export const metadata={
 title:"Litix Native Pro | 30-Day Campaign Kit",
 description:"Preview the planned Litix Native Pro campaign kit. Original thirty-day editorial plans, with future secure checkout following settlement and delivery verification.",
 alternates:{canonical:"https://www.litix.net/native/premium"}
};
export default function NativePremium(){
 return <main className="ls-main">
  <nav className="ls-nav"><Link className="ls-brand" href="/">LITIX</Link>
   <div><Link href="/native">Free studio</Link><Link href="/wholesale">Agencies</Link><Link href="/partners">Partners</Link></div></nav>
  <section className="ls-hero ls-detail-hero">
   <span className="ls-eyebrow">LITIX NATIVE · PREMIUM ORIGINAL CONTENT</span>
   <h1>Thirty days of content planning, produced by Litix.</h1>
   <p>A separate 30-day creative campaign kit with original editorial angles, reusable captions, production guidance and optional tracked links. It's designed for independent creators and marketing agencies.</p>
   <p className="ls-note">This product is being prepared for paid self-service checkout. Payment is not accepted until server-verified pricing, approved settlement and private file delivery are fully activated.</p>
   <div className="ls-actions"><Link className="ls-cta" href="/wholesale">Request a partnership preview</Link>
    <Link className="ls-link" href="/native">Try the free 7-day planner</Link></div>
  </section>
  <section className="ls-panel"><h2>What you will receive</h2>
   <ul className="ls-list">
    <li>Thirty distinct content topics and practical editorial prompts.</li>
    <li>Human-editable caption drafts for your selected social platform.</li>
    <li>Production notes covering originality, licensing and disclosures.</li>
    <li>Optional campaign links with day-level attribution parameters.</li>
   </ul>
   <p>Litix Native produces original digital assets. It does not sell invented followers, fake views, or a guarantee of social media reach.</p>
  </section>
  <LitixNativePremiumCheckout/>
 </main>;
}
