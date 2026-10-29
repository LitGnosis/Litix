import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {ownerCookie,ownerSession} from "../../../lib/ownerAuth.mjs";
import OwnerBoosteroDashboard from "../../../components/OwnerBoosteroDashboard.jsx";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const metadata={title:"Litix Owner Boostero Operations",robots:{index:false,follow:false}};
export default async function OwnerBoosteroPage(){
 const jar=await cookies();
 if(!ownerSession(jar.get(ownerCookie)?.value))redirect("/owner/wholesale/login");
 return <OwnerBoosteroDashboard/>;
}
