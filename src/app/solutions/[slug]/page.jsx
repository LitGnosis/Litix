import Link from "next/link";
import {notFound} from "next/navigation";
import {getLitixSolution,LITIX_SOLUTION_SLUGS} from "../../../lib/litixSolutions.mjs";
import LitixSolutionsInquiry from "../../../components/LitixSolutionsInquiry";
import "../solutions.css";

export const dynamicParams=false;
export function generateStaticParams(){return LITIX_SOLUTION_SLUGS.map(slug=>({slug}));}
export async function generateMetadata({params}){
 const {slug}=await params;
 const s=getLitixSolution(slug);
 if(!s)return {title:"Litix Solutions"};
 return {title:s.name+" | Litix Solutions",description:s.summary,alternates:{canonical:"https://www.litix.net/solutions/"+slug}};
}
export default async function SolutionDetail({params}){
 const {slug}=await params;
 const s=getLitixSolution(slug);
 if(!s)notFound();
 return <main className="ls-main">
  <nav className="ls-nav" aria-label="Litix solutions">
   <Link className="ls-brand" href="/"><img src="/assets/brand/litix-logo.webp" alt="Litix home" width="126" height="68"/></Link>
   <div><Link href="/solutions">All solutions</Link><Link href="/shop">Shop</Link><Link href="/partners">Partnerships</Link></div>
  </nav>
  <section className="ls-hero ls-detail-hero">
   <span className="ls-eyebrow">{s.group.toUpperCase()} · EARLY-ACCESS PROPOSALS</span>
   <h1>{s.headline}</h1>
   <p>{s.summary}</p>
   <div className="ls-actions"><a className="ls-cta" href="#request">Request a proposal</a><Link className="ls-link" href="/solutions">Browse all solutions</Link></div>
  </section>
  <div className="ls-detailgrid">
   <section className="ls-panel">
    <h2>What we're exploring</h2>
    <ul className="ls-list">{s.scope.map(item=><li key={item}>{item}</li>)}</ul>
    <p><strong>Best suited for:</strong> {s.fit}</p>
    <p><strong>Business model:</strong> {s.model}</p>
    <p className="ls-note">This is a pilot or proposed service. The inquiry does not activate subscriptions, automatic fulfillment, hosted stores, creator payouts, or other unbuilt features. Rates, scope and terms are confirmed individually before any purchase.</p>
    {slug==="local"&&<p><Link href="/tools/local-visibility">Open the free local visibility checklist</Link>.</p>}
    {slug==="growth-analyzer"&&<p><Link href="/tools/tiktok-engagement">TikTok engagement calculator</Link> · <Link href="/growth">Content calendar</Link></p>}
   </section>
   <section className="ls-panel" id="request">
    <span className="ls-eyebrow">NEXT STEP · NO PAYMENT</span>
    <h2>Tell us about your project</h2>
    <p>Our team reviews requests before offering any terms. Please share only ordinary business information.</p>
    <LitixSolutionsInquiry solution={s.slug}/>
   </section>
  </div>
  <footer className="ls-footer"><Link href="/solutions">Solutions hub</Link><Link href="/legal/privacy">Privacy</Link><Link href="/terms">Terms</Link></footer>
 </main>;
}
