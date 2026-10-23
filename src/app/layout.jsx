import "./style.css";
import "./metallic.css";
import { LITIX_BRAND_MANIFEST } from "../config/brandEngine";

const keywords = ["SaaS", "digital marketing", "social engagement", "marketing", "promotions", "social media growth"];

export const metadata = {
  metadataBase: new URL("https://litix.net"),
  title: LITIX_BRAND_MANIFEST.metadata.title,
  description: LITIX_BRAND_MANIFEST.metadata.description,
  keywords,
  applicationName: "Litix",
  alternates: { canonical: "https://litix.net/" },
  openGraph: {
    title: LITIX_BRAND_MANIFEST.metadata.title,
    description: LITIX_BRAND_MANIFEST.metadata.description,
    url: "https://litix.net/",
    siteName: "Litix",
    type: "website",
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
};

const schema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Litix",
  url: "https://litix.net/",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: LITIX_BRAND_MANIFEST.metadata.description,
  publisher: { "@type": "Organization", name: "Litix", url: "https://litix.net/" },
};

export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
        {children}
      </body>
    </html>
  );
}
