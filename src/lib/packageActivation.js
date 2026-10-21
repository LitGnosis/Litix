import {db} from './db';
import {validateBundleSettlement,exactBundleItems} from './packageSettlement.mjs';

// Deliberately not wired to cron or public checkout until migration, payment-order
// creation and isolated settlement/fulfillment verification are completed.
export async function activateSettledBundle(purchaseId) {
 const sql=db();
 const purchase=(await sql`select * from litix_package_purchases where id=${purchaseId} limit 1`)[0];
 if(!purchase||purchase.status!=='pending_payment')return {activated:false};
 const order=(await sql`select * from litix_supplier_orders where id=${purchase.payment_reference} limit 1`)[0];
 const ledger=(await sql`select * from litix_paykings_checkout_orders where order_id=${purchase.payment_reference} limit 1`)[0];
 validateBundleSettlement(purchase,order,ledger);
 exactBundleItems(purchase.advertised_items);
 // The SQL function repeats verification under row locks. No credit writes happen
 // in JavaScript, so concurrent workers cannot grant partial or duplicate credits.
 const result=await sql`select litix_activate_paid_bundle(${purchaseId}) as activated`;
 return {activated:result[0]?.activated===true};
}
