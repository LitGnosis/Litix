import LitixSeoLanding from "../../components/LitixSeoLanding";
import {seoLandingMetadata} from "../../lib/litixSeoLandings.mjs";

export function generateMetadata(){
 return seoLandingMetadata("buy-tiktok-likes");
}

export default function Page(){
 return <LitixSeoLanding slug="buy-tiktok-likes"/>;
}
