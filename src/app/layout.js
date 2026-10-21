/* LITIX_SEO_PATCH_V1 */
import './globals.css';import './litix-seo.css';import './litix-featured-restored.css';
export const metadata = {
    metadataBase: new URL('https://www.litix.net'),
    title: 'Litix | Marketing Automation & Campaign Management',
    description: 'Manage social campaign orders, scheduled delivery, tracking, and API workflows across Instagram, TikTok, and X with Litix.',
    alternates: { canonical: '/' },
    openGraph: { type: 'website', siteName: 'Litix', title: 'Litix | Marketing Automation & Campaign Management', description: 'Manage social campaign orders, scheduled delivery, tracking, and API workflows across Instagram, TikTok, and X with Litix.', url: 'https://www.litix.net/' },
    twitter: { card: 'summary_large_image', title: 'Litix | Marketing Automation & Campaign Management', description: 'Manage social campaign orders, scheduled delivery, tracking, and API workflows across Instagram, TikTok, and X with Litix.' }
  };
export default function RootLayout({children}){return <html lang="en"><body><script type="application/ld+json" dangerouslySetInnerHTML={{__html:"{\"@context\":\"https://schema.org\",\"@graph\":[{\"@type\":\"Organization\",\"@id\":\"https://www.litix.net/#organization\",\"name\":\"Litix\",\"url\":\"https://www.litix.net/\",\"description\":\"Software and digital services for campaign management, order tracking, delivery scheduling, and developer integrations.\"},{\"@type\":\"WebSite\",\"@id\":\"https://www.litix.net/#website\",\"name\":\"Litix\",\"url\":\"https://www.litix.net/\",\"publisher\":{\"@id\":\"https://www.litix.net/#organization\"}},{\"@type\":\"SoftwareApplication\",\"@id\":\"https://www.litix.net/#software\",\"name\":\"Litix\",\"url\":\"https://www.litix.net/\",\"applicationCategory\":\"BusinessApplication\",\"operatingSystem\":\"Web\",\"description\":\"Web-based campaign setup, service order management, scheduling and delivery tracking, with developer integration features where enabled.\",\"provider\":{\"@id\":\"https://www.litix.net/#organization\"}}]}"}} /><div className="ambient a"/><div className="ambient b"/>{children}</body></html>}
