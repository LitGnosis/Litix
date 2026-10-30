"use client";
import {useEffect,useState} from "react";
const dollars=n=>Number.isFinite(Number(n))?"$"+Number(n).toFixed(2):"Price on request";
const whatsapp="https://wa.me/19452106315?text="+encodeURIComponent("Hello Litix, I need a manual Boostero-only custom order. Please confirm my service, quantity, destination and final price.");
export default function CustomOrdersPreview(){
 const [items,setItems]=useState([]),[term,setTerm]=useState(""),[page,setPage]=useState(1);
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[total,setTotal]=useState(0),[verified,setVerified]=useState(0);
 useEffect(()=>{
  const p=new URLSearchParams(location.search),s=p.get("q")||p.get("service")||"";
  setTerm(s);
 },[]);
 useEffect(()=>{
  const ctrl=new AbortController();
  setLoading(true);setError("");
  const qs=new URLSearchParams({q:term,page:String(page)});
  fetch("/api/catalog/global?"+qs,{signal:ctrl.signal,cache:"no-store"})
   .then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.error||"Supplier directory unavailable");return body})
   .then(body=>{setItems(body.items||[]);setTotal(body.total||0);setVerified(body.verifiedPurchasableCount||0)})
   .catch(e=>{if(!ctrl.signal.aborted)setError(e.message||"Catalog unavailable")})
   .finally(()=>{if(!ctrl.signal.aborted)setLoading(false)});
  return()=>ctrl.abort();
 },[term,page]);
 const contactStyle={color:"#9fdcff",textDecoration:"underline",marginRight:15};
 return <main className="wrap">
  <nav className="nav"><a href="/" className="brand">LITIX</a><div><a href="/#services">Custom Orders</a><a href="/bundles">Bundles</a><a href="/#checkout">PayKings checkout</a></div></nav>
  <section className="panel" style={{margin:"24px auto",maxWidth:1050}}>
   <span className="kicker">BOOSTERO ONLY · LIVE DIRECTORY</span>
   <h1>Custom Orders — Preview</h1>
   <p className="muted">Instagram Followers, Instagram Likes, TikTok Followers and TikTok Likes are displayed first. Within each group, American services lead, followed by regular/global services, then other countries. Prices sort low to high in each region.</p>
   <p className="small">Only approved services display a PayKings checkout link. All other Boostero services require a manual quote before payment. Estimated preview prices are not checkout quotes.</p>
   <form onSubmit={e=>e.preventDefault()} className="form" style={{maxWidth:600}}>
    <label>Find a Boostero service<input aria-label="Search custom orders" value={term} placeholder="Followers, Likes or service ID" onChange={e=>{setTerm(e.target.value);setPage(1)}}/></label>
   </form>
   <p role="status">{loading?"Loading live Boostero services…":error||total.toLocaleString()+" matching services · "+verified+" approved for instant checkout"}</p>
   <div className="cards">
   {items.map(service=><article className="service-option" key={service.id}>
    <div className="item" style={{height:"100%"}}>
     <h3>{service.name}</h3>
     <p className="small">{service.platform} · {service.category}</p>
     <p className="small">{service.type} · Quantity {Number(service.min).toLocaleString()}–{Number(service.max).toLocaleString()}</p>
     <p className="price">{dollars(service.per1000)} / 1,000 {service.purchasable?"":"(estimated)"}</p>
     {service.purchasable?
      <a className="primary" style={{display:"inline-block",marginTop:12}} href={"/?service="+encodeURIComponent(service.id)+"#checkout"}>Review in PayKings checkout</a>:
      <p className="small">Manual order required — no automatic checkout for this service.</p>}
    </div>
   </article>)}
   </div>
   <div style={{display:"flex",gap:12,marginTop:20,alignItems:"center"}}>
    <button type="button" className="alt" disabled={page===1||loading} onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button>
    <span>Page {page}</span>
    <button type="button" className="alt" disabled={page*24>=total||loading} onClick={()=>setPage(p=>p+1)}>Next</button>
   </div>
   <section style={{marginTop:28}} aria-label="Manual order support">
    <h2>Manual orders & custom service requests</h2>
    <p>For services needing special post details or personalized fulfillment, send your service, quantity, public link, and email to Litix for a verified Boostero-only quote. Never send card details or passwords.</p>
    <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={contactStyle}>WhatsApp</a>
    <a href="https://www.instagram.com/litixsocial/" target="_blank" rel="noopener noreferrer" style={contactStyle}>Instagram DM @Litixsocial</a>
    <a href="mailto:Litixsocial@gmail.com?subject=Litix%20Manual%20Order" style={contactStyle}>Email Litixsocial@gmail.com</a>
   </section>
  </section>
 </main>;
}