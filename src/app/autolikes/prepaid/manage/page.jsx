"use client";
import {useEffect,useState} from "react";
const money=c=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(c||0)/100);
export default function PrepaidAutoLikesManage(){
 const [token,setToken]=useState(""),[data,setData]=useState(null),[error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 async function refresh(secret){
  if(!secret)return;setBusy(true);
  try{
   const response=await fetch("/api/autolikes/prepaid/manage",{
    headers:{authorization:"Bearer "+secret},cache:"no-store"});
   const value=await response.json();
   if(!response.ok)throw Error(value.error||"Order is unavailable");
   setData(value.order);setError("");
  }catch(e){setError(e.message||"Unable to retrieve this order")}
  finally{setBusy(false)}
 }
 useEffect(()=>{
  const u=new URL(location.href),secret=u.searchParams.get("token")||"";
  history.replaceState(history.state,"","/autolikes/prepaid/manage");
  if(secret){setToken(secret);void refresh(secret)}
  else setError("Use your private Litix confirmation link to access this order.");
 },[]);
 return <main className="wrap">
  <nav className="nav"><a className="brand" href="/"><img src="/assets/brand/litix-logo.webp" alt="Litix" className="litix-new-logo"/></a>
   <div><a href="/autolikes">AutoLikes</a><a href="/shop">Shop</a><a href="/track">Track Order</a></div></nav>
  <section className="panel" style={{maxWidth:800,margin:"36px auto"}}>
   <div className="kicker">LITIX PRIVATE ORDER TRACKING</div><h1>AutoLikes Order Status</h1>
   <p>This private view shows your payment status and the progress of your one-time new-post package.</p>
   {error&&<p role="alert">{error}</p>}
   {busy&&<p>Checking your Litix order…</p>}
   {data&&<>
    <h2>Order {data.id}</h2><p>Platform: {data.platform} · Profile: {data.profile}</p>
    <p><strong>{money(data.paidAmountCents)} one-time</strong> · {data.likesPerPost.toLocaleString()} likes per new post · Up to {data.coveredPosts} future posts</p>
    <p>Payment: {data.payment} · Order: {data.status}</p>
    {data.deliveryStatus&&<p>Delivery progress: {data.deliveryStatus}</p>}
    <p>Plan ends: {data.expiresAt?new Date(data.expiresAt).toLocaleDateString():"Pending payment confirmation"}</p>
    <p>No automatic renewals or extra customer charges.</p>
    <button type="button" onClick={()=>refresh(token)} disabled={busy}>{busy?"Refreshing…":"Refresh status"}</button>
    {data.status==="Needs support review"&&<p><a href="mailto:litixsocial@gmail.com">Contact Litix support</a> with order {data.id}. Please do not purchase the same package again.</p>}
   </>}
  </section>
 </main>;
}
