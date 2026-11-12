"use client";
import {useState} from "react";

const usd=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(cents/100);
const eachCents=(service,quantity)=>Math.ceil(Number(service?.per1000||0)*Number(quantity||0)/10-1e-8);
export function newTikTokPost({link="",quantity=0,verifiedUrl=""}={}){
 return {id:crypto.randomUUID(),link,quantity,verifiedUrl,verifiedInput:verifiedUrl?link.trim():"",status:verifiedUrl?"verified":"idle",error:""};
}

export default function TikTokMultiPostChooser({service,posts,onChange}){
 const [running,setRunning]=useState("");
 const mutate=(id,fields)=>onChange(old=>old.map(p=>p.id===id?{...p,...fields}:p));
 async function verify(post){
  const input=post.link.trim();
  if(!input)return mutate(post.id,{status:"error",error:"Paste a public TikTok post link first.",verifiedUrl:""});
  setRunning(post.id);
  mutate(post.id,{status:"checking",error:"",verifiedUrl:"",verifiedInput:""});
  try{
   const response=await fetch("/api/tiktok/resolve",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({link:input})});
   const result=await response.json();
   if(!response.ok||!result.url)throw Error(result.error||"Link could not be verified.");
   onChange(old=>old.map(p=>p.id===post.id&&p.link.trim()===input?
    {...p,status:"verified",verifiedInput:input,verifiedUrl:result.url,error:""}:p));
  }catch(error){
   onChange(old=>old.map(p=>p.id===post.id&&p.link.trim()===input?
    {...p,status:"error",verifiedUrl:"",error:String(error.message).slice(0,160)}:p));
  }finally{setRunning("")}
 }
 const count=posts.reduce((sum,p)=>sum+Math.max(0,Number(p.quantity)||0),0);
 const cents=posts.reduce((sum,p)=>sum+Math.max(0,eachCents(service,p.quantity)),0);
 return <div className="tiktok-post-picker" style={{display:"grid",gap:14,padding:"14px 0"}} aria-label="Choose TikTok posts">
  <p className="small">Choose 2–5 public videos. Paste a TikTok share link for each, verify it, and choose how many likes each video receives. Every video must meet the service's minimum.</p>
  {posts.map((post,index)=>{
   const valid=post.verifiedUrl&&post.verifiedInput===post.link.trim()&&post.status==="verified";
   const quantity=Number(post.quantity),minimum=Number(service?.min||1),maximum=Number(service?.max||1000000);
   const quantityValid=Number.isSafeInteger(quantity)&&quantity>=minimum&&quantity<=maximum&&eachCents(service,quantity)>=100;
   return <fieldset key={post.id} style={{border:"1px solid #305974",borderRadius:15,padding:14,minWidth:0}}>
    <legend style={{padding:"0 8px",fontWeight:700}}>Video {index+1}</legend>
    <label style={{display:"grid",gap:6}}>TikTok video/share link
     <input type="url" value={post.link} placeholder="https://www.tiktok.com/t/..." autoCapitalize="none" autoCorrect="off" spellCheck={false}
      onChange={e=>mutate(post.id,{link:e.target.value,verifiedUrl:"",verifiedInput:"",status:"idle",error:""})}/>
    </label>
    <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:10,margin:"8px 0"}}>
     <button className="alt" type="button" onClick={()=>verify(post)} disabled={running===post.id}>
      {running===post.id?"Checking video…":valid?"Recheck link":"Verify video"}
     </button>
     {valid&&<a href={post.verifiedUrl} target="_blank" rel="noopener noreferrer">View verified video</a>}
     {post.status==="error"&&<span role="alert" className="small">{post.error}</span>}
    </div>
    <label style={{display:"grid",gap:6}}>Likes for video {index+1}
     <input type="number" min={minimum} max={maximum} step={service?.unitStep||1} value={post.quantity}
      onChange={e=>mutate(post.id,{quantity:e.target.value===""?0:Number(e.target.value)})}/>
    </label>
    <p className="small" style={{margin:"8px 0 0"}}>{quantityValid?usd(eachCents(service,quantity)):"Minimum "+minimum.toLocaleString()+" likes per video"} · {valid?"Video verified":"Video not yet verified"}</p>
    {posts.length>2&&<button type="button" className="alt" onClick={()=>onChange(old=>old.filter(p=>p.id!==post.id))}>Remove video</button>}
   </fieldset>
  })}
  {posts.length<5&&<button type="button" className="alt" onClick={()=>onChange(old=>[...old,newTikTokPost({quantity:Number(service?.min)||1})])}>+ Add another video</button>}
  <div className="totalbox"><div className="small">Multi-post allocation</div>
   <strong>{posts.length} posts · {count.toLocaleString()} likes</strong>
   <div className="small">Combined price: {usd(cents)}. Each post is priced and verified separately.</div>
  </div>
  <p className="small" role="status">Multi-post purchases are fulfilled by Litix staff through our existing supplier. You'll receive one payment confirmation and can contact Litix with your order number for updates.</p>
 </div>;
}
