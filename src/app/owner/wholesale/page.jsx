import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {ownerCookie,ownerSession} from "../../../lib/ownerAuth.mjs";
export const dynamic="force-dynamic";
export default async function OwnerLanding(){
 const jar=await cookies();
 if(!ownerSession(jar.get(ownerCookie)?.value))redirect("/owner/wholesale/login");
 redirect("/owner/finance");
}
