"use client";
import {useEffect,useState} from "react";
// Ephemeral confirmation only; never persist or copy private tracking tokens.
export default function LitixAutoLikesHomeNotice(){
 const [confirmed,setConfirmed]=useState(false);
 useEffect(()=>{
  const url=new URL(window.location.href);
  if(url.searchParams.get("autolikes")!=="confirmed")return;
  setConfirmed(true);
  url.searchParams.delete("autolikes");
  window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);
 },[]);
 if(!confirmed)return null;
 return <section className="panel" role="status" aria-live="polite"
  style={{margin:"16px 0",border:"1px solid #80caef",background:"linear-gradient(135deg,#0d3b58,#061726)"}}>
   <h2 style={{marginTop:0}}>AutoLikes payment confirmed</h2>
   <p>Your one-time payment was accepted. Your separate payment confirmation and private tracking emails should arrive shortly. Monitoring may still be activating.</p>
   <p>Need assistance or missing emails? <a href="mailto:litixsocial@gmail.com?subject=AutoLikes%20Order%20Help">Contact Litix Support</a>.</p>
  </section>;
}
