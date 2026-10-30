"use client";
import {useEffect,useRef,useState} from "react";

const currency=n=>typeof n==="number"&&Number.isFinite(n)
  ?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n):null;
const contactNumber=(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER||"").replace(/\D/g,"")||"19452106315";
const manualMessage=service=>[
 "Hi Litix, I would like to order this Litix service.",
 "Service: "+service.name,
 "Service ID: "+service.id.replace(/^boostero_/,""),
 "Platform: "+service.platform,
 "Minimum quantity: "+(service.min??"confirm with support"),
 "Please confirm my exact price, accepted destination link, and fulfillment requirements before payment."
].join("\n");
const topFilters=["Instagram","TikTok","YouTube","Facebook","Twitter (X)","Spotify","Telegram","LinkedIn"];
const focusFilters=[
 {label:"Instagram Followers",platform:"Instagram",kind:"followers"},
 {label:"Instagram Likes",platform:"Instagram",kind:"likes"},
 {label:"TikTok Followers",platform:"TikTok",kind:"followers"},
 {label:"TikTok Likes",platform:"TikTok",kind:"likes"}
];

export default function LitixDirectory({standalone=false}){
 const [search,setSearch]=useState("");
 const [debounced,setDebounced]=useState("");
 const [platform,setPlatform]=useState("");
 const [kind,setKind]=useState("");
 const [category,setCategory]=useState("");
 const [onlyReady,setOnlyReady]=useState(false);
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
  if(onlyReady)qs.set("ready","true");
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
 },[debounced,platform,kind,category,onlyReady,page,retry]);
 const changePlatform=name=>{setPlatform(name);setKind("");setCategory("");setPage(1)};
 const selectFocus=filter=>{setPlatform(filter.platform);setKind(filter.kind);setCategory("");setPage(1)};
 const selectedFocus=focusFilters.find(f=>f.platform===platform&&f.kind===kind);
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
  <div className="litix-directory-highlight" role="group" aria-label="Popular custom orders">
   {focusFilters.map(f=><button type="button" key={f.label}
    className={"litix-directory-fast"+(selectedFocus?.label===f.label?" is-active":"")}
    aria-pressed={selectedFocus?.label===f.label} onClick={()=>selectFocus(f)}>{f.label}</button>)}
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
   <div className="litix-directory-results">
    <div className="litix-directory-toolbar">
     <label className="litix-directory-search">Search Litix Services
      <input type="search" placeholder="Search by service, category or ID" value={search}
       onChange={e=>{setSearch(e.target.value);setPage(1)}} autoComplete="off" />
     </label>
     <label>Service type
      <select value={kind} onChange={e=>{setKind(e.target.value);setPage(1)}}>
       <option value="">All types</option>
       {["followers","likes","views","comments","subscribers","shares","members","plays","traffic","other"].map(x=><option key={x} value={x}>{x[0].toUpperCase()+x.slice(1)}</option>)}
      </select>
     </label>
     <label>Category
      <select value={category} onChange={e=>{setCategory(e.target.value);setPage(1)}}>
       <option value="">All categories</option>
       {categories.filter(x=>!platform||x.name.toLowerCase().includes(platform.toLowerCase())||platform==="Other").slice(0,300).map(x=><option key={x.name} value={x.name}>{x.name} ({x.count})</option>)}
      </select>
     </label>
    </div>
    <div className="litix-directory-ready-filter">
     <label><input type="checkbox" checked={onlyReady} onChange={e=>{setOnlyReady(e.target.checked);setPage(1)}} /> Ready for instant checkout only</label>
     <button type="button" onClick={()=>{setSearch("");setPlatform("");setKind("");setCategory("");setOnlyReady(false);setPage(1);setRetry(x=>x+1)}}>Reset filters</button>
    </div>
    <div className="litix-directory-result-header" aria-live="polite">
     <strong>{status==="loading"?"Loading your services…":status==="error"?"Catalog connection needs attention":count.toLocaleString()+" matching Litix services"}</strong>
     {status==="ready"&&<span>Page {page} of {Math.max(1,Math.ceil(count/24))} · Prices in USD per 1,000</span>}
    </div>
    {status==="error"&&<div className="litix-directory-error" role="alert">{problem}<button type="button" onClick={()=>setRetry(v=>v+1)}>Retry catalog</button></div>}
    {status==="ready"&&entries.length===0&&<p className="litix-directory-empty">No matching services. Try another platform or clear the filters.</p>}
    <div className="litix-directory-cards">
     {entries.map(s=>{
      const approved=s.purchasable===true;
      const wholesaleEstimate=currency(s.per1000);
      const manualUrl="https://wa.me/"+contactNumber+"?text="+encodeURIComponent(manualMessage(s));
      return <article className="litix-directory-service" key={s.id}>
       <div className="litix-directory-service-top"><span className="litix-directory-network">{s.platform}</span><span className={approved?"litix-directory-state is-ready":"litix-directory-state"}>{approved?"Instant checkout":s.quoteStatus==="unavailable"?"Quote required":"Request quote"}</span></div>
       <h3>{s.name}</h3>
       <p className="litix-directory-service-category">{s.category}</p>
       <div className="litix-directory-service-price">{wholesaleEstimate||"Ask for price"} <small>/ 1,000 {approved?"":"· indicative"}</small></div>
       <div className="litix-directory-service-range">
        {Number.isInteger(s.min)&&Number.isInteger(s.max)?s.min.toLocaleString()+"–"+s.max.toLocaleString()+" units":"Quantity confirmed on request"}
        <span>Service {s.id.replace(/^boostero_/,"")}</span>
       </div>
       {approved?<a className="litix-directory-buy" href={"/?service="+encodeURIComponent(s.id)+"#checkout"}>Review & pay with PayKings</a>:
        <a className="litix-directory-manual" href={manualUrl} target="_blank" rel="noopener noreferrer">Request a confirmed quote</a>}
      </article>
     })}
    </div>
    {status==="ready"&&count>24&&<div className="litix-directory-pagination">
     <button type="button" disabled={page<=1} onClick={()=>{setPage(n=>Math.max(1,n-1));filterRef.current?.scrollIntoView({behavior:"smooth"})}}>Previous</button>
     <span>{page} / {Math.ceil(count/24)}</span>
     <button type="button" disabled={page*24>=count} onClick={()=>{setPage(n=>n+1);filterRef.current?.scrollIntoView({behavior:"smooth"})}}>Next page</button>
    </div>}
    <div className="litix-directory-footnote">
     <strong>Litix orders made simple.</strong> Verified services use live PayKings checkout. Other services require a manual price and fulfillment review before payment; estimated prices are not final quotes.
     <div><a href={"https://wa.me/"+contactNumber} target="_blank" rel="noopener noreferrer">WhatsApp</a><a href="https://www.instagram.com/litixsocial/" target="_blank" rel="noopener noreferrer">Instagram DM @Litixsocial</a><a href="mailto:Litixsocial@gmail.com">Email Litix</a></div>
    </div>
   </div>
  </div>
 </section>;
}
