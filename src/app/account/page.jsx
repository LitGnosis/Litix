import {redirect} from 'next/navigation';
import {customerAuth} from '../../lib/customer-auth';
import {verifiedCustomer} from '../../lib/customer-authorization.mjs';
import CustomerDashboard from '../../components/CustomerDashboard';
export const dynamic='force-dynamic';
export default async function Account(){
 const auth=customerAuth();
 if(!auth)return <main className="wrap"><section className="panel"><h1>Customer accounts</h1><p>Accounts are not enabled on this deployment. Existing single orders remain available.</p><a href="/">Return to storefront</a></section></main>;
 const session=await auth.getSession();
 if(!session)redirect('/auth/login?returnTo=%2Faccount');
 const user=verifiedCustomer(session);
 if(!user)return <main className="wrap"><h1>Verify your email</h1><p>Use the verification email from your identity provider, then sign out and back in to refresh verification.</p><a href="/auth/logout">Sign out</a></main>;
 return <CustomerDashboard email={user.email}/>;
}
