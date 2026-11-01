"use client";
import {litixCustomerServiceName} from "../lib/serviceCardDisplay.mjs";
import {SERVICE_NAV_GROUPS,allowedServiceFilter} from "../lib/serviceNavigation.mjs";
import {useEffect,useRef,useState} from "react";

const currency=n=>typeof n==="number"&&Number.isFinite(n)
  ?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n):null;
const contactNumber=(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER||"").replace(/\D/g,"")||"19452106315";
const topFilters=["Instagram","TikTok","YouTube","Facebook","Twitter (X)","Spotify","Telegram","LinkedIn"];
export default function LitixDirectory({standalone=false,initialPlatform="",initialKind=""}){
 const [search,setSearch]=useState("");
 useEffect(()=>{const q=new URLSearchParams(location.search).get("q")||new URLSearchParams(location.search).get("service")||"";
  if(q)setSearch(q.replace(/^(?:boostero|litix)_/,""));},[]);
 const [debounced,setDebounced]=useState("");
 const [platform,setPlatform]=useState(allowedServiceFilter(initialPlatform,initialKind)?initialPlatform:"");
 const [kind,setKind]=useState(allowedServiceFilter(initialPlatform,initialKind)?initialKind:"");
 const [category,setCategory]=useState("");
 const [page,setPage]=useState(1);
 const [entries,setEntries]=useState([]);
 const [platforms,setPlatforms]=useState([]);
 const [categories,setCategories]=useState([]);
 const [count,setCount]=useState(0);
 const [allCount,setAllCount]=useState(null);
 const [readyCount,setReadyCount]=useState(null);
 const [status,setStatus]=useState("loading");
 const [problem,setProblem]=useState("");
 const [retry,setRetry]=useState(0);
 const filterRef=useRef(null);

 useEffect(()=>{const id=setTimeout(()=>setDebounced(search.trim()),280);return()=>clearTimeout(id)},[search]);
 useEffect(()=>{
  const abort=new AbortController();
  setStatus("loading");setProblem("");
  const qs=new URLSearchParams({page:String(page)});
  if(debounced)qs.set("q",debounced);
  if(platform)qs.set("platform",platform);
  if(kind)qs.set("kind",kind);
  if(category)qs.set("category",category);
  fetch("/api/catalog/global?"+qs,{cache:"no-store",signal:abort.signal})
   .then(async r=>{
    const body=await r.json();
    if(!r.ok)throw Error(body.error||"Litix services are temporarily unavailable");
    return body;
   })
   .then(body=>{
    if(abort.signal.aborted)return;
    setEntries(Array.isArray(body.items)?body.items:[]);
    setPlatforms(Array.isArray(body.platforms)?body.platforms:[]);
    setCategories(Array.isArray(body.categories)?body.categories:[]);
    setCount(Number(body.total)||0);
    setAllCount(Number(body.allCount)||0);
    setReadyCount(Number(body.verifiedPurchasableCount)||0);
    setStatus("ready");
   })
   .catch(e=>{if(!abort.signal.aborted){setEntries([]);setStatus("error");setProblem(e.message)}})
   .finally(()=>{});
  return()=>abort.abort();
 },[debounced,platform,kind,category,page,retry]);
 const syncDirectoryFilterUrl=(name,nextKind)=>{
  const url=new URL(window.location.href);
  url.searchParams.delete("service");url.searchParams.delete("q");
  if(name)url.searchParams.set("platform",name);
  else url.searchParams.delete("platform");
  if(nextKind)url.searchParams.set("kind",nextKind);
  else url.searchParams.delete("kind");
  window.history.replaceState(window.history.state,"",url.pathname+url.search+"#all-litix-services");
 };
 const changePlatform=name=>{
  setPlatform(name);setKind("");setCategory("");setSearch("");setPage(1);
  syncDirectoryFilterUrl(name,"");
  requestAnimationFrame(()=>filterRef.current?.scrollIntoView({behavior:"smooth",block:"start"}));
 };
 const selectFocus=(nextPlatform,nextKind)=>{
  if(!allowedServiceFilter(nextPlatform,nextKind))return;
  const selectedPlatform=nextPlatform==="All platforms"?"":nextPlatform;
  setPlatform(selectedPlatform);setKind(nextKind);setCategory("");setSearch("");setPage(1);
  syncDirectoryFilterUrl(selectedPlatform,nextKind);
  requestAnimationFrame(()=>filterRef.current?.scrollIntoView({behavior:"smooth",block:"start"}));
 };
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const fromUrl=params.get("platform"),kindFromUrl=params.get("kind")||"";
  if(fromUrl&&allowedServiceFilter(fromUrl,kindFromUrl)){
   setPlatform(fromUrl);setKind(kindFromUrl);
  }
 },[]);
 const filteredPlatformOptions=[
  ...topFilters.filter(name=>platforms.some(p=>p.name===name)),
  ...platforms.filter(p=>!topFilters.includes(p.name)).map(p=>p.name)
 ];
 return <section id="all-litix-services" className={"panel litix-directory"+(standalone?" litix-directory-standalone":"")}
     aria-label="All Litix services">
  <div className="litix-directory-heading">
   <div>
    <div className="kicker">LITIX · ALL PLATFORMS · ONE PLACE</div>
    <h2>All Litix Services</h2>
    <p>Find followers, likes, views, engagement, streams and more. Browse across every supported social platform, all in your Litix blue storefront.</p>
   </div>
   <a className="litix-directory-feature-link" href="/bundles">Explore Growth Bundles</a>
  </div>
  <div className="litix-directory-stats">
   <div><strong>{allCount==null?"—":allCount.toLocaleString()}</strong><span>Services in catalog</span></div>
   <div><strong>{platforms.length||"—"}</strong><span>Platforms</span></div>
   <div><strong>{readyCount==null?"—":readyCount.toLocaleString()}</strong><span>Instant PayKings services</span></div>
  </div>
  <div className="litix-directory-highlight" role="navigation" aria-label="Browse Litix by social platform and service type">
   <button type="button" className={"litix-directory-fast litix-directory-all"+(!platform&&!kind?" is-active":"")}
    aria-pressed={!platform&&!kind} onClick={()=>selectFocus("All platforms","")}>All Litix Services</button>
   {SERVICE_NAV_GROUPS.map(group=><div className="litix-directory-filter-group" role="group"
    key={group.platform} aria-label={group.label+" categories"}>
    <strong className="litix-directory-group-heading">{group.label}</strong>
    <div className="litix-directory-filter-buttons">
     <button type="button" className={"litix-directory-fast"+(platform===group.platform&&!kind?" is-active":"")}
      aria-pressed={platform===group.platform&&!kind}
      onClick={()=>selectFocus(group.platform,"")}>{group.label} services</button>
     {group.kinds.map(item=><button type="button" key={item.kind}
      className={"litix-directory-fast"+(platform===group.platform&&kind===item.kind?" is-active":"")}
      aria-pressed={platform===group.platform&&kind===item.kind}
      onClick={()=>selectFocus(group.platform,item.kind)}>{group.label} {item.label}</button>)}
    </div>
   </div>)}
  </div>
  <div className="litix-directory-layout">
   <nav aria-label="Litix platform categories" className="litix-directory-rail">
    <div className="litix-directory-rail-title">SHOP BY PLATFORM</div>
    <button type="button" className={!platform?"is-active":""} onClick={()=>changePlatform("")}>All Litix Services <span>{allCount==null?"":allCount.toLocaleString()}</span></button>
    {filteredPlatformOptions.map(name=>{
     const stat=platforms.find(p=>p.name===name);
     return <button type="button" key={name} className={platform===name?"is-active":""}
      onClick={()=>changePlatform(name)}>{name}<span>{stat?.count?.toLocaleString()}</span></button>
    })}
   </nav>
   <div className="litix-directory-results" ref={filterRef}>
    <div className="litix-directory-toolbar">
     <label className="litix-directory-search">Search Litix Services
      <input type="search" placeholder="Search by service, category or ID" value={search}
       onChange={e=>{setSearch(e.target.value);setPage(1)}} autoComplete="off" />
     </label>
     <label>Service type
      <select value={kind} onChange={e=>{setKind(e.target.value);setPage(1)}}>
       <option value="">All types</option>
       {["followers","likes","views","subscribers","retweets","comments","shares","members","plays","traffic","other"].map(x=><option key={x} value={x}>{x[0].toUpperCase()+x.slice(1)}</option>)}
      </select>
     </label>
     <label>Category
      <select value={category} onChange={e=>{setCategory(e.target.value);setPage(1)}}>
       <option value="">All categories</option>
       {categories.map(x=><option key={x.name} value={x.name}>{litixCustomerServiceName(x.name)} ({x.count})</option>)}
      </select>
     </label>
    </div>
    <div className="litix-directory-ready-filter">
     <button type="button" onClick={()=>{setSearch("");setPlatform("");setKind("");setCategory("");setPage(1);syncDirectoryFilterUrl("","");setRetry(x=>x+1)}}>Reset filters</button>
    </div>
    <div className="litix-directory-result-header" aria-live="polite">
     <strong>{status==="loading"?"Loading your services…":status==="error"?"Catalog connection needs attention":count.toLocaleString()+" matching Litix services"}</strong>
     {status==="ready"&&<span>Page {page} of {Math.max(1,Math.ceil(count/24))} · Prices in USD per 1,000</span>}
    </div>
    {status==="error"&&<div className="litix-directory-error" role="alert">{problem}<button type="button" onClick={()=>setRetry(v=>v+1)}>Retry catalog</button></div>}
    {status==="ready"&&entries.length===0&&<p className="litix-directory-empty">No matching services. Try another platform or clear the filters.</p>}
    <div className="litix-directory-cards">
     {entries.filter(s=>s.purchasable===true).map(s=>{
      const approved=s.purchasable===true;
      const displayPrice=currency(s.per1000);
      return <article className="litix-directory-service" key={s.id}>
       <div className="litix-directory-service-top"><span className="litix-directory-network">{s.platform}</span><span className={approved?"litix-directory-state is-ready":"litix-directory-state"}>Instant checkout</span></div>
       <h3>{litixCustomerServiceName(s.name)}</h3>
       <p className="litix-directory-service-category">{litixCustomerServiceName(s.category)}</p>
       <div className="litix-directory-service-price">{displayPrice||"Ask for price"} <small>/ 1,000 {approved?"":"· indicative"}</small></div>
       <div className="litix-directory-service-range">
        {Number.isInteger(s.min)&&Number.isInteger(s.max)?s.min.toLocaleString()+"–"+s.max.toLocaleString()+" units":"Quantity confirmed on request"}
        <span>Litix verified service</span>
       </div>
       <a className="litix-directory-buy" href={"/?service="+encodeURIComponent(s.id)+"#checkout"}>{["litix_4751","litix_5251"].includes(String(s.id))?"Choose Your Posts & Pay":"Review & pay with PayKings"}</a>
      </article>
     })}
    </div>
    {status==="ready"&&count>24&&<div className="litix-directory-pagination">
     <button type="button" disabled={page<=1} onClick={()=>{setPage(n=>Math.max(1,n-1));filterRef.current?.scrollIntoView({behavior:"smooth"})}}>Previous</button>
     <span>{page} / {Math.ceil(count/24)}</span>
     <button type="button" disabled={page*24>=count} onClick={()=>{setPage(n=>n+1);filterRef.current?.scrollIntoView({behavior:"smooth"})}}>Next page</button>
    </div>}
    <div className="litix-directory-footnote">
     <strong>Litix orders made simple.</strong> All displayed services are available through Litix secure checkout. Review the total before paying.
     <div><a href={"https://wa.me/"+contactNumber} target="_blank" rel="noopener noreferrer">WhatsApp</a><a href="https://www.instagram.com/litixsocial/" target="_blank" rel="noopener noreferrer">Instagram DM @Litixsocial</a><a href="mailto:Litixsocial@gmail.com">Email Litix</a></div>
    </div>
   </div>
  </div>
 </section>;
}
