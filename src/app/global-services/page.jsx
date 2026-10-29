"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import "./global-services.css";
const priority=["Instagram","TikTok","YouTube"];
const fmt=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
export default function GlobalServices(){
 const [platform,setPlatform]=useState(""),[category,setCategory]=useState(""),[kind,setKind]=useState("");
 const [query,setQuery]=useState(""),[appliedQuery,setAppliedQuery]=useState(""),[sort,setSort]=useState("featured");
 const [page,setPage]=useState(1),[catalog,setCatalog]=useState(null);
 const [error,setError]=useState(""),[loading,setLoading]=useState(true),[expanded,setExpanded]=useState(false);
 const parameters=useMemo(()=>new URLSearchParams({page:String(page),sort,platform,category,kind,q:appliedQuery}),[page,sort,platform,category,kind,appliedQuery]);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);
  fetch("/api/catalog/global?"+parameters.toString(),{cache:"no-store",signal:controller.signal})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error("Boostero catalog is temporarily unavailable. No orders can be placed from this page.");return d})
   .then(d=>{setCatalog(d);setError("");setLoading(false)})
   .catch(e=>{if(e.name!=="AbortError"){setError(e.message);setCatalog(null);setLoading(false)}});
  return()=>controller.abort();
 },[parameters]);
 const allPlatforms=Object.entries(catalog?.platforms||{}).sort(([a],[b])=>
  (priority.indexOf(a)===-1?9:priority.indexOf(a))-(priority.indexOf(b)===-1?9:priority.indexOf(b))||a.localeCompare(b));
 const allKinds=Object.entries(catalog?.kinds||{});
 const pagination=Math.max(1,Math.ceil((catalog?.filteredTotal||0)/24));
 const change=(setter,value)=>{setter(value);setPage(1)};
 const visible=expanded?allPlatforms:allPlatforms.slice(0,11);
 return <main className="lgc">
  <div className="lgc-shell">
   <nav className="lgc-nav" aria-label="Global Litix navigation">
    <Link href="/" className="lgc-logo"><img src="/assets/brand/litix-logo.webp" width="116" height="48" alt="Litix home"/></Link>
    <div className="lgc-links"><Link href="/">Home</Link><Link href="/analytics">Analytics</Link><Link href="/growth">Growth Calendar</Link><Link href="/track">Order tracking</Link></div>
   </nav>
   <header className="lgc-hero">
    <span className="lgc-eyebrow">LITIX PLATINUM GLOBAL · BOOSTERO EXCLUSIVE</span>
    <h1>One global catalog.<br/><span>Built around your goals.</span></h1>
    <p>Explore services from our connected supplier across Instagram, TikTok, YouTube and more. Choose a platform, filter by service, and view which offerings are verified for checkout.</p>
    <div className="lgc-trust"><span>Verified supplier source</span><span>Clear checkout eligibility</span><span>No surprise payment attempts</span></div>
   </header>
   <section className="lgc-summary" aria-label="Supplier catalog coverage">
    <div><small>Live supplier listings</small><strong>{catalog?.supplierTotal?.toLocaleString()??"—"}</strong></div>
    <div><small>Valid listings</small><strong>{catalog?.validTotal?.toLocaleString()??"—"}</strong></div>
    <div><small>Approved for checkout</small><strong>{catalog?.approvedLiveCount?.toLocaleString()??"—"}</strong></div>
   </section>
   <section className="lgc-filter-section" aria-label="Find a service">
    <div className="lgc-section-title"><span className="lgc-eyebrow">01 / DISCOVER</span><h2>Choose your platform</h2></div>
    <div className="lgc-platforms">
     <button type="button" className={!platform?"selected":""} onClick={()=>{change(setPlatform,"");setCategory("")}}>All platforms</button>
     {visible.map(([p,count])=><button key={p} className={platform===p?"selected":""} type="button" onClick={()=>{change(setPlatform,p);setCategory("")}}>{p} <span>{count}</span></button>)}
     {allPlatforms.length>11&&<button type="button" className="lgc-more" onClick={()=>setExpanded(s=>!s)}>{expanded?"Show fewer":"+ "+(allPlatforms.length-11)+" more"}</button>}
    </div>
   </section>
   <section className="lgc-filter-section" aria-label="Filter supplier services">
    <div className="lgc-section-title"><span className="lgc-eyebrow">02 / FIND YOUR SERVICE</span><h2>Find the right service</h2></div>
    <form className="lgc-filters" onSubmit={e=>{e.preventDefault();change(setAppliedQuery,query)}}>
     <label className="lgc-search">Search
      <input aria-label="Search catalog" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search followers, views, subscriptions…" maxLength={80}/></label>
     <label>Service type<select aria-label="Filter by service type" value={kind} onChange={e=>change(setKind,e.target.value)}><option value="">All service types</option>
      {allKinds.map(([k,n])=><option key={k} value={k}>{k.replace(/_/g," ")} ({n})</option>)}</select></label>
     <label>Category
      <input aria-label="Filter exact category" placeholder="Enter category from a listing" value={category} onChange={e=>change(setCategory,e.target.value)} maxLength={140}/></label>
     <label>Sort by<select aria-label="Sort catalog" value={sort} onChange={e=>change(setSort,e.target.value)}>
      <option value="featured">Featured platforms</option><option value="price_low">Approved price: low to high</option><option value="price_high">Approved price: high to low</option></select></label>
     <button type="submit" className="lgc-search-button">Search services</button>
    </form>
    <div className="lgc-notice">We display the complete verified supplier inventory for discovery. Only listings marked <b>Ready to purchase</b> can use checkout. Other listings remain unavailable until their specific pricing and fulfillment flow is approved.</div>
    <div className="lgc-result-head"><h2>Browse services</h2><span>{loading?"Checking Boostero…":(catalog?.filteredTotal??0).toLocaleString()+" results"}</span></div>
    {error?<div role="alert" className="lgc-error">{error}</div>:null}
    <div className="lgc-grid" aria-busy={loading}>
     {!loading&&(catalog?.items||[]).map(item=><article key={item.id} className="lgc-card">
      <div className="lgc-card-top"><span>{item.platform}</span><span>{item.kind.replace(/_/g," ")}</span></div>
      <h3>{item.name}</h3>
      <p className="lgc-category">{item.category}</p>
      <div className="lgc-details">
       <span>Supplier range</span><b>{Number(item.supplierMinimum).toLocaleString()}–{Number(item.supplierMaximum).toLocaleString()}</b>
       <span>Order type</span><b>{item.type}</b>
       {item.refill&&<span>Refill</span>}{item.refill&&<b>Supplier listed</b>}
      </div>
      {item.purchasable?<div className="lgc-card-action"><strong>{fmt(item.pricePer1000)} / 1,000</strong><Link href={item.checkoutPath||"/"}>Shop verified service</Link></div>:
       <div className="lgc-card-pending"><span>Pricing &amp; checkout verification in progress</span><small>Not purchasable yet. No payment attempted.</small></div>}
     </article>)}
    </div>
    {!loading&&!catalog?.items?.length&&!error&&<p className="lgc-empty">No services match these filters. Try another platform or search term.</p>}
    <nav className="lgc-pages" aria-label="Catalog pagination">
     <button type="button" disabled={page<=1||loading} onClick={()=>setPage(n=>Math.max(1,n-1))}>Previous</button>
     <span>Page {page} of {pagination}</span>
     <button type="button" disabled={page>=pagination||loading} onClick={()=>setPage(n=>n+1)}>Next</button>
    </nav>
   </section>
   <footer className="lgc-footer"><span>Litix Global · Secure creator services · Boostero supplier catalog</span><Link href="/track">Track an order</Link></footer>
  </div>
 </main>;
}
