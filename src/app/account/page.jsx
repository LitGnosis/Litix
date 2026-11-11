import {redirect} from 'next/navigation';
import {customerAuth} from '../../lib/customer-auth';
import {customerIdentity} from '../../lib/customer-policy.mjs';
export const dynamic='force-dynamic';
export default async function Account(){
 const auth=customerAuth();if(!auth)return <main className="wrap"><h1>Customer login unavailable</h1><a href="/">Storefront</a></main>;
 const identity=customerIdentity(await auth.getSession());if(!identity)redirect('/account/login');
 return <main className="wrap"><section className="panel"><h1>Litix Customer Login</h1><p>{identity.email||'Signed-in customer'}</p>{identity.verified?<p>Email verified.</p>:<p role="status">Verify your email using the Auth0 verification message, then sign out and sign in again to refresh your session.</p>}<p><a href="/auth/logout">Sign out</a> · <a href="/">Browse products</a></p><h2>Your orders</h2><p>Existing orders use private tracking links. This store does not yet have a verified account-to-order ownership mapping, so no orders are claimed by email or shown from another customer.</p><p>Use your saved private tracking link on the storefront. Guest checkout remains available.</p><h2>Password recovery</h2><p>Sign out, choose Sign in, then use “Forgot password” in Auth0 Universal Login.</p></section></main>;
}
