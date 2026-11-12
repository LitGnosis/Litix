"use client";
import {useEffect,useRef,useState} from "react";
import PremiumInlineCheckout from "./PremiumInlineCheckout";

const CREATIVE_FIELDS=[
 ["brand","Brand","Your business or brand name"],
 ["campaign","Campaign","Your campaign objective"],
 ["audience","Audience","Who the content should reach"],
 ["pain","Customer need","The problem your audience wants solved"],
 ["solution","Your offer","How your product or service helps"],
 ["cta","Call to action","What people should do next"],
 ["landingUrl","Website","https://example.com"]
];
const formatUsd=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n/100);
const collect=()=>{
 try{if(typeof CollectJS!=="undefined")return CollectJS}catch{}
 return typeof window!=="undefined"?window.CollectJS:undefined;
};
export default function LitixDirectRetailCheckout(){
 const [state,setState]=useState({loading:true,checkoutReady:false,services:[],publicCollectKey:""});
 const [email,setEmail]=useState("");
 const [brief,setBrief]=useState(Object.fromEntries(CREATIVE_FIELDS.map(([k])=>[k,""])));
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[done,setDone]=useState(false);
 const [notice,setNotice]=useState(""),[order,setOrder]=useState(null);
 const [requestKey,setRequestKey]=useState(()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():"");
 const sendToken=useRef(null);
 const item=state.services?.find(s=>s.serviceKind==="creative_kit")||null;
 useEffect(()=>{
  let alive=true;
  fetch("/api/direct-retail/catalog",{cache:"no-store"})
    .then(r=>r.json()).then(data=>{
      if(alive)setState({loading:false,checkoutReady:data.checkoutReady===true,
        services:Array.isArray(data.services)?data.services:[],
        publicCollectKey:data.publicCollectKey||""});
    }).catch(()=>{if(alive)setState({loading:false,checkoutReady:false,services:[],publicCollectKey:""})});
  return()=>{alive=false};
 },[]);
 useEffect(()=>{
  if(!state.checkoutReady||!state.publicCollectKey||!item)return;
  let active=true,timer,interval;
  const key=state.publicCollectKey;
  const fail=message=>{if(active){setReady(false);setNotice(message)}};
  const initialize=()=>{
   const c=collect();
   if(!active||typeof c?.configure!=="function")return;
   try{
    c.configure({variant:"inline",styleSniffer:false,
      customCss:{"font-size":"16px","font-family":"sans-serif",color:"#ffffff","background-color":"transparent"},
      placeholderCss:{color:"#aebfd4"},
      fields:{
        ccnumber:{selector:"#ccnumber",title:"Card Number",placeholder:"Card number"},
        ccexp:{selector:"#ccexp",title:"Expiration Date",placeholder:"MM / YY"},
        cvv:{selector:"#cvv",title:"Security Code",placeholder:"CVV"}
      },
      callback:result=>{
       if(!active)return;
       if(result?.token)sendToken.current?.(result.token);
       else{setBusy(false);fail("PayKings tokenization failed. Check the secure fields.")}
      },
      fieldsAvailableCallback:()=>{if(active){setReady(true);setNotice("")}}
    });
   }catch{fail("PayKings card fields could not initialize.")}
  };
  const script=document.createElement("script");
  script.src="https://secure.nmi.com/token/Collect.js";
  script.async=true;
  script.setAttribute("data-tokenization-key",key);
  script.setAttribute("data-variant","inline");
  script.setAttribute("data-field-ccnumber-selector","#ccnumber");
  script.setAttribute("data-field-ccexp-selector","#ccexp");
  script.setAttribute("data-field-cvv-selector","#cvv");
  script.addEventListener("error",()=>fail("PayKings secure card fields unavailable."),{once:true});
  script.addEventListener("load",initialize,{once:true});
  // Mount only one hosted-fields script; never process raw card values.
  const previous=document.querySelector("script#litix-direct-collect");
  if(previous)previous.remove();
  script.id="litix-direct-collect";
  document.head.appendChild(script);
  interval=setInterval(()=>{if(active&&collect()?.configure&&
     ["ccnumber","ccexp","cvv"].every(id=>document.getElementById(id)))initialize()},1000);
  timer=setTimeout(()=>{if(active&&!ready)fail("Secure card fields did not become ready.")},15000);
  return()=>{active=false;clearTimeout(timer);clearInterval(interval);script.remove()};
 },[state.checkoutReady,state.publicCollectKey,item?.serviceKind]);
 const valid=!!item&&email.includes("@")&&
   CREATIVE_FIELDS.every(([k])=>typeof brief[k]==="string"&&brief[k].trim().length>=2)&&
   brief.landingUrl.startsWith("https://");
 async function pay(token){
  if(!valid||done||busy)return;
  setBusy(true);setNotice("");
  try{
    const res=await fetch("/api/checkout/v1",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({
        serviceKind:"creative_kit",idempotencyKey:requestKey,
        email,brief,expectedAmountCents:item.priceCents,paymentToken:token
      })
    });
    const v=await res.json();
    if(!res.ok&&res.status!==202)throw Error(v.error||"Checkout unavailable");
    setOrder(v);
    if(v.chargeAttempted!==false)setDone(true);
    setNotice(v.message||(v.payment==="APPROVED_PENDING_SETTLEMENT"
      ?"Your card was approved. Fulfillment awaits independent NMI settlement. Save your order ID."
      :"Your payment needs review. Do not submit another order."));
  }catch(error){setNotice(error.message||"Checkout unavailable; do not retry if a charge may have been submitted.")}
  finally{setBusy(false)}
 }
 sendToken.current=pay;
 const submit=e=>{
  e.preventDefault();
  if(!valid||!ready||busy||done)return;
  setBusy(true);
  try{collect().startPaymentRequest()}
  catch{setBusy(false);setNotice("Enter your card information in PayKings secure fields.")}
 };
 return <div className="litix-direct-checkout">
  <div className="kicker">LITIX DIRECT · VERIFIED FULFILLMENT ONLY</div>
  <h2>Secure checkout</h2>
  {state.loading?<p role="status">Verifying Litix-owned fulfillment capacity…</p>
  :!state.checkoutReady||!item||!state.publicCollectKey?
   <div className="checkout-help" role="status">
    <strong>Checkout temporarily unavailable — no charge attempted.</strong>
    <p>Litix is validating its first-party delivery nodes and live PayKings settlement.
       Instagram likes, followers and streams cannot be purchased through an unverified node.</p>
    <p><a href="/direct-services">Explore our original content services</a> or contact
       <a href="mailto:litixsocial@gmail.com"> Litix support</a>.</p>
   </div>:
   <form onSubmit={submit} className="form">
    <p><strong>{item.name}</strong> · {formatUsd(item.priceCents)}</p>
    {CREATIVE_FIELDS.map(([name,label,placeholder])=><label key={name}>
      {label}<input required minLength={2} maxLength={500} type={name==="landingUrl"?"url":"text"}
        placeholder={placeholder} value={brief[name]}
        onChange={e=>setBrief(old=>({...old,[name]:e.target.value}))}/>
    </label>)}
    <label>Email for payment confirmation<input type="email" required maxLength={254}
      value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <PremiumInlineCheckout cardReady={ready} busy={busy} canPay={valid&&!done}
      buttonLabel={busy?"Processing…":done?"Payment submitted — do not resubmit":
        "Pay "+formatUsd(item.priceCents)+" securely"}/>
    <p className="small">NMI/PayKings hosts the card fields. Only independently settled
      payments may enter the Litix-owned Redis fulfillment queue.</p>
   </form>}
  {notice&&<div className="msg" role="status">{notice}</div>}
  {order?.orderId&&<p role="status">Order reference: <strong>{order.orderId}</strong> · {order.payment}</p>}
 </div>;
}
