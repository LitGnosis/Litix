export const LITIX_SITE_URL="https://www.litix.net/";
export const LITIX_DISCOVERY_TITLE="Litix.net | Original Marketing Drafts, Creative Kits & AI Content";
export const LITIX_DISCOVERY_DESCRIPTION="Litix offers original digital marketing drafts, free first-party creative kits, AI content planning, private order tracking and individually scoped agency or wholesale campaign blueprints.";
export const LITIX_DISCOVERY_SCHEMA=Object.freeze({
 "@context":"https://schema.org",
 "@graph":[
  {"@type":"Organization","@id":LITIX_SITE_URL+"#organization",
   name:"Litix",alternateName:"Litix.net",url:LITIX_SITE_URL,
   logo:LITIX_SITE_URL+"assets/brand/litix-logo.webp",
   description:LITIX_DISCOVERY_DESCRIPTION,email:"litixsocial@gmail.com"},
  {"@type":"WebSite","@id":LITIX_SITE_URL+"#website",name:"Litix.net",url:LITIX_SITE_URL,
   inLanguage:"en-US",publisher:{"@id":LITIX_SITE_URL+"#organization"}},
  {"@type":"SoftwareApplication","@id":LITIX_SITE_URL+"#application",name:"Litix Content Studio",
   url:LITIX_SITE_URL+"ai-content-studio",applicationCategory:"BusinessApplication",
   operatingSystem:"Web",description:LITIX_DISCOVERY_DESCRIPTION,
   publisher:{"@id":LITIX_SITE_URL+"#organization"}}
 ]
});
