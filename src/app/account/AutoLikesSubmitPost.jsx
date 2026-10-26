"use client";
import {useState} from "react";
export default function AutoLikesSubmitPost({campaign}){
 const [link,setLink]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function submit(e){
  e.preventDefault();if(busy||!link.trim())return;setBusy(true);setMessage("");
  try{
   const res=await fetch("/api/account/autolikes/submit-post",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({campaignId:campaign.id,postUrl:link.trim()})});
   const body=await res.json();
   if(!res.ok)throw Error(body.error||"Submission failed");
   setMessage(body.message||"Submitted");
   if(!body.duplicate)setLink("");
  }catch(e){setMessage(e.message)}
  finally{setBusy(false)}
 }
 return <form onSubmit={submit} style={{display:"grid",gap:8,marginTop:12}}>
  <label htmlFor={"autolikes-post-"+campaign.id} style={{fontWeight:600}}>Submit a new post for AutoLikes</label>
  <input id={"autolikes-post-"+campaign.id} type="url" placeholder="Paste the public Instagram or TikTok post URL" required value={link} onChange={e=>setLink(e.target.value)}
    style={{font:"inherit",padding:12,borderRadius:9,background:"#071624",color:"#eaf4ff",border:"1px solid #537b96",width:"100%",boxSizing:"border-box"}}/>
  <button type="submit" disabled={busy||!link.trim()} style={{font:"inherit",padding:12,borderRadius:9,background:"#194b66",color:"#effaff",border:"1px solid #7dc7ea"}}>
    {busy?"Submitting…":"Send post to AutoLikes"}
  </button>
  {message&&<p role="status" style={{margin:0}}>{message}</p>}
 </form>
}