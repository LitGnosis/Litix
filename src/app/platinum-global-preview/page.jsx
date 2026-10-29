import {notFound} from "next/navigation";
import {SUPPLIER_REGISTRY,supplierEvaluation} from "../../lib/platinumSupplierQualification.mjs";
export const dynamic="force-dynamic";
export const metadata={title:"Litix Platinum Global | Qualification Preview",robots:{index:false,follow:false}};
const rank={boostero:"CURRENT PRODUCTION",morethanpanel:"BEST-DOCUMENTED ALTERNATIVE",justanotherpanel_live:"IDENTITY REVIEW",smmwiz:"ACCOUNT PROOF REQUIRED"};
export default function PlatinumGlobalPreview(){
 if(process.env.VERCEL_ENV!=="preview")notFound();
 const providers=[...SUPPLIER_REGISTRY].sort((a,b)=>
  ({boostero:0,morethanpanel:1,justanotherpanel_live:2,smmwiz:3}[a.code]??9)-
  ({boostero:0,morethanpanel:1,justanotherpanel_live:2,smmwiz:3}[b.code]??9));
 return <main className="platinum">
  <style>{`
   .platinum{min-height:100vh;color:#eef7ff;font-family:Inter,system-ui,Arial,sans-serif;
     background:radial-gradient(ellipse 80% 70% at 25% 0%,#19427e 0%,#091930 52%,#050916 100%);
     padding:clamp(18px,5vw,64px);box-sizing:border-box}
   .platinum *{box-sizing:border-box}
   .shell{max-width:1180px;margin:0 auto}
   .platinum a{color:#a7e2ff}
   .top{border:1px solid #729bc6;border-radius:22px;
     background:linear-gradient(130deg,#173c75b8,#091a36ee);
     box-shadow:0 20px 60px #0008,inset 0 1px 0 #93bdf255;padding:clamp(22px,5vw,50px)}
   .overline{letter-spacing:.19em;text-transform:uppercase;font-weight:800;color:#91dfff;font-size:11px}
   .platinum h1{font-size:clamp(31px,5.4vw,60px);letter-spacing:-.045em;margin:14px 0}
   .platinum h2{font-size:clamp(20px,2.8vw,28px);letter-spacing:-.02em;margin:32px 0 16px}
   .lead{font-size:clamp(15px,2.2vw,19px);line-height:1.6;color:#c9dbf3;max-width:780px}
   .notice{background:#0c2e58;border:1px solid #457fb5;padding:14px 18px;
    border-radius:10px;color:#c6e8ff;font-size:14px;line-height:1.5;margin:24px 0}
   .providers{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:14px}
   .provider{border:1px solid #466e9e;border-radius:16px;padding:24px;
    background:linear-gradient(145deg,#163660,#0b1730);box-shadow:0 12px 30px #0005}
   .provider.live{border-color:#80caf3;background:linear-gradient(145deg,#1a477a,#0d2444)}
   .tag{display:inline-block;color:#a5dfff;font-size:10px;font-weight:800;letter-spacing:.12em;
     padding:6px 9px;background:#194c7c;border:1px solid #4c82ab;border-radius:20px}
   .provider h3{font-size:22px;margin:18px 0 12px}
   .provider p,.fine{color:#b9cfeb;font-size:14px;line-height:1.55}
   .meta{display:flex;justify-content:space-between;gap:10px;align-items:center;border-top:1px solid #355779;
     margin-top:18px;padding-top:14px;font-size:13px}
   .state{color:#ffd999;font-weight:700}
   .state.live{color:#95dbff}
   .platinum ul{line-height:1.9;color:#c3d7f1}
   .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,310px),1fr));gap:15px}
   .step{padding:22px;border:1px solid #355a88;border-radius:14px;background:#0b1e3b}
   .platinum footer{margin:35px 0;color:#a2bfdd;font-size:13px}
  `}</style>
  <div className="shell">
   <section className="top"><div className="overline">LITIX • PLATINUM GLOBAL • PRIVATE RELEASE PREVIEW</div>
    <h1>Global ambition. Proven operations.</h1>
    <p className="lead">Build beyond a commodity SMM panel: clear pricing, reliable fulfillment, authenticated analytics, premium creator workflows, and transparent support. Verify every promise before customers see it.</p>
    <div className="notice">Production is NOT modified by this dashboard. All new customer orders remain Boostero-only. Candidate suppliers are research-only, without account-specific pricing or order permission.</div>
   </section>
   <h2>Provider qualification</h2>
   <section className="providers" aria-label="Supplier comparisons">
    {providers.map(p=>{const evaluation=supplierEvaluation(p.code);return <article className={"provider "+(p.code==="boostero"?"live":"")} key={p.code}>
      <span className="tag">{rank[p.code]}</span><h3>{p.name}</h3>
      <p>{p.review}</p>
      <div className="meta"><span>New customer orders</span><strong className={"state "+(p.code==="boostero"?"live":"")}>{p.enabledForNewOrders?"Existing allowlist only":"Disabled"}</strong></div>
      <div className="meta"><span>Required evidence missing</span><strong>{evaluation.missing.length} checks</strong></div>
      <p className="fine"><a href={p.documentation} target="_blank" rel="noreferrer">Official documentation</a></p>
     </article>})}
   </section>
   <h2>World-class release gates</h2>
   <section className="grid">
    <article className="step"><div className="overline">01 • Financial integrity</div><h3>Zero uncertain double-charges</h3><p className="fine">Idempotent checkout, verified gateway response, supplier dispatch ledger, recoverable webhook handling, owner alerts and manual review of ambiguous outcomes.</p></article>
    <article className="step"><div className="overline">02 • Creator intelligence</div><h3>Real analytics, not invented claims</h3><p className="fine">Use authorized account connections and supported platform APIs. Clearly label estimated data versus verified platform metrics.</p></article>
    <article className="step"><div className="overline">03 • Global operations</div><h3>Service-level transparency</h3><p className="fine">Verified delivery windows, per-region reliability measurement, currency disclosure, accessibility, mobile Safari checks and documented support escalation.</p></article>
   </section>
   <footer>Preview only • No API keys, account data, orders, payments or supplier dispatch are exposed or executed.</footer>
  </div>
 </main>;
}
