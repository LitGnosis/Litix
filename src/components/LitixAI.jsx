"use client";
import {useEffect,useRef,useState} from "react";

const SUPPORT_EMAIL="litixsocial@gmail.com";
const suggestions=["Instagram follower services","Show growth bundles","Is Litix experiencing an outage?"];
const cash=v=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(v||0));
export default function LitixAI(){
  const [open,setOpen]=useState(false);
  const [status,setStatus]=useState(null);
  const [messages,setMessages]=useState([{role:"assistant",content:"Welcome to LITIX AI! Ask about available services, bundles, pricing, or Guardian status. Order tracking is available through the verified lookup below."}]);
  const [draft,setDraft]=useState("");
  const [busy,setBusy]=useState(false);
  const [orderView,setOrderView]=useState(false);
  const [orderId,setOrderId]=useState("");
  const [email,setEmail]=useState("");
  const [order,setOrder]=useState(null);
  const [orderError,setOrderError]=useState("");
  const [orderBusy,setOrderBusy]=useState(false);
  const bottom=useRef(null);
  const launcherRef=useRef(null);
  const closeRef=useRef(null);
  const wa=(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER||"").replace(/\D/g,"");
  const whatsapp=wa.length>=10&&wa.length<=15?"https://wa.me/"+wa+"?text="+encodeURIComponent("Hello LITIX support, I need help with my order or service."):"";
  useEffect(()=>{
    let active=true;
    fetch("/api/litix-ai",{cache:"no-store"}).then(r=>r.json()).then(d=>{if(active)setStatus(d)})
      .catch(()=>{if(active)setStatus({available:false,verified:false})});
    return()=>{active=false};
  },[]);
  const closePanel=()=>{setOpen(false);launcherRef.current?.focus();};
  useEffect(()=>{
    if(!open)return;
    closeRef.current?.focus();
    const onEscape=e=>{
      if(e.key==="Escape"){
        e.preventDefault();
        closePanel();
      }
    };
    document.addEventListener("keydown",onEscape);
    return()=>document.removeEventListener("keydown",onEscape);
  },[open]);
  useEffect(()=>{
    if(!open)return;
    const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    bottom.current?.scrollIntoView({block:"nearest",behavior:reduced?"auto":"smooth"});
  },[messages,busy,open]);
  async function send(text){
    const input=String(text||"").trim();
    if(!input||busy||!status?.available)return;
    setDraft("");setBusy(true);
    const history=messages.slice(-4);
    setMessages(m=>[...m,{role:"user",content:input}]);
    try{
      const r=await fetch("/api/litix-ai",{method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({message:input,history})});
      const v=await r.json();
      setMessages(m=>[...m,{role:"assistant",content:r.ok?v.reply:(v.error||"AI service temporarily unavailable. Please contact our team.")}]);
    }catch{
      setMessages(m=>[...m,{role:"assistant",content:"I cannot connect at the moment. You can still contact our team by WhatsApp or email."}]);
    }finally{setBusy(false)}
  }
  async function track(e){
    e.preventDefault();
    if(orderBusy)return;
    setOrderBusy(true);setOrderError("");setOrder(null);
    try{
      const r=await fetch("/api/order-lookup",{method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({orderId:orderId.trim(),email:email.trim().toLowerCase()}),cache:"no-store"});
      const d=await r.json();
      if(!r.ok||!d.order)throw Error(d.error||"Unable to verify the order.");
      setOrder(d.order);
    }catch(e){setOrderError(e.message||"Order tracking is unavailable.");}
    finally{setOrderBusy(false);}
  }
  return <div className="lxai-shell">
    {open&&<section id="lxai-dialog" className="lxai-panel" role="dialog" aria-label="LITIX AI Intelligent Growth Assistant">
      <header className="lxai-head"><div className="lxai-emblem" aria-hidden="true">L</div>
        <div className="lxai-titles"><strong>LITIX AI</strong><small>Intelligent Growth Assistant</small></div>
        {status?.verified&&<span className="lxai-badge">GPT-powered</span>}
        <button type="button" ref={closeRef} className="lxai-close" aria-label="Close assistant" onClick={closePanel}>×</button>
      </header>
      <div className="lxai-tabs">
        <button type="button" aria-pressed={!orderView} className={!orderView?"lxai-active":""} onClick={()=>setOrderView(false)}>AI assistance</button>
        <button type="button" aria-pressed={orderView} className={orderView?"lxai-active":""} onClick={()=>setOrderView(true)}>Track order</button>
      </div>
      {!orderView?<><div className="lxai-messages" role="log" aria-live="polite">
        {messages.map((m,i)=><p key={i} className={"lxai-message lxai-"+m.role}>{m.content}</p>)}
        {busy&&<p className="lxai-message lxai-assistant">Looking that up…</p>}
        <div ref={bottom}/>
      </div>
      {!status?.available&&<p className="lxai-offline">AI chat is not available yet. You can still track your order or contact human support.</p>}
      {status?.available&&<div className="lxai-suggestions">{suggestions.map(v=><button type="button" key={v} disabled={busy} onClick={()=>send(v)}>{v}</button>)}</div>}
      <form className="lxai-compose" onSubmit={e=>{e.preventDefault();send(draft)}}>
        <label className="lxai-sr" htmlFor="lxai-entry">Ask Litix AI</label>
        <input id="lxai-entry" value={draft} maxLength={750} onChange={e=>setDraft(e.target.value)} placeholder="Ask about services or pricing…" disabled={busy||!status?.available}/>
        <button type="submit" disabled={busy||!draft.trim()||!status?.available}>Send</button>
      </form></>:
      <form className="lxai-track" onSubmit={track}>
        <h3>Private order lookup</h3>
        <p>Enter your order number and the same email used at checkout. Verification happens on Litix's existing order system; your email and order details are not sent to the AI model.</p>
        <label>Order number<input value={orderId} onChange={e=>setOrderId(e.target.value)} maxLength={80} placeholder="ltx2_…" autoComplete="off" required/></label>
        <label>Checkout email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} placeholder="you@example.com" autoComplete="email" required/></label>
        <button type="submit" disabled={orderBusy}>{orderBusy?"Checking…":"Verify and track"}</button>
        {orderError&&<p className="lxai-error" role="alert">{orderError}</p>}
        {order&&<div className="lxai-order" role="status">
          <strong>Order verified</strong><p>{order.service}</p>
          <dl><div><dt>Payment</dt><dd>{order.payment}</dd></div><div><dt>Fulfillment</dt><dd>{order.fulfillment}</dd></div>
            <div><dt>Quantity</dt><dd>{order.quantity}</dd></div><div><dt>Total</dt><dd>{cash(order.amount)}</dd></div></dl>
          <p>{order.statusNote||"Delivery is not guaranteed until confirmed by the supplier."}</p>
        </div>}
        <a href="/track">Open the full secure tracking page</a>
      </form>}
      <footer className="lxai-footer">
        <span>Human support: </span>
        {whatsapp&&<a href={whatsapp} rel="noopener noreferrer" target="_blank">WhatsApp</a>}
        <a href={"mailto:"+SUPPORT_EMAIL}>Email</a>
        <small>AI chat uses OpenAI. Never share passwords, payment details, or tracking tokens.</small>
      </footer>
    </section>}
    <button type="button" ref={launcherRef} className="lxai-launcher" aria-controls="lxai-dialog" aria-haspopup="dialog" aria-label={open?"Close LITIX AI":"Open LITIX AI"} aria-expanded={open} onClick={()=>open?closePanel():setOpen(true)}>
      <span className="lxai-orb">✦</span><span>{open?"Close assistant":"Ask LITIX AI"}</span>
    </button>
  </div>;
}
