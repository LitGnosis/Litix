import Link from "next/link";
import Home from "../app/page";
import {seoLanding,LITIX_SEO_LANDINGS} from "../lib/litixSeoLandings.mjs";

const headings=[
 ["buy-instagram-followers","Instagram Followers"],
 ["buy-instagram-likes","Instagram Likes"],
 ["buy-tiktok-followers","TikTok Followers"],
 ["buy-tiktok-likes","TikTok Likes"]
];

export default function LitixSeoLanding({slug}){
 const page=seoLanding(slug);
 const canonical="https://www.litix.net/"+slug;
 const schema=[
  {
   "@context":"https://schema.org",
   "@type":"BreadcrumbList",
   itemListElement:[
    {"@type":"ListItem",position:1,name:"Litix",item:"https://www.litix.net/"},
    {"@type":"ListItem",position:2,name:page.platform+" "+page.kind,item:canonical}
   ]
  },
  {
   "@context":"https://schema.org",
   "@type":"FAQPage",
   mainEntity:page.faq.map(entry=>({
    "@type":"Question",
    name:entry.question,
    acceptedAnswer:{"@type":"Answer",text:entry.answer}
   }))
  }
 ];
 const safeJson=JSON.stringify(schema).replace(/</g,"\\u003c");
 return <>
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJson}}/>
  <section className="wrap litix-seo-hero" aria-labelledby="litix-seo-title">
   <p className="kicker">LITIX · {page.platform.toUpperCase()} {page.kind.toUpperCase()}</p>
   <h1 id="litix-seo-title">{page.h1}</h1>
   <p className="litix-seo-intro">{page.intro}</p>
   <p className="litix-seo-summary">{page.summary}</p>
   <div className="litix-seo-actions">
    <a href="#checkout" className="primary">Review packages and secure checkout</a>
    <Link href="/track">Track an existing order</Link>
   </div>
   <div className="litix-seo-category-links" aria-label="Related Litix services">
    {headings.filter(([name])=>name!==slug).map(([name,label])=>
     <Link key={name} href={"/"+name}>{label}</Link>)}
   </div>
  </section>
  <Home landingServiceId={page.sku}/>
  <section className="wrap litix-seo-details" aria-label={page.platform+" "+page.kind+" shopping guide"}>
   <article className="panel litix-seo-comparison">
    <div className="kicker">SHOP WITH CLEAR INFORMATION</div>
    <h2>What to review before ordering {page.platform} {page.kind.toLowerCase()}</h2>
    <p>Compare the checkout facts that matter instead of relying on promised start times or unverified review counts.</p>
    <div className="litix-seo-table-scroll">
     <table>
      <thead><tr><th scope="col">Shopping detail</th><th scope="col">Litix checkout</th><th scope="col">What to confirm with any provider</th></tr></thead>
      <tbody>
       {page.checklist.map(([name,detail])=>
        <tr key={name}><th scope="row">{name}</th><td>{detail}</td><td>{name==="Target"?"Correct profile or post link format":
          name==="Quantity"?"Supported live minimum and maximum":
          name==="Payment"?"Exact final price and secure payment process":
          "A usable private order-status or support channel"}</td></tr>)}
      </tbody>
     </table>
    </div>
   </article>
   <article className="panel litix-seo-faq" id="service-faq">
    <div className="kicker">SERVICE FAQ</div>
    <h2>Questions about {page.platform} {page.kind.toLowerCase()}</h2>
    {page.faq.map(entry=>
     <details key={entry.question}>
      <summary>{entry.question}</summary>
      <p>{entry.answer}</p>
     </details>)}
    <p className="small">All services are subject to current supplier availability, platform rules and Litix's <Link href="/terms">Terms of Service</Link> and <Link href="/refunds">Refunds &amp; Order Issues</Link> policies.</p>
   </article>
  </section>
 </>;
}
