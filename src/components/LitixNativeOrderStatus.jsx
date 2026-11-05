"use client";
import {useEffect,useState} from "react";
export default function LitixNativeOrderStatus(){
 const [link,setLink]=useState(null),[data,setData]=useState(null),
 [working,setWorking]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{
  const p=new URLSearchParams(window.location.search);
  const id=p.get("id"),token=p.get("token");
  if(id&&token&&/^[a-f0-9-]{36}$/i.test(id)&&/^[a-f0-9]{64}$/.test(token))
   setLink({id,token});
  else setMessage("A complete private Litix Native order link is required.");
 },[]);
 async function refresh(){
  if(!link||working)return;
  setWorking(true);setMessage("");setData(null);
  try{
   const p=new URLSearchParams(link);
   const res=await fetch("/api/native/v1/paid/order?"+p,{cache:"no-store"});
   const obj=await res.json();
   if(!res.ok&&res.status!==202)throw Error("Order lookup unavailable or private link invalid.");
   setData(obj);
   if(!obj.delivered)setMessage("Payment is still being verified against settlement. No further payment is required.");
  }catch(e){setMessage(e.message||"Unable to load private order.");}
  finally{setWorking(false);}
 }
 useEffect(()=>{if(link)refresh();/* Order initialized once; future checks are deliberate. */},[link]);
 function download(){
  if(!data?.delivered||typeof data.content!=="string"||!data.filename)return;
  if(!["text/plain; charset=utf-8","text/html; charset=utf-8","text/csv; charset=utf-8"].includes(data.mimeType))return;
  const blob=new Blob([data.content],{type:data.mimeType});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=data.filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
 }
 return <section className="ls-panel">
  <h1>Private Litix Native order</h1>
  <p>Check settlement status and download your own digital file after payment is verified.</p>
  {link&&<p>Order reference: <code>{link.id}</code></p>}
  <button type="button" className="ls-cta" disabled={!link||working} onClick={refresh}>
   {working?"Checking your order…":"Check status"}
  </button>
  <p role="status" aria-live="polite">{message}</p>
  {data&&<div className="ls-tool-result">
   <p>Payment: <strong>{String(data.payment||"pending").replace(/_/g," ")}</strong></p>
   {data.delivered&&<>
    <p>Your verified original file is ready: <strong>{data.filename}</strong></p>
    <button type="button" onClick={download}>Download your digital file</button>
   </>}
  </div>}
  <p className="ls-note">Keep this private link confidential. Never share a password or payment-card details with a supplier. If a charge requires review, contact Litix support instead of paying twice.</p>
 </section>;
}
