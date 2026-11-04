/**
 * AutoLikes new sales are suspended.
 * Boostero support reports native future-post subscriptions cannot be reliably
 * resold through its public API. A credible supported post detector AND an
 * authorized fulfillment path must be verified before this can ever be reopened.
 *
 * Deliberately fail-closed in code rather than relying on a mutable env flag.
 * Existing PAID order records, private tracking and supplier status reads remain.
 */
export const autolikesNewSalesEnabled = () => false;
export const AUTOLIKES_SALES_PAUSED_MESSAGE =
  "New AutoLikes purchases are paused while supplier monitoring and automatic post detection are independently verified. No charge attempted. Existing customers can use their private tracking link or contact Litix support.";
