import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {ownerCookie,ownerSession} from "../../../lib/ownerAuth.mjs";
import OwnerFinanceDashboard from "../../../components/OwnerFinanceDashboard";
import "./owner-finance.css";
export const metadata={title:"Private Litix Financial Operations",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
export default async function OwnerFinancePage(){
 const jar=await cookies();
 if(!ownerSession(jar.get(ownerCookie)?.value))redirect("/owner/wholesale/login");
 return <OwnerFinanceDashboard/>;
}
