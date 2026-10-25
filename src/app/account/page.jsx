import { authenticatedCustomer, customerAuthConfigured } from "../../lib/customerAuth.js";
import AccountClient from "./AccountClient.jsx";
export const dynamic="force-dynamic";
export default async function AccountPage() {
  if (!customerAuthConfigured()) return <main style={{maxWidth:740,margin:"3rem auto",padding:24,fontFamily:"system-ui",color:"#eaf2ff",background:"#0b1830",borderRadius:20}}>
    <a href="/" style={{color:"#9edfff"}}>← Litix Home</a>
    <h1>Customer accounts are being prepared</h1>
    <p>Existing one-time orders and private order tracking remain available. Secure account login will be enabled after Auth0 callback and session tests pass.</p>
    <a href="/track" style={{color:"#9edfff"}}>Track an existing order</a>
  </main>;
  const user=await authenticatedCustomer();
  if (!user) return <main style={{minHeight:"100vh",padding:"40px 16px",background:"linear-gradient(145deg,#061220,#0c2e45)",color:"#ebf8ff",fontFamily:"system-ui"}}>
    <div style={{maxWidth:650,margin:"0 auto",padding:28,background:"#102940",border:"1px solid #5285a5",borderRadius:20}}>
      <a href="/" style={{color:"#abe2ff"}}>← Litix Home</a>
      <h1>Welcome to your Litix account</h1>
      <p style={{color:"#c2d7e5",lineHeight:1.6}}>Sign in to view orders, save AutoLikes campaign drafts, and manage your settings securely. Monthly billing stays disabled until approved.</p>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:22,alignItems:"stretch"}}>
        {/* Native GET forms reliably navigate even when a mobile browser blocks client-side link handlers. */}
        <form action="/auth/login" method="get" style={{margin:0}}>
          <input type="hidden" name="returnTo" value="/account"/>
          <button type="submit" style={{minHeight:52,padding:"13px 20px",borderRadius:12,border:"1px solid #216084",background:"#216084",color:"#fff",fontWeight:700,fontSize:16,touchAction:"manipulation",cursor:"pointer"}}>Log in</button>
        </form>
        <form action="/auth/login" method="get" style={{margin:0}}>
          <input type="hidden" name="screen_hint" value="signup"/>
          <input type="hidden" name="returnTo" value="/account"/>
          <button type="submit" style={{minHeight:52,padding:"13px 20px",borderRadius:12,border:"1px solid #6faed2",background:"transparent",color:"#d2f2ff",fontWeight:700,fontSize:16,touchAction:"manipulation",cursor:"pointer"}}>Create account</button>
        </form>
      </div>
    </div>
  </main>;
  return <AccountClient user={{name:user.name,email:user.email}}/>;
}
