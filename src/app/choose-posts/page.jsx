"use client";
import {useEffect,useRef,useState} from "react";
import PremiumInlineCheckout from "../../components/PremiumInlineCheckout";
import "./choose-posts.css";
const cash=c=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(c||0)/100);
const parseLink=value=>{
 try{
  const u=new URL(String(value||"").trim());
  const m=u.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]{5,40})\/?$/);
  return u.protocol==="https:"&&["instagram.com","www.instagram.com"].includes(u.hostname)&&m?"https://www.instagram.com/"+m[1]+"/"+m[2]+"/":null;
 }catch{return null;}
};
const moneyFor=(rate,quantity,count)=>Number.isFinite(rate)&&Number.isSafeInteger(quantity)&&quantity>0
 ?Math.ceil(rate*quantity/10-1e-8)*count:0;
export default function ChoosePosts(){
 const [username,setUsername]=useState("");
 const [loading,setLoading]=useState(false);
 const [searched,setSearched]=useState(false);
 const [media,setMedia]=useState([]);
 const [picked,setPicked]=useState([]);
 const [manual,setManual]=useState("");
 const [catalog,setCatalog]=useState([]);
 const [serviceId,setServiceId]=useState("");
 const [quantity,setQuantity]=useState(1000);
 const [email,setEmail]=useState("");
 const [checkout,setCheckout]=useState({paymentReady:false,demo:false});
 const [cardReady,setCardReady]=useState(false);
 const [cardRetry,setCardRetry]=useState(0);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [receipt,setReceipt]=useState(null);
 const [idem,setIdem]=useState("");
 const sendRef=useRef(null);
 const gatewayRef=useRef(null);
 const service=catalog.find(s=>String(s.id)===serviceId);
 const amount=service?moneyFor(service.per1000,quantity,picked.length):0;
 const validQuantity=Boolean(service&&Number.isSafeInteger(quantity)&&quantity>=service.min&&quantity<=service.max
  &&Number.isSafeInteger(service.unitStep)&&service.unitStep>0&&(quantity-service.min)%service.unitStep===0);
 const orderReady=Boolean(searched&&service&&picked.length&&validQuantity&&amount>=500
  &&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())&&!busy&&!receipt);
 useEffect(()=>{
  setIdem(crypto.randomUUID());
  Promise.all([
   fetch("/api/choose-posts/catalog",{cache:"no-store"}).then(r=>r.json()),
   fetch("/api/choose-posts/checkout",{cache:"no-store"}).then(r=>r.json())
  ]).then(([a,b])=>{setCatalog(a.services||[]);setCheckout(b);if(a.services?.length){setServiceId(String(a.services[0].id));setQuantity(Number(a.services[0].min));}})
    .catch(()=>setNotice("Live service catalog is unavailable. No orders can be charged."));
 },[]);
 useEffect(()=>{
  if(!checkout.paymentReady||!checkout.publicKey)return;
  let active=true,script=document.getElementById("litix-choose-posts-collect"),poll=null,deadline=null;
  setCardReady(false);
  function configure(){
   if(!active||!window.CollectJS?.configure)return;
   try{window.CollectJS.configure({
    variant:"inline",styleSniffer:false,
    customCss:{"font-size":"16px","font-family":"sans-serif",color:"#ffffff","background-color":"transparent"},
    placeholderCss:{color:"#aebfd4"},
    fields:{ccnumber:{selector:"#ccnumber",title:"Card Number",placeholder:"Card number"},
     ccexp:{selector:"#ccexp",title:"Expiration",placeholder:"MM / YY"},
     cvv:{selector:"#cvv",title:"Security Code",placeholder:"CVV"}},
    callback:r=>{if(!active)return;if(r?.token)sendRef.current?.(r.token);
     else{setBusy(false);setNotice("Card tokenization failed. Retry your secure fields.");}},
    fieldsAvailableCallback:()=>{if(active){setCardReady(true);setNotice("");}}
   });}catch{setNotice("Unable to initialize secure card fields. No payment submitted.");}
  }
  function waitForCollect(){if(window.CollectJS?.configure&&document.getElementById("cvv")){clearInterval(poll);poll=null;configure();}}
  // This new standalone page never shares card field IDs with the existing checkout page.
  if(!script||script.dataset.tokenizationKey!==checkout.publicKey){
   script?.remove();script=document.createElement("script");
   script.id="litix-choose-posts-collect";script.src="https://secure.nmi.com/token/Collect.js?v="+Date.now();
   script.setAttribute("data-tokenization-key",checkout.publicKey);
   script.setAttribute("data-variant","inline");script.setAttribute("data-style-sniffer","false");
   script.setAttribute("data-field-ccnumber-selector","#ccnumber");
   script.setAttribute("data-field-ccexp-selector","#ccexp");script.setAttribute("data-field-cvv-selector","#cvv");
   document.head.appendChild(script);
  }
  poll=window.setInterval(waitForCollect,100);
  deadline=window.setTimeout(()=>{if(active&&!window.CollectJS?.configure)setNotice("Secure card fields unavailable. Retry to reload.")},15000);
  return()=>{active=false;clearInterval(poll);clearTimeout(deadline)};
 },[checkout.paymentReady,checkout.publicKey,cardRetry]);
 async function loadPosts(e){
  e.preventDefault();if(loading)return;
  setLoading(true);setNotice("");setMedia([]);setPicked([]);setReceipt(null);
  try{
   const resp=await fetch("/api/choose-posts/media?username="+encodeURIComponent(username.trim()),{cache:"no-store"});
   const j=await resp.json();if(!resp.ok)throw Error(j.error||"Invalid Instagram account.");
   setUsername(j.username);setMedia(j.posts||[]);setSearched(true);setNotice(j.message||"");
  }catch(e){setSearched(false);setNotice(String(e.message||"Could not load Instagram posts."))}
  finally{setLoading(false)}
 }
 function toggle(post){
  setPicked(current=>current.some(x=>x.url===post.url)?current.filter(x=>x.url!==post.url)
   :current.length<8?[...current,post]:current);
 }
 function addManual(){
  const links=manual.split(/[\n,\s]+/).filter(Boolean);
  if(!links.length)return;
  if(links.length>8){setNotice("Select up to eight Instagram posts per checkout.");return}
  const normalized=links.map(parseLink);
  if(normalized.some(x=>!x)){setNotice("Use full, direct https://www.instagram.com/p/... or /reel/... links.");return}
  const additions=normalized.map(url=>({url,thumbnail:null}));
  const combined=[...picked,...additions.filter(p=>!picked.some(x=>x.url===p.url))];
  if(combined.length>8){setNotice("Choose up to eight unique posts per checkout.");return}
  setPicked(combined);setManual("");setNotice("");
 }
 async function submitOrder(token,simulated=false){
  if(!orderReady||busy)return;
  setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/choose-posts/checkout",{method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({username,email:email.trim(),serviceId,quantityEach:quantity,posts:picked.map(x=>x.url),
     expectedAmountCents:amount,idempotencyKey:idem,paymentToken:token,simulate:simulated})});
   const v=await r.json();if(!r.ok&&r.status!==202)throw Error(v.error||"Order failed.");
   setReceipt(v);setNotice(v.message||"Your order was recorded.");
   if(v.orderId&&v.secret){
    const link=window.location.origin+"/choose-posts/track?order="+encodeURIComponent(v.orderId)+"&token="+encodeURIComponent(v.secret);
    setReceipt(old=>({...old,trackingUrl:link}));
   }
  }catch(e){setNotice(String(e.message||"Checkout unavailable."))}
  finally{setBusy(false)}
 }
 sendRef.current=token=>submitOrder(token,false);
 function wrapUp(e){
  e.preventDefault();
  if(!orderReady)return;
  if(checkout.demo){submitOrder("",true);return;}
  if(!checkout.paymentReady||!cardReady){setNotice("Wait for secure PayKings fields. No charge submitted.");return}
  try{window.CollectJS.startPaymentRequest()}catch{setNotice("Fill in the secure card fields first.");}
 }
 return <main className="cyp-page">
  <nav className="cyp-nav"><a href="/"><img src="/assets/brand/litix-logo.webp" width="125" alt="Litix home"/></a>
   <a href="/">Full service catalog</a></nav>
  <header className="cyp-hero"><span className="cyp-eyebrow">LITIX · INSTAGRAM CUSTOM LIKES</span>
   <h1>Choose Your Posts</h1><p>Pick the posts, choose likes per post, and wrap up with one order.</p></header>
  <div className="cyp-layout">
   <section className="cyp-panel">
    <div className="cyp-section-head"><span className="cyp-step">01</span><div><h2>Find Instagram posts</h2>
     <p>Public professional accounts may show photos. Otherwise paste direct public post URLs.</p></div></div>
    <form className="cyp-lookup" onSubmit={loadPosts}>
     <label htmlFor="cyp-username">Instagram username</label>
     <div className="cyp-lookup-row"><input id="cyp-username" placeholder="@yourusername" value={username} onChange={e=>setUsername(e.target.value)} required autoCapitalize="none" autoCorrect="off" spellCheck={false}/>
      <button className="cyp-primary" type="submit" disabled={loading}>{loading?"Finding posts...":"Find Posts"}</button></div>
    </form>
    {searched&&<><div className="cyp-gallery-heading"><h3>Choose posts</h3><strong>{picked.length} of 8 selected</strong></div>
     {media.length>0?<div className="cyp-grid" role="group" aria-label="Select Instagram posts">
      {media.map((p,i)=><button key={p.url} type="button" onClick={()=>toggle(p)}
       className={"cyp-tile"+(picked.some(x=>x.url===p.url)?" chosen":"")}
       aria-label={"Select Instagram post "+(i+1)} aria-pressed={picked.some(x=>x.url===p.url)}>
       <img src={p.thumbnail} alt={"Instagram post "+(i+1)} loading="lazy" referrerPolicy="no-referrer"/>
       <span className="cyp-check" aria-hidden="true">{picked.some(x=>x.url===p.url)?"✓":""}</span></button>)}</div>:
      <p className="cyp-muted">No authorized thumbnails available for this profile. You can still choose posts by pasting their URLs.</p>}
     <label className="cyp-manual-label" htmlFor="cyp-links">Add public post or reel links (one per line)</label>
     <textarea id="cyp-links" rows={3} value={manual} onChange={e=>setManual(e.target.value)}
      placeholder={"https://www.instagram.com/p/POSTCODE/\nhttps://www.instagram.com/reel/POSTCODE/"}/>
     <button type="button" className="cyp-secondary" onClick={addManual}>Add post links</button>
    </>}
    {picked.length>0&&<div className="cyp-picked"><div className="cyp-gallery-heading"><h3>Selected posts</h3><strong>{picked.length} selected</strong></div>
     {picked.map((p,i)=><div key={p.url} className="cyp-picked-row"><span>{i+1}.</span>
      <a href={p.url} target="_blank" rel="noopener noreferrer">{p.url}</a>
      <button type="button" aria-label={"Remove selected post "+(i+1)} onClick={()=>toggle(p)}>Remove</button></div>)}</div>}
   </section>
   <aside className="cyp-panel cyp-checkout">
    <div className="cyp-section-head"><span className="cyp-step">02</span><div><h2>Customize your order</h2>
     <p>Each post receives the same number of likes.</p></div></div>
    <form onSubmit={wrapUp} className="cyp-form">
     <label>Instagram Likes service<select value={serviceId} onChange={e=>{const s=catalog.find(v=>v.id===e.target.value);setServiceId(e.target.value);if(s)setQuantity(s.min);setReceipt(null)}}>
      {!catalog.length&&<option value="">Live services unavailable</option>}
      {catalog.map(s=><option key={s.id} value={s.id}>{s.name} · {cash(Math.ceil(s.per1000*100))}/1k</option>)}</select></label>
     <label>Likes on each post<input type="number" min={service?.min||1} max={service?.max||100000} step={service?.unitStep||1}
       value={quantity} onChange={e=>{setQuantity(Number(e.target.value));setReceipt(null)}}/>
      <small>{service?service.min.toLocaleString()+"–"+service.max.toLocaleString()+" likes per post · "+cash(Math.ceil(service.per1000*100))+" per 1,000":"Choose an available service."}</small></label>
     <label>Order email<input type="email" value={email} required placeholder="you@example.com" onChange={e=>setEmail(e.target.value)}/></label>
     <div className="cyp-total"><span>Selected posts: <b>{picked.length}</b></span><span>Likes per post: <b>{Number(quantity||0).toLocaleString()}</b></span>
      <span>Total likes: <b>{(picked.length*Number(quantity||0)).toLocaleString()}</b></span>
      <div><small>One checkout total · USD</small><strong>{cash(amount)}</strong></div>
      <p>{amount<500?"Minimum $5.00 total required.":"Exact server-side pricing rechecked before payment."}</p></div>
     {checkout.paymentReady&&!checkout.demo?<PremiumInlineCheckout cardReady={cardReady} busy={busy} canPay={orderReady}
      buttonLabel={busy?"Processing one payment...":"Wrap Up Your Order · "+cash(amount)}/>:<button type="submit" className="cyp-primary cyp-wrap" disabled={!orderReady}>
       {busy?"Processing...":checkout.demo?"Wrap Up Your Order · Preview (No Charge)":"Wrap Up Your Order"}</button>}
     {!checkout.paymentReady&&!checkout.demo&&<p className="cyp-muted">Secure checkout is not enabled in this preview. No card can be charged.</p>}
     {checkout.demo&&<p className="cyp-muted">Preview simulation only: no payment, no supplier orders, no customer emails.</p>}
    </form>
    {notice&&<div className="cyp-notice" role="status" aria-live="polite">{notice}</div>}
    {receipt?.orderId&&<div className="cyp-receipt"><h3>{receipt.payment==="simulated"?"Preview order simulated":"Order recorded"}</h3>
      <p>Order {receipt.orderId} · {receipt.payment} · {receipt.fulfillment}</p>
      {receipt.trackingUrl&&<a href={receipt.trackingUrl}>Track every selected post →</a>}</div>}
    {!cardReady&&checkout.paymentReady&&!checkout.demo&&<button type="button" className="cyp-secondary" onClick={()=>setCardRetry(n=>n+1)}>Retry secure card fields</button>}
   </aside>
  </div>
  <footer className="cyp-footer"><a href="/">Litix home</a><a href="/track">Track a standard order</a>
    <a href="mailto:litixsocial@gmail.com">Customer support</a><span>We never ask for your Instagram password.</span></footer>
 </main>;
}
