import Link from "next/link";
import LitixGrowthStudio from "../../components/LitixGrowthStudio";
import "../partners/partners.css";
import "./studio.css";

export const metadata={
 title:"Litix Growth Studio | First-Party Content Planning Technology",
 description:"Turn a campaign brief into channel-specific creative scripts and tagged campaign links. Try Litix's own content workflow preview and request a scoped business proposal.",
 alternates:{canonical:"https://www.litix.net/growth-studio"},
 robots:{index:true,follow:true}
};
export default function GrowthStudioPage(){
 return <main className="wrap partner-page studio-page">
  <nav className="nav" aria-label="Litix growth studio">
   <Link href="/" className="brand">LITIX</Link>
   <div><Link href="/agency-growth">Business proposals</Link><Link href="/for-agencies">For agencies</Link><Link href="/shop">Shop</Link><Link href="/track">Order support</Link></div>
  </nav>
  <LitixGrowthStudio/>
  <footer className="partner-footer"><Link href="/">Home</Link><Link href="/company">Company</Link><Link href="/terms">Terms</Link><Link href="/legal/privacy">Privacy</Link></footer>
 </main>;
}
