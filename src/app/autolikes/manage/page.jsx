"use client";
import {useEffect,useState} from "react";
const money=c=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(c||0)/100);
export default function AutoLikesManage(){
 const [token,setToken]=useState(""),[data,setData]=useState(null),[notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false);
 async function refresh(secret){
  setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/autolikes/manage",{headers:{authorization:"Bearer "+secret},cache:"no-store"});
   const body=await r.json();if(!r.ok)throw Error(body.error||"Unable to read subscription");
   setData(body);
  }catch(e){setNotice(e.message||"Unable to retrieve subscription status")}finally{setBusy(false)}
 }
 useEffect(()=>{
  const u=new URL(location.href),key=u.searchParams.get("token")||"";
  history.replaceState(history.state,"","/autolikes/manage");
  if(key){setToken(key);void refresh(key)}else setNotice("Open this page from your private Litix subscription management link.");
 },[]);
 async function cancel(){
  if(!confirm||!token||busy)return;
  setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/autolikes/manage",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+token},
    body:JSON.stringify({action:"cancel",confirmCancel:true})});
   const body=await r.json();setNotice(body.note||body.message||body.error||"Cancellation request received.");
   if(r.ok&&body.cancelled)await refresh(token);
  }catch{setNotice("Cancellation could not be confirmed. Contact Litix support; do not repeat this request.");}
  finally{setBusy(false)}
 }
 return <main className="wrap">
  <nav className="nav"><a className="brand" href="/"><img src="/assets/brand/litix-logo.webp" alt="Litix" className="litix-new-logo"/></a><div><a href="/autolikes">AutoLikes</a><a href="/shop">Shop</a><a href="/track">Order Tracking</a></div></nav>
  <section className="panel" style={{maxWidth:800,margin:"30px auto"}}>
   <div className="kicker">LITIX PRIVATE SUBSCRIPTION CENTER</div>
   <h1>Manage AutoLikes</h1>
   <p>View your verified payments, delivery status, and monthly renewal. Your management link is private—never share it.</p>
   {notice&&<p role="status">{notice}</p>}
   {busy&&<p>Checking account…</p>}
   {data?.subscription&&<>
    <h2>{data.subscription.platform==="instagram"?"Instagram":"TikTok"} AutoLikes</h2>
    <p><strong>{money(data.subscription.monthlyAmountCents)} per month</strong> · {data.subscription.likesPerPost} likes per new post · up to {data.subscription.postsPerMonth} new posts each paid month.</p>
    <p>Profile: {data.subscription.profile}</p>
    <p>Subscription: {data.subscription.status} · Payment: {data.subscription.paymentStatus}</p>
    <p>Paid term expires: {data.subscription.currentPeriodEnd?new Date(data.subscription.currentPeriodEnd).toLocaleDateString():"Pending payment verification"}</p>
    <h2>Delivery periods</h2>
    {!data.cycles.length&&<p>Delivery will appear here once an actual recurring payment is independently verified.</p>}
    {data.cycles.map(c=><p key={c.period}>{c.period} — {c.state} {c.status?" · "+c.status:""}</p>)}
    {data.subscription.status!=="CANCELLED"&&<section className="panel" style={{marginTop:22}}>
     <h2>Stop future renewals</h2>
     <p>Cancellation stops future recurring charges. Delivery already submitted for your paid term may continue until its scheduled expiry.</p>
     <label><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/> I want to cancel future AutoLikes renewals.</label>
     <button type="button" disabled={busy||!confirm||!data.cancellationAvailable} onClick={cancel}>Cancel future renewals</button>
     {!data.cancellationAvailable&&<p>Automated cancellation is temporarily unavailable. Contact <a href="mailto:litixsocial@gmail.com">Litix billing support</a> to request cancellation.</p>}
    </section>}
   </>}
  </section>
 </main>;
}
