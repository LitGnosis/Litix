"use client";
import {useEffect,useRef,useState} from "react";
// All card entry stays inside PayKings/NMI-hosted Collect.js iframes.
export default function OwnerPayKingsFields({publicKey,disabled,busy,amountCents,onToken}){
 const latest=useRef(onToken);latest.current=onToken;
 const alreadySent=useRef(false),pending=useRef(null);
 const [status,setStatus]=useState("loading"),[problem,setProblem]=useState("");
 useEffect(()=>{
  if(!publicKey){setStatus("unavailable");return}
  let closed=false,poll=null;
  const script=document.createElement("script");
  script.src="https://secure.nmi.com/token/Collect.js";
  script.async=true;
  script.setAttribute("data-tokenization-key",publicKey);
  script.setAttribute("data-variant","inline");
  script.setAttribute("data-style-sniffer","false");
  script.setAttribute("data-field-ccnumber-selector","#owner-ccnumber");
  script.setAttribute("data-field-ccexp-selector","#owner-ccexp");
  script.setAttribute("data-field-cvv-selector","#owner-cvv");
  script.onload=()=>{
   if(closed)return;
   try{
    window.CollectJS.configure({
     variant:"inline",
     fields:{
      ccnumber:{selector:"#owner-ccnumber",placeholder:"Card number"},
      ccexp:{selector:"#owner-ccexp",placeholder:"MM / YY"},
      cvv:{selector:"#owner-cvv",placeholder:"CVV"}
     },
     callback:result=>{
      if(closed||alreadySent.current)return;
      if(pending.current){clearTimeout(pending.current);pending.current=null}
      if(!result?.token){setProblem("PayKings returned no token. No purchase request was submitted.");return}
      alreadySent.current=true;
      latest.current?.(result.token);
     }
    });
    let count=0;
    poll=setInterval(()=>{
     if(closed){clearInterval(poll);return}
     const ready=["owner-ccnumber","owner-ccexp","owner-cvv"]
      .every(id=>document.getElementById(id)?.querySelector("iframe"));
     if(ready){clearInterval(poll);setStatus("ready")}
     else if(++count>35){clearInterval(poll);setStatus("unavailable")}
    },400);
   }catch{setStatus("unavailable")}
  };
  script.onerror=()=>{if(!closed)setStatus("unavailable")};
  document.head.appendChild(script);
  return()=>{closed=true;clearInterval(poll);
   if(pending.current){clearTimeout(pending.current);pending.current=null}
   script.remove();
  };
 },[publicKey]);
 const start=()=>{
  if(disabled||busy||status!=="ready"||alreadySent.current||pending.current)return;
  setProblem("");
  pending.current=setTimeout(()=>{
   pending.current=null;
   setProblem("Card tokenization timed out. No checkout request was submitted from this page.");
  },25000);
  try{window.CollectJS.startPaymentRequest()}
  catch{
   if(pending.current){clearTimeout(pending.current);pending.current=null}
   setProblem("Complete all secure card fields. No payment has been sent.");
  }
 };
 const money=n=>"$"+(Number(n||0)/100).toFixed(2);
 const inputBox={minHeight:46,borderRadius:9,padding:7,background:"#102b49",border:"1px solid #6e9abc"};
 return <div aria-label="Secure PayKings card fields" style={{display:"grid",gap:12,marginTop:16}}>
  <p style={{margin:0,color:"#c6dbf1",fontSize:14}}>
   Card fields are securely hosted by PayKings/NMI. Litix receives a one-time payment token, never your card number.
  </p>
  <label style={{display:"grid",gap:5}}>Card number <div id="owner-ccnumber" style={inputBox}/></label>
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
   <label style={{display:"grid",gap:5}}>Expiration <div id="owner-ccexp" style={inputBox}/></label>
   <label style={{display:"grid",gap:5}}>Security code <div id="owner-cvv" style={inputBox}/></label>
  </div>
  <button type="button" disabled={disabled||busy||status!=="ready"||alreadySent.current}
   style={{borderRadius:11,border:"1px solid #73b4ea",padding:"14px 16px",
     background:"#2474c1",color:"#fff",fontWeight:800,cursor:"pointer"}}
   onClick={start}>
   {busy?"Submitting secure payment once…":status==="ready"?"PayKings: Authorize "+money(amountCents)+" once":
    status==="unavailable"?"Card fields unavailable — choose wallet or contact support":"Loading PayKings secure card fields…"}
  </button>
  {problem&&<p role="alert" style={{color:"#ffbfc3",margin:0}}>{problem}</p>}
  {status==="unavailable"&&<p role="status" style={{color:"#ffd5a1",margin:0}}>
   Secure card fields did not load. No charge was submitted from this form.
  </p>}
 </div>;
}
