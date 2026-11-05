import Link from "next/link";
import LitixNativeOrderStatus from "../../../components/LitixNativeOrderStatus";
import "../../solutions/solutions.css";
export const metadata={
 title:"Private Native Order | Litix",
 description:"Check settlement and download your purchased Litix Native digital file privately.",
 robots:{index:false,follow:false},
 referrer:"no-referrer"
};
export default function NativeOrder(){
 return <main className="ls-main">
  <nav className="ls-nav" aria-label="Private Litix order navigation">
   <Link className="ls-brand" href="/">Litix</Link>
   <div><Link href="/native">Native</Link><Link href="/shop">Shop</Link><Link href="/partners">Support</Link></div>
  </nav>
  <LitixNativeOrderStatus/>
  <footer className="ls-footer"><Link href="/legal/privacy">Privacy</Link><Link href="/terms">Terms</Link></footer>
 </main>;
}
