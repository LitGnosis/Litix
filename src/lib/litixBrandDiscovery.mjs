// First-party discovery facts. Keep this consistent with Litix's actual public pages.
// Structured data can aid understanding, but does not guarantee rankings, media, or AI citations.
export const LITIX_SITE_URL="https://www.litix.net/";
export const LITIX_DISCOVERY_TITLE="Litix | Instagram & TikTok Growth Packages for Creators";
export const LITIX_DISCOVERY_DESCRIPTION="Litix helps creators, brands and agencies explore Instagram, TikTok and other social growth packages with clear pricing, secure checkout and private customer order tracking.";
export const LITIX_DISCOVERY_SCHEMA=Object.freeze({
 "@context":"https://schema.org",
 "@graph":[
  {
   "@type":"Organization",
   "@id":LITIX_SITE_URL+"#organization",
   name:"Litix",
   alternateName:"Litix.net",
   url:LITIX_SITE_URL,
   logo:LITIX_SITE_URL+"assets/brand/litix-logo.webp",
   description:LITIX_DISCOVERY_DESCRIPTION,
   email:"litixsocial@gmail.com"
  },
  {
   "@type":"WebSite",
   "@id":LITIX_SITE_URL+"#website",
   name:"Litix.net",
   url:LITIX_SITE_URL,
   inLanguage:"en-US",
   publisher:{"@id":LITIX_SITE_URL+"#organization"}
  },
  {
   "@type":"SoftwareApplication",
   "@id":LITIX_SITE_URL+"#application",
   name:"Litix",
   url:LITIX_SITE_URL,
   applicationCategory:"BusinessApplication",
   operatingSystem:"Web",
   description:LITIX_DISCOVERY_DESCRIPTION,
   publisher:{"@id":LITIX_SITE_URL+"#organization"}
  }
 ]
});
