"use client";
import {useEffect,useMemo,useState} from "react";
import {safeBoosteroLink,priceAt60Percent} from "../../lib/boosteroPremiumCatalog.mjs";
import "./premium.css";
const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n/100);
const priority=["Instagram Followers","Instagram Likes","TikTok Followers","TikTok Likes"];
export default function PremiumPreview(){
 const [platform,setPlatform]=useState("All platforms"),[category,setCategory]=useState(""),
 [search,setSearch]=useState(""),[page,setPage]=useState(1),[result,setResult]=useState(null),
 [status,setStatus]=useState("Loading verified supplier services"),[selected,setSelected]=useState(null),
 [quantity,setQuantity]=useState(0),[destination,setDestination]=useState(""),[step,setStep]=useState(1);
 useEffect(()=>{
  let active=true;const ctrl=new AbortController();
  const p=new URLSearchParams({platform,category,q:search,page:String(page)});
  setStatus("Refreshing verified supplier listings");
  fetch("/api/premium/catalog?"+p,{signal:ctrl.signal})
   .then(async res=>{const data=await res.json();if(!res.ok)throw Error(data.message||"Supplier unavailable");return data})
   .then(v=>{if(active){setResult(v);setStatus(v.total?"Live supplier listing verified":"Temporarily unavailable")}})
   .catch(()=>{if(active){setResult({items:[],categories:[],platforms:[],total:0,page:1});setStatus("Supplier catalog temporarily unavailable")}});
  return()=>{active=false;ctrl.abort()};
 },[platform,category,search,page]);
 const quotation=useMemo(()=>{try{return selected?priceAt60Percent(selected.per1000/1.6,quantity):null}catch{return null}},[selected,quantity]);
 const url=safeBoosteroLink(destination,selected?.platform,selected?.kind);
 const quantityValid=selected&&Number.isSafeInteger(quantity)&&quantity>=selected.min&&quantity<=selected.max&&
  (quantity-selected.supplierMin)%selected.unitStep===0&&quotation?.retailCents>=500;
 const categories=result?.categories||[];
 const selectService=s=>{setSelected(s);setQuantity(s.min);setDestination("");setStep(3)};
 return <main className="premium-wrap">
  <nav className="premium-nav"><a href="/" aria-label="Litix home"><img src="/assets/brand/litix-logo.webp" alt="Litix"/></a><a href="/" className="premium-back">Back to Litix storefront</a></nav>
  <header className="premium-head">
   <div className="premium-label">LITIX PRIVATE RELEASE PREVIEW · SUPPLIER-MAPPED</div>
   <h1>THE NEXT LEVEL OF SOCIAL GROWTH.</h1>
   <p>Explore verified live supplier listings in a blue-metallic, four-step shopping experience. This preview cannot submit payments or supplier orders.</p>
   <div className="premium-stats"><span>Live service rates</span><span>Customer price = supplier rate + 60%</span><span>$5 minimum order</span></div>
  </header>
  <div className="premium-steps" role="group" aria-label="Four-step order preview">
   {["Choose platform","Category & service","Order details","Review"].map((x,i)=><button type="button" key={x}
     className={step===i+1?"active":""} onClick={()=>setStep(i+1)} aria-current={step===i+1?"step":undefined}>
      <span>{String(i+1).padStart(2,"0")}</span>{x}</button>)}
  </div>
  <section className="premium-panel">
   <div className="premium-section-title"><span>STEP 01 / NETWORK</span><h2>Choose your platform</h2></div>
   <div className="premium-platforms">
    {["Instagram","TikTok",...(result?.platforms||[]).filter(x=>x!=="Instagram"&&x!=="TikTok"),"All platforms"].map(p=>
     <button type="button" key={p} className={platform===p?"active":""}
     onClick={()=>{setPlatform(p);setCategory("");setPage(1);setStep(2)}}>
      <span className="premium-platform-dot"/> {p==="All platforms"?"All Services":p}</button>)}
   </div>
  </section>
  <section className="premium-panel">
   <div className="premium-section-title"><span>STEP 02 / SELECT</span><h2>Find your service</h2><p>Four featured categories appear first. Other eligible Default-type services follow, with lowest retail price first within each category.</p></div>
   <div className="premium-filters">
    <input aria-label="Search live supplier services" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Search services..."/>
    <select aria-label="Choose category" value={category} onChange={e=>{setCategory(e.target.value);setPage(1)}}>
     <option value="">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}
    </select>
   </div>
   <div className="premium-featured">
    {priority.map(cat=><button key={cat} type="button" className={category===cat?"active":""}
     onClick={()=>{setPlatform(cat.split(" ")[0]);setCategory(cat);setPage(1);setStep(2)}}>{cat}</button>)}
   </div>
   <p className="premium-status" role="status">{status} · {result?.total??0} matching services</p>
   <div className="premium-cards">{(result?.items||[]).map(s=><article key={s.id} className="premium-card">
    <div className="premium-kind">{s.category}</div><h3>{s.name}</h3>
    <div className="premium-card-rate"><strong>{money(Math.ceil(s.per1000*100))}</strong><small>/ 1,000 units</small></div>
    <p>{s.min.toLocaleString()}–{s.max.toLocaleString()} units · From {money(s.startingAmountCents)} at {s.min.toLocaleString()} units</p>
    <div className="premium-tags"><span>{s.refill?"API refill available":s.refillClaim?"Refill advertised":"No verified refill"}</span>
      {s.refillDays&&<span>{s.refillDays} day claim</span>}{s.noDrop&&<span>Supplier non-drop claim</span>}</div>
    <button type="button" className="premium-primary" onClick={()=>selectService(s)}>Configure order</button>
   </article>)}</div>
   {!result?.items?.length&&<div className="premium-empty">Temporarily unavailable. No service or price will be invented.</div>}
   <div className="premium-pager"><button disabled={page<=1} onClick={()=>setPage(n=>n-1)}>Previous</button>
    <span>Page {page}</span><button disabled={page*24>=(result?.total||0)} onClick={()=>setPage(n=>n+1)}>Next</button></div>
  </section>
  <section className="premium-panel" id="premium-order">
   <div className="premium-section-title"><span>STEPS 03–04 / CONFIGURE & REVIEW</span><h2>Review a potential order</h2></div>
   {selected?<div className="premium-order-grid">
    <div><p className="premium-kind">{selected.category}</p><h3>{selected.name}</h3>
      <label>Quantity<input type="number" inputMode="numeric" min={selected.min} max={selected.max} step={selected.unitStep}
        value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label>
      <label>Supported public {selected.kind==="Followers"?"profile":"post / video"} link
       <input type="url" placeholder="https://..." value={destination} onChange={e=>setDestination(e.target.value)}/>
      </label>
      {destination&&!url&&<p className="premium-warning">Enter a direct public link on the selected platform. Do not enter a password.</p>}
      <button className="premium-secondary" type="button" disabled={!quantityValid||!url} onClick={()=>setStep(4)}>Review quote</button>
    </div>
    <div className="premium-summary"><h3>Retail preview</h3>
      <p>Service: {selected.name}</p><p>Quantity: {Number.isFinite(quantity)?quantity.toLocaleString():"—"}</p>
      <p>Per 1,000: {money(Math.ceil(selected.per1000*100))}</p>
      <strong>{quotation&&quantityValid?money(quotation.retailCents):"Below $5 minimum or invalid quantity"}</strong>
      <p>Refill: {selected.refill?"Available via supplier API":selected.refillClaim?"Supplier-advertised only":"Not verified"}</p>
      <button className="premium-primary" disabled>Checkout unavailable until security and payment validation pass</button>
      <small>No card or supplier API order is created on this preview.</small>
    </div>
   </div>:<p>Select an available supplier service above to configure the order.</p>}
  </section>
  <section className="premium-panel premium-faq"><div className="premium-section-title"><span>HELP CENTER</span><h2>Frequently asked questions</h2></div>
   {[
    ["Do I need to share my password?","Absolutely not! Litix only needs the applicable public username, profile, or post link. Never share your account password."],
    ["When will my order start?","Orders are submitted after payment is confirmed. Actual start and delivery times depend on the selected service."],
    ["What if I enter the wrong link?","Contact Litix support immediately. If an order has not started, we can check whether a correction or cancellation is possible."],
    ["What payment methods do you accept?","Only methods displayed in the existing live Litix checkout are accepted. No payment is accepted in this preview."],
    ["Are these services safe for my account?","Services vary and each social platform has its own rules. Purchased services cannot guarantee freedom from account restrictions."],
    ["Are the followers real profiles or automated accounts?","Service characteristics vary. Purchased engagement is not necessarily organic and does not guarantee future interaction."],
    ["Does my profile need to be public?","Most services need a public profile or post to process an order."],
    ["Will new followers like or comment?","Follower orders provide only their listed follower service. Other engagement requires an eligible separate service."],
    ["Can I cancel my order or request a refund?","Contact support. Eligibility depends on service terms, status, and Litix’s published refund policy."]
   ].map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
  </section>
  <footer className="premium-footer">LITIX · INNOVATION, IGNITED. · <a href="/terms">Terms</a> · <a href="/refunds">Refunds</a> · <a href="/">Back to live storefront</a></footer>
 </main>
}