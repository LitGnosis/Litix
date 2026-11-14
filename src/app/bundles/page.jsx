import {permanentRedirect} from "next/navigation";
// Legacy offers are retired. Keep private historic confirmation separately.
export default function RetiredBundleStore(){permanentRedirect("/services");}
