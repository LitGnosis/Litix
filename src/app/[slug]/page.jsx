import Link from "next/link";
import {notFound} from "next/navigation";
import LitixDirectory from "../../components/LitixDirectory";
import {LITIX_ADDITIONAL_SEO} from "../../lib/litixAdditionalSeo.mjs";
export const dynamicParams=false;
export function generateStaticParams(){return Object.keys(LITIX_ADDITIONAL_SEO).map(slug=>({slug}));}
export async function generateMetadata({params}){
 const {slug}=await params;
 const item=LITIX_ADDITIONAL_SEO[slug];
 if(!item)return {};
 const title="Buy "+item.name+" | Packages, Pricing & Tracking | Litix";
 const url="https://www.litix.net/"+slug;
 return {title,description:item.description,alternates:{canonical:url},
  robots:{index:true,follow:true},
  openGraph:{title,description:item.description,url,type:"website",siteName:"Litix"}};
}
export default async function SearchLanding({params}){
 const {slug}=await params;
 const item=LITIX_ADDITIONAL_SEO[slug];
 if(!item)notFound();
 const canonical="https://www.litix.net/"+slug;
 const filter=new URLSearchParams({platform:item.platform,kind:item.kind});
 const href="/services?"+filter.toString()+"#all-litix-services";
 const faqs=[
  {q:"What link do I need for "+item.name+"?",a:"Use a supported "+item.target+" link. Litix validates service-specific target formats and quantity limits before payment."},
  {q:"Are prices and delivery times guaranteed?",a:"No. Available services and rates can change. Litix checks current eligibility and your final USD total before checkout. Delivery times vary."},
  {q:"How do I track my order?",a:"Use your Litix order number and checkout email or the private tracking link provided after an eligible purchase."}
 ];
 const jsonld=[
  {"@context":"https://schema.org","@type":"Product",name:item.name,
   description:item.description,brand:{"@type":"Brand",name:"Litix"},url:canonical},
  {"@context":"https://schema.org","@type":"FAQPage",mainEntity:faqs.map(x=>({
   "@type":"Question",name:x.q,acceptedAnswer:{"@type":"Answer",text:x.a}}))},
  {"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[
   {"@type":"ListItem",position:1,name:"Litix",item:"https://www.litix.net/"},
   {"@type":"ListItem",position:2,name:item.name,item:canonical}]}
 ];
 return <main className="wrap">
  <script type="application/ld+json" dangerouslySetInnerHTML={{
   __html:JSON.stringify(jsonld).replace(/</g,"\\u003c")}}/>
  <section className="panel litix-seo-hero">
   <div className="kicker">LITIX · {item.name.toUpperCase()}</div>
   <h1>Buy {item.name} with Clear Pricing</h1>
   <p>{item.description} Choose the matching service below, review its supported quantity range, and verify the amount charged before submitting payment.</p>
   <Link className="primary" href={href}>Browse {item.name} packages</Link>
   <p className="small">We never ask for social-media passwords. No delivery times, public review scores, or discounted prices are claimed without verified data.</p>
  </section>
  <LitixDirectory standalone initialPlatform={item.platform} initialKind={item.kind}/>
  <section className="panel litix-seo-faq">
   <h2>{item.name}: frequently asked questions</h2>
   {faqs.map(x=><details key={x.q}><summary>{x.q}</summary><p>{x.a}</p></details>)}
   <p>For an existing order, <Link href="/track">check your private order tracker</Link>. For checkout or delivery questions, review the <Link href="/refunds">order and refund policy</Link>.</p>
  </section>
 </main>;
}
