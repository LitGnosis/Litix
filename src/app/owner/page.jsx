import {headers} from "next/headers";
import {readOwnerSession} from "../../lib/ownerPortalAuth.mjs";
import OwnerPortal from "./OwnerPortal.jsx";
import "./owner.css";
export const runtime="nodejs";export const dynamic="force-dynamic";
export const metadata={title:"Litix | Private Owner Wholesale",robots:{index:false,follow:false},
 description:"Private owner-only supplier wholesale operations."};
export default async function OwnerHome(){
 const session=readOwnerSession(await headers());
 return <main className="owner-portal">
  <header className="owner-header"><a href="/" aria-label="Litix public homepage">LITIX</a>
   <span>OWNER WHOLESALE · PRIVATE ACCESS</span></header>
  {session?<OwnerPortal/>:<section className="owner-login">
   <p className="owner-eyebrow">ACCESS RESTRICTED</p>
   <h1>Your private wholesale command center.</h1>
   <p>Sign in with the authorized Litix owner Auth0 account. Customer logins cannot access supplier prices, wallet balances or purchasing.</p>
   <a href="/owner/auth/login" className="owner-primary">Sign in with Auth0</a>
   <small>Access remains disabled until the verified owner identity and secure configuration are available.</small>
  </section>}
 </main>;
}
