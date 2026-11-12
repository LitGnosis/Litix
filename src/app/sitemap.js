export default function sitemap(){
 const base="https://www.litix.net";
 const urls=[
  ["/",1],["/shop",0.95],["/shop/marketing-drafts",0.95],
  ["/direct-services",0.9],["/ai-content-studio",0.85],
  ["/agency",0.75],["/wholesale",0.75],["/track",0.4],
  ["/terms",0.3],["/refunds",0.3],["/legal/privacy",0.3],
  ["/company",0.4],["/press",0.35]
 ];
 return urls.map(([path,priority])=>({
  url:base+path,priority,changeFrequency:priority>0.8?"weekly":"monthly"
 }));
}
