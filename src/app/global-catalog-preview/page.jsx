import {notFound} from "next/navigation";
import CatalogExplorer from "./CatalogExplorer";
export const dynamic="force-dynamic";
export const metadata={
 title:"Litix Global Catalog — Preview Only",
 robots:{index:false,follow:false},
 description:"Private non-purchasable preview of Boostero global service inventory."
};
export default function GlobalCatalogPreview(){
 if(process.env.VERCEL_ENV!=="preview")notFound();
 return <CatalogExplorer/>;
}
