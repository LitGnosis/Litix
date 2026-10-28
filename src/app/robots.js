export default function robots() {
  return {
    rules: [{
      userAgent:"*",
      allow:"/",
      // Retain exclusions from the prior October 19 robots proxy, and exclude admin pages.
      disallow:["/api/","/account","/signin","/checkout","/guardian/admin","/bundles/admin"]
    }],
    sitemap:"https://litix.net/sitemap.xml",
    host:"https://litix.net",
  };
}
