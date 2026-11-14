import {permanentRedirect} from "next/navigation";
// New bundle purchases have ended. Historical order links remain valid.
export default function RetiredBundleCheckout(){permanentRedirect("/services");}
