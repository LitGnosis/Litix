// State-machine gate for prepaid AutoLikes tokenization.
// The UI's busy flag also covers card tokenization; it MUST NOT block its callback.
export function maySubmitPrepaidToken({quote,requestKey,checkoutEnabled,locked,checkoutStarted}){
 return Boolean(quote&&requestKey&&checkoutEnabled&&!locked&&!checkoutStarted);
}
