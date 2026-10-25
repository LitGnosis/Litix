import { redirect } from "next/navigation";
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
  if (!user) redirect("/auth/login?returnTo=/account");
  return <AccountClient user={{name:user.name,email:user.email}}/>;
}
