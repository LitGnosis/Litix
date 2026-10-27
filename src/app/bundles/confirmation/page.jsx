"use client";
import {useEffect,useState} from "react";
export default function BundleConfirmation(){
 const [data,setData]=useState(null),[error,setError]=useState("");
 useEffect(()=>{
  let saved;try{saved=JSON.parse(sessionStorage.getItem("litix:bundle-confirmation")||"null")}catch{}
  const u=new URL(location.href),id=u.searchParams.get("id"),fromEmail=u.searchParams.get("token");
  if(fromEmail&&id&&/^lbg_[a-f0-9-]{36}$/.test(id)&&fromEmail.length<=180){
   saved={id,token:fromEmail};
   try{sessionStorage.setItem("litix:bundle-confirmation",JSON.stringify(saved))}catch{}
   // Private tracking tokens are not left in browser history after opening an emailed link.
   u.searchParams.delete("token");history.replaceState(null,"",u.pathname+u.search);
  }
  if(!id||!saved||saved.id!==id||!saved.token){
   setError("Use the private tracking link in your LITIX confirmation email or open this page in the browser where you placed your order. If you cannot find it, contact litixsocial@gmail.com with your order number.");return;
  }
  fetch("/api/bundles/order?id="+encodeURIComponent(id)+"&token="+encodeURIComponent(saved.token),{cache:"no-store"})
   .then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error||"Tracking unavailable");return v})
   .then(setData).catch(e=>setError(e.message));
 },[]);
 const order=data?.order;
 const firstLine=order?"LITIX order "+order.id+" — "+order.package+" ("+order.platform+"), USD $"+order.amount:"";
 const subject=order?"LITIX Order Submission — "+order.id:"";
 const mailBody=order?[
  "Hello LITIX,",firstLine,
  "My order is awaiting independent payment verification.",
  "I am sending my payment receipt, my public Instagram/TikTok account, and up to 10 selected post links or screenshots.",
  "Please find my attached screenshots and receipt below (attach files before sending).",
  "Post links (up to 10):","1. ","2. ","3. ","4. ","5. ","6. ","7. ","8. ","9. ","10. ","",
  "Thank you."
 ].join("\n"):"";
 const emailLink=order?"mailto:Litixsocial@gmail.com?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(mailBody):null;
 const paid=order?.payment==="settled";
 return <main className="wrap"><nav className="nav"><a href="/" className="brand">LITIX</a><a href="/bundles">Growth Bundles</a></nav>
  <section className="panel" style={{maxWidth:770,margin:"32px auto"}}>
   <span className="kicker">LITIX · BUNDLE ORDER</span><h1>Order confirmation and submission</h1>
   {order?<div>
    <h2>{order.package}</h2>
    <p className="small">Thank you for choosing LITIX! Your order has been placed successfully. Save your order number and choose any submission method below.</p>
    <div className="lg-bundle-warning" aria-label="Order information">
     <p><strong>Order number:</strong> {order.id}</p>
     <p><strong>Selected platform:</strong> {order.platform}</p>
     <p><strong>Bundle:</strong> {order.package}</p>
     <p><strong>Total:</strong> USD ${order.amount}</p>
     <p><strong>Payment verification status:</strong> {paid?"Verified paid":"AWAITING PAYMENT VERIFICATION"}</p>
     <p><strong>Order status:</strong> {order.status}</p>
    </div>
    {!paid&&<p className="lg-bundle-warning"><strong>Payment is NOT marked paid yet.</strong> Bluevine is hosted separately. Returning to LITIX, uploading a receipt, or opening this page does not verify payment. LITIX will confirm the real transaction directly in Bluevine before any fulfillment. If you already paid, do not pay again while verification is pending.</p>}
    <h3>Submit your receipt and up to 10 posts</h3>
    <p className="small">Choose WhatsApp, email, or Instagram. Include your order number, payment receipt, Instagram/TikTok profile, and up to 10 post links or screenshots. Attach receipt and screenshots manually in the app you choose. LITIX reviews posts and fulfillment manually.</p>
    <div className="lg-bundle-actions" style={{display:"grid",gap:12,margin:"18px 0"}}>
     {data.whatsappUrl?<a className="lg-bundle-buy" href={data.whatsappUrl} target="_blank" rel="noopener noreferrer">Send Order Details via WhatsApp</a>:<p role="status">WhatsApp contact is unavailable. Email or Instagram are available below.</p>}
     <a className="lg-bundle-buy" href={emailLink}>Email My Order Details</a>
     <a className="lg-bundle-buy" href="https://www.instagram.com/litixsocial/" target="_blank" rel="noopener noreferrer">Message LITIX on Instagram</a>
    </div>
    <p className="small">WhatsApp opens the LITIX business chat with a prefilled order message. Email opens your email app with a prefilled subject and message; attach payment receipts and screenshots before sending. Instagram opens the @Litixsocial profile; send a DM with the same information. <strong>Opening an app does not send your message automatically.</strong></p>
    <p className="small">All package quantities are totals for this purchase, not repeated for every post. Followers apply to your account. {data.instructions}</p>
    <h3>Post review</h3>
    {data.posts.length?data.posts.map((p,i)=><p key={i}>{p.status} · {p.url}</p>):<p className="small">No posts recorded for review yet.</p>}
    <h3>Delivery records</h3>
    {data.deliveries.length?data.deliveries.map((p,i)=><p key={i}>{p.kind}: {p.quantity} · {p.status}{p.supplierOrderId?" · supplier #"+p.supplierOrderId:""}</p>):<p className="small">No deliveries approved or submitted.</p>}
   </div>:error?<p role="status">{error}</p>:<p>Loading order details…</p>}
   <a className="alt" style={{display:"inline-flex",padding:"12px 18px",textDecoration:"none",borderRadius:10,marginTop:18}} href="/">Return to LITIX</a>
   <p className="small">Keep the private link from your confirmation email. We never need your credit-card number or account password.</p>
  </section>
 </main>;
}
