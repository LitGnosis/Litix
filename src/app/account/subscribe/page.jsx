import {redirect} from 'next/navigation';
import {customerAuth} from '../../../lib/customer-auth';
import {verifiedCustomer} from '../../../lib/customer-authorization.mjs';
import {monthlyCheckoutConfig} from '../../../lib/monthly-checkout-config.mjs';
import MonthlyCheckout from '../../../components/MonthlyCheckout';
export const dynamic='force-dynamic';
export default async function Subscribe(){
 const auth=customerAuth();
 if(!auth)return <main className="wrap"><h1>Sandbox subscriptions unavailable</h1><a href="/">Storefront</a></main>;
 const session=await auth.getSession();if(!session)redirect('/auth/login?returnTo=%2Faccount%2Fsubscribe');
 if(!verifiedCustomer(session))redirect('/account');
 let config;try{config=monthlyCheckoutConfig()}catch{return <main className="wrap"><h1>Sandbox checkout is not configured</h1><p>No payment submitted.</p><a href="/account">Account</a></main>}
 return <MonthlyCheckout config={config}/>;
}
