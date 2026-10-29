"use client";
import {useEffect,useState} from "react";
import ServiceDraft from "./ServiceDraft";
export default function CatalogExplorer(){
 const [platform,setPlatform]=useState("");
 const [kind,setKind]=useState("");
 const [query,setQuery]=useState("");
 const [term,setTerm]=useState("");
 const [page,setPage]=useState(1);
 const [stats,setStats]=useState(null);
 const [listing,setListing]=useState(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [selected,setSelected]=useState(null);
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/internal/boostero/catalog-audit",{cache:"no-store",signal:controller.signal})
   .then(r=>{if(!r.ok)throw Error("Catalog audit temporarily unavailable");return r.json()})
   .then(setStats).catch(e=>{if(e.name!=="AbortError")setError(e.message)});
  return()=>controller.abort();
 },[]);
 useEffect(()=>{
  const controller=new AbortController();
  const params=new URLSearchParams({view:"items",page:String(page),platform,kind,q:term});
  setLoading(true);
  fetch("/api/internal/boostero/catalog-audit?"+params.toString(),{cache:"no-store",signal:controller.signal})
   .then(r=>{if(!r.ok)throw Error("Unable to load available supplier listings");return r.json()})
   .then(x=>{setListing(x);setError("");setLoading(false)})
   .catch(e=>{if(e.name!=="AbortError"){setError(e.message);setLoading(false)}});
  return()=>controller.abort();
 },[page,platform,kind,term]);
 const platforms=Object.entries(stats?.platforms||{}).sort(([a],[b])=>
  (a==="Instagram"?-2:a==="TikTok"?-1:0)-(b==="Instagram"?-2:b==="TikTok"?-1:0)||a.localeCompare(b));
 const kinds=Object.entries(stats?.kinds||{}).sort(([a],[b])=>
  (a==="followers"?-2:a==="likes"?-1:0)-(b==="followers"?-2:b==="likes"?-1:0)||a.localeCompare(b));
 const pages=Math.ceil((listing?.total||0)/24);
 return <main className="lg-preview">
  <style>{`
    .lg-preview{min-height:100vh;background:radial-gradient(ellipse at 20% 0%,#163b7b 0%,#081326 45%,#040b17 100%);color:#eef6ff;padding:clamp(20px,4vw,58px);font-family:Inter,system-ui,Arial,sans-serif}
    .lg-preview *{box-sizing:border-box}.lg-shell{max-width:1280px;margin:auto}
    .lg-top{border:1px solid #456d9f;border-radius:20px;padding:clamp(22px,4vw,40px);background:linear-gradient(135deg,rgba(26,70,137,.62),rgba(5,16,40,.92));box-shadow:0 14px 60px #0007}
    .lg-tag{font-size:12px;letter-spacing:.2em;font-weight:700;color:#81c7ff;text-transform:uppercase}
    .lg-preview h1{margin:14px 0 12px;font-size:clamp(28px,5vw,49px);line-height:1.07;letter-spacing:-.035em}
    .lg-muted{color:#b4c9e7;font-size:14px;line-height:1.5}
    .lg-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:22px 0}
    .lg-stat{border:1px solid #355787;background:#0c2142;border-radius:14px;padding:20px}
    .lg-stat strong{display:block;font-size:27px;color:#b7e5ff}.lg-stat span{color:#9eb9d7;font-size:12px}
    .lg-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:22px 0}
    .lg-preview select,.lg-preview input,.lg-preview button{font:inherit;min-height:46px;border-radius:12px}
    .lg-preview select,.lg-preview input{width:100%;background:#0e2446;color:#eef6ff;border:1px solid #416697;padding:10px 14px}
    .lg-preview button{background:#13519a;color:white;border:1px solid #558ccd;padding:10px 19px;cursor:pointer}
    .lg-preview button:disabled{opacity:.4;cursor:not-allowed}
    .lg-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,270px),1fr));gap:14px}
    .lg-card{border:1px solid #2e578a;background:linear-gradient(160deg,#102d55,#071427);border-radius:16px;padding:19px;min-height:195px}
    .lg-card h3{font-size:15px;line-height:1.4;margin:10px 0 13px;overflow-wrap:anywhere}.lg-card small{color:#8db8e0}
    .lg-meta{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:13px}.lg-chip{border:1px solid #396494;background:#133056;color:#add8ff;border-radius:999px;font-size:11px;padding:5px 8px}
    .lg-inactive{color:#f6c68e;font-size:12px;font-weight:700}
    .lg-pages{display:flex;gap:14px;align-items:center;justify-content:center;padding:26px}
    .lg-notice{border-left:3px solid #76beff;padding:13px 17px;background:#143055;margin:18px 0;border-radius:4px;color:#d1e6ff;font-size:13px}
   `}</style>
   <div className="lg-shell">
    <section className="lg-top"><div className="lg-tag">Litix Global • Private Preview</div>
     <h1>Explore the global service catalog</h1>
     <p className="lg-muted">Read-only Boostero inventory. Your live PayKings checkout and four approved services are not modified. Supplier wholesale prices are private; newly discovered services are not purchasable until independently validated.</p>
    </section>
    <div className="lg-stats">
     <div className="lg-stat"><strong>{stats?.retrieved?.toLocaleString()||"—"}</strong><span>Live supplier entries</span></div>
     <div className="lg-stat"><strong>{stats?.valid?.toLocaleString()||"—"}</strong><span>Valid service entries</span></div>
     <div className="lg-stat"><strong>{stats?.supportedInputShape?.toLocaleString()||"—"}</strong><span>Standard input candidates</span></div>
     <div className="lg-stat"><strong>{stats?.requiringImplementation?.toLocaleString()||"—"}</strong><span>Additional order-flow work</span></div>
    </div>
    <form className="lg-filters" onSubmit={e=>{e.preventDefault();setPage(1);setTerm(query)}}>
     <select value={platform} aria-label="Select platform" onChange={e=>{setPage(1);setPlatform(e.target.value)}}>
      <option value="">All platforms</option>{platforms.map(([p,n])=><option key={p} value={p}>{p} ({n})</option>)}
     </select>
     <select value={kind} aria-label="Select service type" onChange={e=>{setPage(1);setKind(e.target.value)}}>
      <option value="">All service types</option>{kinds.map(([k,n])=><option key={k} value={k}>{k.replaceAll("_"," ")} ({n})</option>)}
     </select>
     <input aria-label="Search supplier services" placeholder="Search service name or category" value={query} onChange={e=>setQuery(e.target.value)} maxLength={100}/>
     <button type="submit">Search catalog</button>
    </form>
    <div className="lg-notice" role="status">Preview inventory only. No purchasing is available from this page. Existing approved services remain on the live Litix storefront.</div>
    {error?<p role="alert" className="lg-muted">{error}</p>:null}
    <p className="lg-muted">{loading?"Retrieving available supplier services…":(listing?.total||0).toLocaleString()+" matching services"} • Page {page}{pages?" of "+pages:""}</p>
    {selected?<ServiceDraft service={selected} onClose={()=>setSelected(null)}/>:null}
    <div className="lg-list">{(listing?.items||[]).map(s=><article className="lg-card" key={s.id}>
     <small>{s.platform} / {s.kind.replaceAll("_"," ")} / {s.id}</small>
     <h3>{s.name}</h3>
     <div className="lg-meta"><span className="lg-chip">{s.type}</span><span className="lg-chip">{s.min.toLocaleString()}–{s.max.toLocaleString()} units</span>
      {s.refill?<span className="lg-chip">Refill listed</span>:null}{s.dripfeed?<span className="lg-chip">Drip-feed listed</span>:null}
     </div>
     <span className="lg-inactive">Owner approval required · Not purchasable</span>
     <div style={{marginTop:12}}><button type="button" onClick={()=>setSelected(s)}>Preview required fields</button></div>
    </article>)}</div>
    <nav className="lg-pages" aria-label="Catalog pages">
     <button type="button" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}>Previous</button>
     <span>Page {page}</span>
     <button type="button" onClick={()=>setPage(p=>p+1)} disabled={page>=pages||!pages}>Next</button>
    </nav>
   </div>
  </main>
}
