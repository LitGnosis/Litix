import { redirect } from "next/navigation";
import { auth0, authenticatedCustomer, customerAuthConfigured } from "../../lib/customerAuth.js";
import AccountClient from "./AccountClient.jsx";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  if (!customerAuthConfigured()) {
    return <main style={{maxWidth:740,margin:"3rem auto",padding:24,fontFamily:"system-ui",color:"#eaf2ff",background:"#0b1830",borderRadius:20}}>
      <a href="/" style={{color:"#9edfff"}}>← Litix Home</a>
      <h1>Customer accounts are being prepared</h1>
      <p>Existing one-time orders and private order tracking remain available. Secure account login will be enabled after Auth0 callback and session tests pass.</p>
      <a href="/track" style={{color:"#9edfff"}}>Track an existing order</a>
    </main>;
  }

  const user = await authenticatedCustomer();
  if (user) return <AccountClient user={{name:user.name,email:user.email}}/>;

  // An existing Auth0 session with an unverified email must not be sent through
  // another login redirect, which would loop at the account callback.
  const session = await auth0?.getSession();
  if (session?.user) {
    return <main style={{minHeight:"100vh",padding:"40px 16px",background:"linear-gradient(145deg,#061220,#0c2e45)",color:"#ebf8ff",fontFamily:"system-ui"}}>
      <div style={{maxWidth:650,margin:"0 auto",padding:28,background:"#102940",border:"1px solid #5285a5",borderRadius:20}}>
        <a href="/" style={{color:"#abe2ff"}}>← Litix Home</a>
        <h1>Verify your email to access your Litix account</h1>
        <p style={{color:"#c2d7e5",lineHeight:1.6}}>Check your inbox and open the verification email from Litix Customer Accounts. After verifying, sign out and sign back in to refresh your account session.</p>
        <a href="/auth/logout" style={{display:"inline-block",padding:"14px 22px",borderRadius:12,background:"#216084",color:"#fff",textDecoration:"none",fontWeight:700}}>Sign out</a>
      </div>
    </main>;
  }

  // Opening the account page starts the Auth0 signup flow directly on iPhone,
  // without requiring a tap on a Preview button or client JavaScript.
  redirect("/auth/login?screen_hint=signup&returnTo=%2Faccount");
}
