import Link from "next/link";
import {litixNativeSupplySnapshot} from "../../../lib/litixNativeSupplyCapacity.mjs";
import "../../solutions/solutions.css";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const metadata={
 title:"Litix Native Supplier Readiness | Independent Supply",
 description:"See what Litix produces itself, which independent campaigns require verified capacity, and how creator and agency partners can apply.",
 alternates:{canonical:"https://www.litix.net/native/supply"}
};
export default function LitixNativeSupplyPage(){
 const supply=litixNativeSupplySnapshot({env:process.env});
 return <main className="ls-main">
  <nav className="ls-nav" aria-label="Independent Litix supplier status">
   <Link href="/" className="ls-brand">LITIX</Link>
   <div><Link href="/native">Native studio</Link><Link href="/publishers">Creators</Link><Link href="/wholesale">Agencies</Link></div>
  </nav>
  <section className="ls-hero ls-detail-hero">
   <span className="ls-eyebrow">LITIX NATIVE · VERIFIED CAPACITY</span>
   <h1>Independent supply, without unverified promises.</h1>
   <p>Litix has first-party software for original creator assets. Paid distribution campaigns will appear here only when a real creator or publisher agreement, delivery capacity, cost review, and platform permissions are verified.</p>
  </section>
  <section className="ls-panel">
   <h2>What Litix can create in-house now</h2>
   <div className="ls-grid">
    {supply.ownedFreeServices.map(s=><article className="ls-card" key={s.id}>
     <h3>{s.title}</h3>
     <p>Generated directly by Litix · Free self-service preview</p>
    </article>)}
   </div>
   <p><Link href="/native">Try Litix Native's free tools</Link></p>
  </section>
  <section className="ls-panel">
   <h2>Premium and agency fulfillment status</h2>
   <p>Commercial checkout: <strong>Not activated</strong>. Wholesale partner order submission: <strong>Not activated</strong>.</p>
   <p>A separate 30-day campaign kit has been prepared for future paid digital fulfillment, but customers are not being charged for it.</p>
   <p>Verified promotional placement capacity listed: <strong>{supply.verifiablePlacementCount}</strong>.</p>
   {supply.publisherPlacements.length?<>
    <h3>Reviewed promotional proposals</h3>
    <p>Even approved proposals require a separately accepted campaign agreement and payment flow before booking. These are not guaranteed engagement packages.</p>
    <ul>{supply.publisherPlacements.map(x=><li key={x.id}>{x.title} · {x.channel} · {x.leadDays}+ days lead time · Review required</li>)}</ul>
   </>:<p>No creator or publisher inventory has yet been activated for customer purchases. This prevents orders for unverified campaigns.</p>}
   <p><Link href="/native/premium">Explore the upcoming premium product</Link></p>
  </section>
  <section className="ls-panel">
   <h2>How we build real worldwide supply</h2>
   <ol className="ls-list">
    <li>Invite eligible creators, publishers, and agencies to propose real, authorized campaign inventory.</li>
    <li>Review their identity, portfolio, content rights, regional audience, capacity and sponsorship disclosures.</li>
    <li>Verify written terms, costs, profit margin and realistic delivery times before activating an offer.</li>
    <li>Accept a customer campaign only when a secure booking and independently verified payment flow are operational.</li>
    <li>Track contracted deliverables, customer approvals, evidence, payments, refunds and support.</li>
   </ol>
   <div className="ls-actions">
    <Link className="ls-cta" href="/publishers#apply">Apply as a creator or publisher</Link>
    <Link className="ls-link" href="/wholesale">Apply for agency access</Link>
   </div>
   <p className="ls-note">This is a first-party creator-services and authorized promotion network, not a service that manufactures likes, follows, views or other artificial engagement. Existing storefront orders remain with their current authorized fulfillment route.</p>
  </section>
  <footer className="ls-footer"><Link href="/legal/privacy">Privacy</Link><Link href="/terms">Terms</Link></footer>
 </main>;
}
