"use client";
import {useState} from "react";
import Link from "next/link";
import {neonBrowserAuth} from "../../../lib/neonBrowserAuth.js";
const input={width:"100%",boxSizing:"border-box",background:"#081a2b",color:"#effbff",border:"1px solid #6596b3",padding:"13px 14px",borderRadius:10,fontSize:16};
const button={width:"100%",background:"#216487",border:"1px solid #7dc2e4",color:"white",borderRadius:11,padding:"13px 16px",cursor:"pointer",fontWeight:700};
export default function SignUpPage(){
 const[name,setName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[created,setCreated]=useState(false),[message,setMessage]=useState("");
 async function create(e){
  e.preventDefault();setBusy(true);setMessage("");
  try{
   const result=await neonBrowserAuth.signUp.email({name:name.trim(),email:email.trim().toLowerCase(),password});
   if(result.error){setMessage(result.error.message||"Signup failed.");return}
   setCreated(true);setPassword("");
   try{
    const verification=await neonBrowserAuth.sendVerificationEmail({email:email.trim().toLowerCase(),callbackURL:"/account"});
    setMessage(verification.error?"Account created. Sign in with Google or request email verification through the account provider.":"Account created. Check your email for the verification link before accessing your account.");
   }catch{setMessage("Account created. Email verification may need to be requested from the account provider.")}
  }catch{setMessage("Account creation is temporarily unavailable.")}
  finally{setBusy(false)}
 }
 async function google(){
  setBusy(true);setMessage("");
  try{const r=await neonBrowserAuth.signIn.social({provider:"google",callbackURL:"/account"});if(r.error){setMessage(r.error.message||"Google signup unavailable.");setBusy(false)}}catch{setMessage("Google signup unavailable.");setBusy(false)}
 }
 return <main style={{minHeight:"100vh",background:"linear-gradient(140deg,#071422,#11324a)",padding:"32px 15px",fontFamily:"system-ui",color:"#eefaff"}}>
  <div style={{maxWidth:450,margin:"0 auto",background:"#102a40",border:"1px solid #5687a7",borderRadius:20,padding:25}}>
   <nav><Link href="/" style={{color:"#a6dffd"}}>← Litix Home</Link></nav><h1 style={{fontSize:30}}>Create your Litix account</h1>
   <p style={{color:"#b4cfdf"}}>Save your AutoLikes campaign preferences and view completed and pending orders in one secure place.</p>
   <button style={{...button,margin:"14px 0",background:"#14263b"}} type="button" disabled={busy} onClick={google}>Sign up with Google</button>
   <p style={{textAlign:"center",fontSize:13,color:"#a8beca"}}>or create an email account</p>
   {!created&&<form onSubmit={create} style={{display:"grid",gap:15}}>
    <label style={{display:"grid",gap:7}}>Name<input style={input} required minLength={2} maxLength={80} value={name} autoComplete="name" onChange={e=>setName(e.target.value)}/></label>
    <label style={{display:"grid",gap:7}}>Email<input style={input} type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label style={{display:"grid",gap:7}}>Password<input style={input} type="password" required minLength={12} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <button style={button} disabled={busy}>{busy?"Creating account…":"Create account"}</button>
   </form>}
   {message&&<p role="status" style={{color:created?"#c0f9d7":"#ffc7c7",padding:13,background:created?"#164b3b":"#542b34",borderRadius:10}}>{message}</p>}
   {created&&<Link href="/account/sign-in" style={{color:"#a3e1ff"}}>Go to sign in</Link>}
   <p style={{marginTop:20}}>Already have an account? <Link href="/account/sign-in" style={{color:"#a3e1ff"}}>Sign in</Link></p>
  </div>
 </main>;
}
