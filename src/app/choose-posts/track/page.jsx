"use client";
import {useEffect,useState} from "react";
import "../choose-posts.css";
const price=v=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(v||0)/100);
export default function PostsTracking(){
 const [id,setId]=useState("");const [token,setToken]=useState("");const [email,setEmail]=useState("");
 const [order,setOrder]=useState(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 useEffect(()=>{
  const p=new URLSearchParams(window.location.search);
  const i=p.get("order")||"",t=p.get("token")||"";
  setId(i);setToken(t);
  if(t)window.history.replaceState(window.history.state,"","/choose-posts/track");
  if(i&&t)load(i,t,"");
 },[]);
 async function load(i,t,e){
  setBusy(true);setMessage("");
  try{
   const r=t?await fetch("/api/choose-posts/track?order="+encodeURIComponent(i)+"&token="+encodeURIComponent(t),{cache:"no-store"}):
    await fetch("/api/choose-posts/track",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({orderId:i,email:e})});
   const v=await r.json();if(!r.ok)throw Error(v.error||"Order tracking unavailable");
   setOrder(v.order);setId(v.order.id);
  }catch(x){setMessage(String(x.message||"Unable to retrieve the order."))}
  finally{setBusy(false)}
 }
 return <main className="cyp-page">
  <nav className="cyp-nav"><a href="/"><img src="/assets/brand/litix-logo.webp" width="125" alt="Litix home"/></a><a href="/choose-posts">Choose more posts</a></nav>
  <header className="cyp-hero"><span className="cyp-eyebrow">LITIX · POST-BY-POST TRACKING</span><h1>Track Every Post</h1>
   <p>Each post has its own fulfillment state and supplier reference.</p></header>
  <section className="cyp-panel" style={{maxWidth:750,margin:"0 auto"}}>
   <form className="cyp-form" onSubmit={e=>{e.preventDefault();load(id,token,email)}}>
    <label>Litix order number<input value={id} onChange={e=>{setId(e.target.value);setOrder(null)}} placeholder="ltx2_..." required/></label>
    {!token&&<label>Checkout email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>}
    <button type="submit" className="cyp-primary" disabled={busy}>{busy?"Checking statuses...":"Check post statuses"}</button>
   </form>
   {message&&<div className="cyp-notice" role="status">{message}</div>}
   {order&&<div className="cyp-receipt">
    <h2>Order {order.id}</h2><p>@{order.username} · {order.service}</p>
    <p>Payment: <b>{order.payment}</b> · Fulfillment: <b>{order.fulfillment}</b></p>
    <p>{price(order.totalCents)} · {order.quantityEach} likes per post</p>
    <h3>Individual posts ({order.items.length})</h3>
    {order.items.map((item,i)=><div className="cyp-picked-row" key={item.url}>
      <span>{i+1}.</span><div><a href={item.url} target="_blank" rel="noopener noreferrer">{item.url}</a>
      <p>State: <b>{item.state.replaceAll("_"," ")}</b> · Supplier ID: {item.supplierOrderId||"Awaiting assignment"} · {price(item.amountCents)}</p>
      {item.supplierStatus&&<small>Supplier reports: {item.supplierStatus}</small>}
      {item.needsReview&&<p>Needs manual review. Do not reorder; contact support.</p>}</div>
     </div>)}
    <p>Supplier delivery status is last observed information, not a guarantee. For help email <a href="mailto:litixsocial@gmail.com">Litix support</a>.</p>
   </div>}
  </section>
 </main>;
}
