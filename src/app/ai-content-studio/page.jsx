import ContentFarmStudio from "../../components/ContentFarmStudio";
import "../direct-revenue.css";
export const metadata={title:"Litix AI Content Studio | First-Party Content Campaigns",
 description:"Litix campaign generator with OpenArt-compatible AI image and video briefs for authorized creative production.",
 alternates:{canonical:"https://www.litix.net/ai-content-studio"}};
export default function AIStudio(){
 return <main className="litix-revenue">
  <header><a className="brand" href="/">LITIX<span>.NET</span></a>
   <nav><a href="/wholesale">Wholesale</a><a href="/agency">Agency</a><a href="/direct-services">Direct</a></nav></header>
  <section className="hero">
   <p className="overline">LITIX AI / FIRST-PARTY CREATIVE PIPELINE</p>
   <h1>Build a content production studio—not a fake engagement farm.</h1>
   <p>Generate 12 campaign-ready creative drafts using Litix technology, then export prompts for optional OpenArt image/video production. All publishing and social engagement remain subject to real accounts and consent.</p>
  </section>
  <ContentFarmStudio/>
  <footer>The video reference demonstrates OpenArt MCP/CLI. OpenArt is an optional third-party media creation tool requiring its own OAuth account and credits; no social fulfillment depends on it.</footer>
 </main>
}
