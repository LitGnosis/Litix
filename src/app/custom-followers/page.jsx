import {redirect} from "next/navigation";
export const metadata={title:"Custom Followers | Litix"};
export default function CustomFollowersRedirect(){
 redirect("/custom-likes?kind=followers");
}
