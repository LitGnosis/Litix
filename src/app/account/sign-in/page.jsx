"use client";
import {useState} from "react";
import {neonBrowserAuth} from "../../../lib/neonBrowserAuth.js";
import Link from "next/link";
const input={width:"100%",background:"#081a2b",color:"#effbff",border:"1px solid #6596b3",padding:"13px 14px",borderRadius:10,fontSize:16};
const button={width:"100%",background:"#216487",border:"1px solid #7dc2e4",color:"white",borderRadius:11,padding:"13px 16px",cursor:"pointer",fontWeight:700};
export default function SignInPage(){
 const[email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function login(e){
  e.preventDefault();setBusy(true);setError("");
  try{
   const result=await neonBrowserAuth.signIn.email({email:email.trim().toLowerCase(),password});
   if(result.error){setError(result.error.message||"Unable to sign in.");return}
   window.location.assign("/account");
  }catch{setError("The sign-in provider is temporarily unavailable.")}
  finally{setBusy(false);setPassword("")}
 }
 async function loginGoogle(){
  setBusy(true);setError("");
  try{
   const result=await neonBrowserAuth.signIn.social({provider:"google",callbackURL:"/account"});
   if(result.error){setError(result.error.message||"Google sign-in is unavailable.");setBusy(false)}
  }catch{setError("Google sign-in is temporarily unavailable.");setBusy(false)}
 }
 return <main style={{minHeight:"100vh",background:"linear-gradient(140deg,#071422,#11324a)",padding:"32px 15px",fontFamily:"system-ui",color:"#eefaff"}}>
  <div style={{maxWidth:450,margin:"0 auto",background:"#102a40",border:"1px solid #5687a7",borderRadius:20,padding:"25px"}}>
   <nav><Link href="/" style={{color:"#a6dffd"}}>← Litix Home</Link></nav>
   <h1 style={{fontSize:30,margin:"22px 0 10px"}}>Sign in to Litix</h1>
   <p style={{color:"#b4cfdf"}}>Your orders, tracking and AutoLikes campaign drafts, secured by your account.</p>
   <button style={{...button,margin:"16px 0",background:"#14263b"}} type="button" onClick={loginGoogle} disabled={busy}>Continue with Google</button>
   <p style={{textAlign:"center",color:"#9eafbe",fontSize:13}}>or sign in with email</p>
   <form onSubmit={login} style={{display:"grid",gap:15}}>
    <label style={{display:"grid",gap:7}}>Email<input type="email" required autoComplete="email" style={input} value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label style={{display:"grid",gap:7}}>Password<input type="password" required autoComplete="current-password" style={input} value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <button style={button} disabled={busy}>{busy?"Signing in…":"Sign in"}</button>
   </form>
   {error&&<p role="alert" style={{color:"#ffc2c2",padding:12,background:"#542b34",borderRadius:10}}>{error}</p>}
   <p style={{marginTop:20}}>New to Litix? <Link href="/account/sign-up" style={{color:"#a3e1ff"}}>Create an account</Link></p>
   <p style={{fontSize:13,color:"#a8c4d5"}}>Purchasing one-time services does not require an account. <Link href="/track" style={{color:"#a3e1ff"}}>Track an order.</Link></p>
  </div>
 </main>;
}
