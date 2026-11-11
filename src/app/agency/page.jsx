import DirectRevenuePortal from "../../components/DirectRevenuePortal";
import "../direct-revenue.css";
export const metadata={title:"Litix Direct Agency | Content Operations Retainers",
 description:"Managed first-party creative operations and authorized social post monitoring for agencies.",
 alternates:{canonical:"https://www.litix.net/agency"}};
export default function Agency(){
 return <main className="litix-revenue">
  <header><a href="/" className="brand">LITIX<span>.NET</span></a><nav><a href="/wholesale">Wholesale</a><a href="/ai-content-studio">AI Studio</a><a href="/direct-services">Litix Direct</a></nav></header>
  <section className="hero"><p className="overline">LITIX DIRECT / AGENCY OPERATIONS</p>
  <h1>One workflow for your agency's content operations.</h1>
  <p>Organize 25 or 100 authorized profiles, create content plans, monitor new posts when an owned source is connected, and review evidence-backed delivery. No bought streams, bot audiences, or guaranteed platform metrics.</p>
  </section>
  <DirectRevenuePortal mode="agency"/>
  <footer>Agency retainers require account-owner authorization and fulfillment capacity. The payment button stays locked until PayKings/NMI settlement and the production release gates are verified.</footer>
 </main>
}
