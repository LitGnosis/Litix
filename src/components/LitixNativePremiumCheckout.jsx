"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";

const SKU="litix-native-30day-campaign-pro";
const initial={business:"",audience:"",offer:"",action:"",platform:"Instagram",website:""};
const networks=["Instagram","TikTok","YouTube","Facebook","LinkedIn","X"];
export default function LitixNativePremiumCheckout(){
 const [active,setActive]=useState(false),[loading,setLoading]=useState(true);
 const [brief,setBrief]=useState(initial),[email,setEmail]=useState("");
 const [price,setPrice]=useState(null),[key,setKey]=useState("");
 const [fieldsReady,setFieldsReady]=useState(false),[busy,setBusy]=useState(false);
 const [notice,setNotice]=useState(""),[privateLink,setPrivateLink]=useState("");
 const [attempted,setAttempted]=useState(false),[reference,setReference]=useState("");
 const idRef=useRef(null),lock=useRef(false),callback=useRef(null);
 useEffect(()=>{
  let live=true;
  fetch("/api/native/v1/paid",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject())
   .then(x=>{if(live)setActive(x.checkoutEnabled===true);})
   .catch(()=>{if(live)setActive(false);})
   .finally(()=>{if(live)setLoading(false);});
  return ()=>{live=false;};
 },[]);
 function change(name,value){
  if(attempted)return;
  setBrief(b=>({...b,[name]:value}));setPrice(null);setFieldsReady(false);
  setNotice("");idRef.current=null;
 }
 async function quote(e){
  e.preventDefault();if(busy||attempted)return;
  setBusy(true);setNotice("");setPrice(null);
  try{
   const res=await fetch("/api/native/v1/paid",{
    method:"POST",cache:"no-store",headers:{"content-type":"application/json"},
    body:JSON.stringify({action:"quote",serviceId:SKU,brief})
   });
   const q=await res.json().catch(()=>({}));
   if(!res.ok||q.available!==true||!Number.isSafeInteger(q.priceCents)||q.priceCents<=0)
    throw Error("Native purchases are not activated.");
   const cfgRes=await fetch("/api/config",{cache:"no-store"});
   const cfg=await cfgRes.json().catch(()=>({}));
   if(!cfgRes.ok||typeof cfg.publicKey!=="string"||cfg.publicKey.length<12)
    throw Error("Secure hosted card fields are not available.");
   setKey(cfg.publicKey);setPrice(q.priceCents);
   setNotice("Price verified. Enter payment details only in the hosted card fields.");
  }catch(err){setNotice(err.message||"Checkout isn't ready.");}
  finally{setBusy(false);}
 }
 async function consume(token){
  if(lock.current||price===null)return;
  lock.current=true;setAttempted(true);setBusy(true);
  const requestId=idRef.current||window.crypto.randomUUID();
  idRef.current=requestId;setReference(requestId);
  try{
   const res=await fetch("/api/native/v1/paid",{
    method:"POST",cache:"no-store",headers:{"content-type":"application/json"},
    body:JSON.stringify({serviceId:SKU,brief,email,requestId,paymentToken:token,expectedAmountCents:price})
   });
   const d=await res.json().catch(()=>({}));
   if(typeof d.privateStatusUrl==="string"){
    const url=new URL(d.privateStatusUrl);
    if(url.origin==="https://www.litix.net"&&url.pathname==="/native/order")
     setPrivateLink(url.pathname+url.search);
   }
   if(d.payment==="APPROVED_UNVERIFIED")
    setNotice("Payment approved, awaiting settlement. Save the private order link; the file is not yet available.");
   else if(d.payment==="DECLINED")
    setNotice("The card was declined. Contact Litix before attempting another payment.");
   else setNotice("Payment needs review. Do not retry. Contact Litix with the request reference.");
  }catch{
   setNotice("The payment outcome is unknown. Do not retry. Contact Litix with the request reference.");
  }finally{setBusy(false);}
 }
 callback.current=consume;
 useEffect(()=>{
  if(!active||price===null||!key||attempted)return;
  let live=true,script=null,deadline=null;
  setFieldsReady(false);
  const failed=()=>{if(live){setFieldsReady(false);setNotice("PayKings secure fields are unavailable. No payment was requested.");}};
  const init=()=>{
   const sdk=window.CollectJS;
   if(!live||!sdk||typeof sdk.configure!=="function"){failed();return;}
   try{
    sdk.configure({
     variant:"inline",styleSniffer:false,
     fields:{
      ccnumber:{selector:"#native-ccnumber",title:"Card number",placeholder:"Card number"},
      ccexp:{selector:"#native-ccexp",title:"Expiration",placeholder:"MM / YY"},
      cvv:{selector:"#native-cvv",title:"Security code",placeholder:"CVV"}
     },
     callback:result=>{
      if(!live||lock.current)return;
      if(typeof result?.token==="string"&&result.token.length>=10)callback.current?.(result.token);
      else failed();
     },
     fieldsAvailableCallback:()=>{if(live){setFieldsReady(true);setNotice("");}}
    });
   }catch{failed();}
  };
  script=document.createElement("script");
  script.src="https://secure.nmi.com/token/Collect.js";
  script.async=true;
  script.setAttribute("data-tokenization-key",key);
  script.setAttribute("data-variant","inline");
  script.setAttribute("data-field-ccnumber-selector","#native-ccnumber");
  script.setAttribute("data-field-ccexp-selector","#native-ccexp");
  script.setAttribute("data-field-cvv-selector","#native-cvv");
  script.onload=init;script.onerror=failed;
  document.body.appendChild(script);
  deadline=window.setTimeout(()=>{if(live&&!window.CollectJS)failed();},15000);
  return ()=>{live=false;setFieldsReady(false);if(deadline)window.clearTimeout(deadline);if(script)script.remove();};
 },[active,price,key,attempted]);
 function pay(){
  if(busy||attempted||price===null||!fieldsReady||!email)return;
  const sdk=window.CollectJS;
  if(!sdk||typeof sdk.startPaymentRequest!=="function"){
   setNotice("Hosted card fields are unavailable; no charge attempted.");return;
  }
  setBusy(true);setNotice("Tokenizing payment. Do not submit twice.");
  try{sdk.startPaymentRequest();}
  catch{setBusy(false);setNotice("Tokenization failed. No payment was requested.");}
 }
 if(loading)return <section className="ls-panel"><p role="status">Checking secure checkout readiness…</p></section>;
 if(!active)return <section className="ls-panel">
  <h2>Native paid checkout is not yet activated</h2>
  <p>The 30-Day Campaign Kit is being prepared for safe first-party payment and delivery. No card information is collected here while activation is incomplete.</p>
  <p><Link href="/shop">Use the existing Litix store checkout</Link> or <Link href="/native">try the free creator tools</Link>.</p>
 </section>;
 return <section className="ls-panel">
  <h2>Secure 30-Day Campaign Kit checkout</h2>
  {!attempted&&<form onSubmit={quote}>
   <div className="ls-tool-fields">
    <label>Business <input required minLength={2} maxLength={80} value={brief.business} onChange={e=>change("business",e.target.value)}/></label>
    <label>Audience <input required minLength={2} maxLength={110} value={brief.audience} onChange={e=>change("audience",e.target.value)}/></label>
    <label>Offer <textarea required minLength={4} maxLength={170} rows={2} value={brief.offer} onChange={e=>change("offer",e.target.value)}/></label>
    <label>Call to action <input required minLength={3} maxLength={110} value={brief.action} onChange={e=>change("action",e.target.value)}/></label>
    <label>Platform <select value={brief.platform} onChange={e=>change("platform",e.target.value)}>
     {networks.map(n=><option key={n}>{n}</option>)}
    </select></label>
    <label>Website (optional) <input type="url" maxLength={300} value={brief.website} onChange={e=>change("website",e.target.value)}/></label>
    <label>Receipt email <input type="email" required maxLength={254} value={email} onChange={e=>{setEmail(e.target.value);setPrice(null);}}/></label>
   </div>
   <button className="ls-cta" type="submit" disabled={busy||price!==null}>Verify price</button>
  </form>}
  {price!==null&&!attempted&&<div className="ls-tool-result">
   <h3>{"Verified price: $"+(price/100).toFixed(2)+" USD"}</h3>
   <p>Card details are entered only into NMI-hosted fields.</p>
   <label>Card number<div id="native-ccnumber" style={{minHeight:48}}/></label>
   <label>Expiration<div id="native-ccexp" style={{minHeight:48}}/></label>
   <label>Security code<div id="native-cvv" style={{minHeight:48}}/></label>
   <button type="button" disabled={!fieldsReady||busy} onClick={pay}>Pay securely</button>
  </div>}
  {reference&&<p>Request reference: <code>{reference}</code></p>}
  {privateLink&&<p><Link href={privateLink}>Open your private order status and download link</Link></p>}
  <p role="status" aria-live="polite">{notice}</p>
  <p className="ls-note">If your result is unclear, do not pay again. Contact Litix support with your request reference.</p>
 </section>;
}
