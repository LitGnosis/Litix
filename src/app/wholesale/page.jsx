import DirectRevenuePortal from "../../components/DirectRevenuePortal";
import "../direct-revenue.css";
export const metadata={title:"Litix Direct Wholesale | White-label Partner Portal",
 description:"First-party Litix wholesale partnership, transparent margin modeling and verified recurring licensing.",
 alternates:{canonical:"https://www.litix.net/wholesale"}};
export default function Wholesale(){
 return <main className="litix-revenue">
  <header><a href="/" className="brand">LITIX<span>.NET</span></a><nav><a href="/agency">Agency</a><a href="/ai-content-studio">AI Studio</a><a href="/direct-services">Litix Direct</a></nav></header>
  <section className="hero"><p className="overline">LITIX DIRECT / WHOLESALE</p>
  <h1>Build your brand on Litix-owned infrastructure.</h1>
  <p>White-label accounts, tracked wallet balances, license provisioning and a first-party work queue. Revenue is earned through actual deliverables—not purchased reseller traffic.</p>
  </section>
  <DirectRevenuePortal mode="wholesale"/>
  <footer>All rates are proposals subject to verified capacity, live merchant approval and partner terms. No purchased followers, views or artificial engagement are promised.</footer>
 </main>
}
