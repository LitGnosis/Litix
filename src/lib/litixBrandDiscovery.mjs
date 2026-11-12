// First-party discovery facts. Keep this consistent with Litix's actual public pages.
// Structured data can aid understanding, but does not guarantee rankings, media, or AI citations.
export const LITIX_SITE_URL="https://www.litix.net/";
export const LITIX_DISCOVERY_TITLE="Litix.net | Digital Social Media Services & Business Marketing Workflows";
export const LITIX_DISCOVERY_DESCRIPTION="Litix.net is an independent digital-services storefront with a live social media services catalog and customer order tracking. Businesses can also request manually reviewed marketing and lead-workflow proposals.";
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
