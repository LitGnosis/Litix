"use client";
import {useEffect,useState} from "react";
import {litixCustomerServiceName} from "../../lib/serviceCardDisplay.mjs";
import "./track.css";

const validId=value=>/^ltx2_[a-f0-9-]{36}$/.test(String(value||"").trim());
function privateDetails(link){
 try{
  const u=new URL(link,window.location.origin);
  const id=u.searchParams.get("track")||u.searchParams.get("order"),token=u.searchParams.get("token");
  if(!validId(id)||!token||token.length<25||token.length>150)return null;
  return {id,token};
 }catch{return null}
}
function friendlyStatus(order){
 if(!order)return {title:"Order information",description:"Check your latest order progress.",kind:"pending",step:0};
 if(order.payment!=="paid")return {title:"Payment "+(order.payment||"pending"),description:"Payment approval is not confirmed. Do not submit another charge until support checks your order.",kind:"warning",step:0};
 const s=String(order.fulfillment||"").toLowerCase();
 const latest=String(order.status||"").toLowerCase();
 const children=Array.isArray(order.posts)?order.posts:[];
 if(children.some(p=>/^(in progress|in_progress|processing)$/i.test(String(p.status||"")))&&
   !["completed","failed","canceled"].includes(s))
  return {title:"Litix delivery in progress",description:"Your selected posts are receiving delivery. View the latest Litix order progress below.",kind:"progress",step:2};
 if(["in progress","in_progress","processing"].includes(latest)&&!["completed","failed","canceled"].includes(s))
  return {title:"Litix delivery in progress",description:"Your order is still processing. The latest update may show a remaining quantity; final delivery has not been confirmed.",kind:"progress",step:2};
 if(s==="completed")return {title:"Delivery reported complete",description:"Litix has received a completed delivery status. If anything is missing, contact support with your Litix order number.",kind:"success",step:3};
 if(["partial","partially_completed"].includes(s))return {title:"Partially completed",description:"Litix has received a partial delivery update. Check the remaining quantity and contact support if delivery stops.",kind:"warning",step:2};
 if(["failed","canceled","cancelled","refunded","manual_review","review"].includes(s))return {title:"Delivery needs support",description:"Your payment was recorded, but fulfillment needs review. Do not place a duplicate order.",kind:"warning",step:1};
 if(["in_progress","processing"].includes(s))return {title:"Litix is processing your order",description:"Your Litix order is still being processed. Followers may arrive in stages; delivery has not yet been confirmed.",kind:"progress",step:2};
 if(["submitted","dispatching","pending","queued"].includes(s))return {title:"Litix order submitted",description:"Your payment and order submission are confirmed. Delivery is still pending; check back for an updated Litix status.",kind:"progress",step:2};
 return {title:"Awaiting Litix update",description:"Your order has been received. Check back for delivery progress or contact Litix support.",kind:"pending",step:1};
}
export default function OrderTracker(){
 const [recent,setRecent]=useState([]);
 const [orderId,setOrderId]=useState("");
 const [email,setEmail]=useState("");
 const [trackingLink,setTrackingLink]=useState("");
 const [order,setOrder]=useState(null);
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [method,setMethod]=useState(null);
 const [lastChecked,setLastChecked]=useState(null);
 useEffect(()=>{
  document.title="Track your order | Litix";
  let records=[];
  try{records=JSON.parse(localStorage.getItem("litix:saved-orders")||"[]");if(!Array.isArray(records))records=[]}catch{}
  records=records.filter(x=>validId(x?.id)&&privateDetails(x?.url)).slice(0,8);
  setRecent(records);
  const u=new URL(window.location.href);
  const providedId=u.searchParams.get("order");
  if(validId(providedId))setOrderId(providedId);
  if(u.searchParams.has("track")&&u.searchParams.has("token")){
   const credentials=privateDetails(u.href);
   // Remove the bearer token from browser address bar and future referrers after reading it.
   window.history.replaceState(window.history.state,"","/track");
   if(credentials){setOrderId(credentials.id);runStatus({kind:"private",...credentials})}
   else setNotice("This tracking link is incomplete. Paste the full link or enter your order number and checkout email.");
  }
 },[]);
 async function runStatus(credentials){
  if(!credentials)return;
  setBusy(true);setNotice("");
  try{
   let response;
   if(credentials.kind==="private"){
    response=await fetch("/api/track?id="+encodeURIComponent(credentials.id)+"&token="+encodeURIComponent(credentials.token),{cache:"no-store"});
   }else{
    response=await fetch("/api/order-lookup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({orderId:credentials.id,email:credentials.email}),cache:"no-store"});
   }
   const body=await response.json();
   if(!response.ok)throw Error(body.error||"Order tracking is temporarily unavailable.");
   if(!body.order)throw Error("Order details are temporarily unavailable.");
   setOrder(body.order);setOrderId(body.order.id);setMethod(credentials);setLastChecked(new Date());
   if(body.order.statusNote)setNotice(body.order.statusNote);
  }catch(e){setNotice(e?.message||"Unable to retrieve the order. Please try again.")}
  finally{setBusy(false)}
 }
 // Private tracking refreshes from the existing Litix database only; it
 // does not call the supplier or generate another charge or fulfillment order.
 useEffect(()=>{
  if(!method||!order?.id)return;
  const timer=setInterval(()=>{
   if(document.visibilityState==="visible"&&!busy)void runStatus(method);
  },120000);
  return()=>clearInterval(timer);
 },[method,order?.id,busy]);
 function submitEmail(e){
  e.preventDefault();
  if(busy)return;
  const id=orderId.trim(),mail=email.trim().toLowerCase();
  if(!validId(id)){setNotice("Enter the full Litix order number. It starts with ltx2_.");return}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)){setNotice("Enter the email address used at checkout.");return}
  runStatus({kind:"email",id,email:mail});
 }
 function checkLink(e){
  e.preventDefault();
  if(busy)return;
  const credentials=privateDetails(trackingLink.trim());
  if(!credentials){setNotice("Paste the full Litix private tracking link, including its token.");return}
  runStatus({kind:"private",...credentials});
 }
 const status=friendlyStatus(order);
 const money=order?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(order.amount||0)):null;
 const helpUrl="https://wa.me/19452106315?text="+encodeURIComponent("Hi Litix, I need help with my paid order "+(order?.id||orderId||"")+". The delivery is not showing on my account.");
 return <main className="ltx-track">
  <div className="ltx-track-wrap">
   <header className="ltx-track-nav"><a href="/" aria-label="Litix home"><img src="/assets/brand/litix-logo.webp" width="115" alt="Litix logo"/></a><a href="/" className="ltx-track-home">Home</a></header>
   <div className="ltx-track-intro"><div className="ltx-track-eyebrow">LITIX ORDER CENTER</div><h1>Track your order</h1><p>See your payment, Litix processing, and delivery status in one place. No account or password required.</p><p className="ltx-track-email-updates">Automatic Litix email updates are sent to your checkout email whenever your delivery status meaningfully changes. Your open tracking page also refreshes every two minutes. No signup or repeat purchase is required.</p></div>
   {order&&<section className="ltx-track-card ltx-track-result" aria-label="Order status">
    <div className="ltx-track-kicker">LATEST ORDER STATUS</div>
    <div className={"ltx-track-pill ltx-track-pill-"+status.kind}>{status.title}</div>
    <h2 className="ltx-track-order-id">{order.id}</h2>
    <p className="ltx-track-status-desc">{status.description}</p>
    <div className="ltx-track-steps" aria-label="Order progress">
     {["Payment approved","Order processing","Delivery completed"].map((label,i)=><div key={label} className={"ltx-track-step "+(i<status.step?"ltx-track-step-done":"")}><span className="ltx-track-step-bullet">{i<status.step?"✓":i+1}</span><span>{label}</span></div>)}
    </div>
    <div className="ltx-track-facts">
     <div><small>Payment</small><strong>{order.payment==="paid"?"Paid":order.payment||"Pending"}</strong></div>
     <div><small>Quantity</small><strong>{Number(order.quantity||0).toLocaleString()}</strong></div>
     <div><small>Total</small><strong>{money}</strong></div>
     
     {order.remains!==null&&order.remains!==undefined&&<div><small>Remaining to deliver</small><strong>{Number(order.remains).toLocaleString()}</strong></div>}
     {order.status&&<div><small>Latest Litix status</small><strong>{order.status}</strong></div>}
    </div>
    <p className="ltx-track-service"><b>Service:</b> {litixCustomerServiceName(order.service)}</p>
    {Array.isArray(order.posts)&&order.posts.length>0&&<section aria-label="Individual post delivery status" style={{padding:"14px 0"}}>
      <h3 style={{fontSize:17,margin:"0 0 12px"}}>Your selected posts</h3>
      {order.posts.some(p=>Number.isSafeInteger(p.delivered))&&<p className="ltx-track-meta">
        Litix delivery progress: {order.posts.reduce((sum,p)=>sum+(Number.isSafeInteger(p.delivered)?p.delivered:0),0).toLocaleString()} of {order.posts.reduce((sum,p)=>sum+Number(p.quantity||0),0).toLocaleString()} likes ordered.
        {order.posts.some(p=>!Number.isSafeInteger(p.delivered))?" Some posts have not reported quantities yet.":""}
       </p>}
      <div style={{display:"grid",gap:10}}>{order.posts.map(post=><article key={post.index} style={{padding:12,border:"1px solid #4c99cc80",borderRadius:12,background:"#091f35"}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:9,flexWrap:"wrap"}}>
         <strong>Post {post.index} · {Number(post.quantity||0).toLocaleString()} likes</strong>
         <span className="small">{post.status||"Processing"}</span>
       </div>
       <p style={{margin:"8px 0 0",wordBreak:"break-word",fontSize:12}}><a href={post.url} target="_blank" rel="noopener noreferrer">View selected post</a></p>
       {Number.isSafeInteger(post.delivered)&&<div style={{margin:"8px 0 0"}}>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={Number(post.quantity||0)} aria-valuenow={post.delivered}
           aria-label={"Reported likes delivered for post "+post.index}
           style={{height:7,borderRadius:6,background:"#163550",overflow:"hidden"}}>
            <div style={{height:"100%",width:Math.min(100,100*post.delivered/Math.max(1,Number(post.quantity||1)))+"%",background:"#81c7fb"}}/>
          </div>
          <p className="small" style={{margin:"6px 0 0"}}>{post.delivered.toLocaleString()} reported delivered · {(Number(post.quantity||0)-post.delivered).toLocaleString()} remaining</p>
         </div>}
         {!Number.isSafeInteger(post.delivered)&&post.remains!==null&&post.remains!==undefined&&<p className="small" style={{margin:"6px 0 0"}}>{Number(post.remains).toLocaleString()} likes remaining</p>}
         {post.checkedAt&&<p className="small" style={{margin:"5px 0 0"}}>Status checked {new Date(post.checkedAt).toLocaleString()}</p>}
      </article>)}</div>
     </section>}

    {order.checkedAt&&<p className="ltx-track-meta">Status updated: {new Date(order.checkedAt).toLocaleString()} {order.liveSupplierStatus?"(live update)":"(last recorded update)"}</p>}
    <div className="ltx-track-actions"><button type="button" className="ltx-track-btn" disabled={busy} onClick={()=>runStatus(method)}>{busy?"Checking status…":"Refresh status"}</button><a className="ltx-track-btn ltx-track-btn-secondary" href={helpUrl} target="_blank" rel="noreferrer noopener">Get order help</a></div>
    <p className="ltx-track-footnote">Payment confirmation and actual follower delivery are separate steps. Litix displays the latest recorded delivery update; followers will be confirmed when delivery is reported complete.</p>
   </section>}
   {recent.length>0&&<section className="ltx-track-card">
    <div className="ltx-track-kicker">ORDERS ON THIS DEVICE</div><h2>Tap an order to check it</h2>
    <div className="ltx-track-recent">{recent.map(item=><button type="button" className="ltx-track-recent-item" disabled={busy} key={item.id} onClick={()=>{const cred=privateDetails(item.url);if(cred)runStatus({kind:"private",...cred})}}>
     <span><strong>{item.id}</strong><small>{item.createdAt?new Date(item.createdAt).toLocaleDateString():"Saved order"} · {item.payment||"Order received"}</small></span><span aria-hidden="true">View status →</span>
    </button>)}</div>
   </section>}
   <section className="ltx-track-card">
    <div className="ltx-track-kicker">NO TRACKING LINK? NO PROBLEM.</div><h2>Look up your order</h2>
    <p className="ltx-track-helper">Enter your Litix order number and the email you used to check out. We'll retrieve the latest available Litix delivery status.</p>
    <form onSubmit={submitEmail} className="ltx-track-form"><label>Order number<input value={orderId} onChange={e=>setOrderId(e.target.value)} autoCapitalize="none" spellCheck={false} placeholder="ltx2_..." required/></label>
     <label>Checkout email<input type="email" autoComplete="email" inputMode="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required/></label>
     <button type="submit" disabled={busy} className="ltx-track-btn">{busy?"Checking order…":"Check my order"}</button>
    </form>
    <details className="ltx-track-alternative"><summary>I have a private tracking link</summary>
     <form onSubmit={checkLink} className="ltx-track-form"><label>Paste tracking URL<input value={trackingLink} onChange={e=>setTrackingLink(e.target.value)} autoCapitalize="none" spellCheck={false} placeholder="https://www.litix.net/?track=..."/></label><button type="submit" disabled={busy} className="ltx-track-btn ltx-track-btn-secondary">Use my tracking link</button></form>
    </details>
   </section>
   {notice&&<p className="ltx-track-notice" role="status" aria-live="polite">{notice}</p>}
   <p className="ltx-track-meta">Never enter your Instagram or TikTok password. Never share payment card details or your private tracking token with support.</p>
   <footer className="ltx-track-footer"><a href="/">Litix Home</a><a href="/refunds">Refunds &amp; order issues</a><a href="/privacy">Privacy</a></footer>
  </div>
 </main>
}
