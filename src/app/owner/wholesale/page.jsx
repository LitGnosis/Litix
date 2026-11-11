import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {ownerCookie,ownerSession} from "../../../lib/ownerAuth.mjs";
import OwnerWholesaleUI from "../../../components/OwnerWholesaleUI";
import "./owner-wholesale.css";
export const dynamic="force-dynamic";
export default async function OwnerWholesalePage(){
 const jar=await cookies();
 if(!ownerSession(jar.get(ownerCookie)?.value))redirect("/owner/wholesale/login");
 return <OwnerWholesaleUI/>;
}
