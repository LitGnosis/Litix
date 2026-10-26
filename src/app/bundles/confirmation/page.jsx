"use client";
import {useEffect,useState} from "react";
export default function BundleConfirmation(){
 const [data,setData]=useState(null),[error,setError]=useState(""),[link,setLink]=useState("");
 useEffect(()=>{
  let saved;try{saved=JSON.parse(sessionStorage.getItem("litix:bundle-confirmation")||"null")}catch{}
  const id=new URLSearchParams(location.search).get("id");
  if(!saved||saved.id!==id){setError("This browser does not have the private tracking token. Contact LITIX with your order number.");return}
  const url="/api/bundles/order?id="+encodeURIComponent(id)+"&token="+encodeURIComponent(saved.token);
  setLink(location.origin+"/bundles/confirmation?id="+encodeURIComponent(id));
  fetch(url,{cache:"no-store"}).then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error||"Tracking unavailable");return v}).then(setData).catch(e=>setError(e.message));
 },[]);
 return <main className="wrap"><nav className="nav"><a href="/" className="brand">LITIX</a><a href="/bundles">Growth Bundles</a></nav><section className="panel" style={{maxWidth:750,margin:"40px auto"}}>
 <span className="kicker">BUNDLE ORDER CONFIRMATION</span><h1>Order status and WhatsApp submission</h1>
 {data?<><h2>{data.order.package}</h2><p><strong>Order number:</strong> {data.order.id}</p><p><strong>Payment:</strong> {data.order.payment}</p><p><strong>Status:</strong> {data.order.status}</p>
 <p className="lg-bundle-warning"><strong>REQUIRED NEXT STEP — OPEN WHATSAPP AND SEND YOUR ORDER NUMBER.</strong> You must message LITIX to request manual fulfillment. {data.instructions}</p>
 {data.whatsappUrl?<a className="pay" style={{display:"inline-flex",textDecoration:"none",padding:14}} href={data.whatsappUrl} target="_blank" rel="noopener noreferrer">Message LITIX on WhatsApp to finish your order</a>:<p role="status" className="lg-bundle-warning">The official WhatsApp number has not yet been verified. Please keep your order ID and contact LITIX support through its current official website.</p>}
 <p className="small">Your payment approval is recorded separately from final settlement. LITIX personally confirms payment and your selected allocations before fulfilling anything.</p><p className="small">Send your Instagram or TikTok account username for Followers, and up to 10 post links or screenshots for Likes, Views and Shares. Valid public post URLs are required before post fulfillment. All delivery is manually verified.</p>
 <h3>Post review</h3>{data.posts.length?data.posts.map((p,i)=><p key={i}>{p.status} · {p.url}</p>):<p className="small">No posts submitted for review yet.</p>}
 <h3>Delivery records</h3>{data.deliveries.length?data.deliveries.map((p,i)=><p key={i}>{p.kind}: {p.quantity} · {p.status}{p.supplierOrderId?" · supplier #"+p.supplierOrderId:""}</p>):<p className="small">No supplier delivery approved or submitted.</p>}
 </>:error?<p role="status">{error}</p>:<p>Loading order details…</p>}
 <p className="small">Keep this confirmation in the browser used for purchase. Never share card details through WhatsApp.</p></section></main>
}
