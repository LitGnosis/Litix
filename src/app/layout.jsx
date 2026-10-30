import "./style.css";
import "./metallic.css";
import "./growthBundles.css";
import "./litix-ai.css";
import "./catalog.css";
import LitixAI from "../components/LitixAI";
import { LITIX_BRAND_MANIFEST } from "../config/brandEngine";

const keywords = [
  "SaaS",
  "digital marketing",
  "social engagement",
  "marketing",
  "promotions",
  "social media growth",
];
const siteUrl = "https://litix.net/";
const description =
  "Litix provides social media promotion services with a live service catalog, secure tokenized checkout, and order tracking.";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: LITIX_BRAND_MANIFEST.metadata.title,
  description,
  keywords,
  applicationName: "Litix",
  category: "Business",
  creator: "Litix",
  publisher: "Litix",
  authors: [{ name: "Litix" }],
  alternates: { canonical: siteUrl },
  openGraph: {
    title: LITIX_BRAND_MANIFEST.metadata.title,
    description,
    url: siteUrl,
    siteName: "Litix",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: LITIX_BRAND_MANIFEST.metadata.title,
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": siteUrl + "#organization",
      name: "Litix",
      url: siteUrl,
    },
    {
      "@type": "SoftwareApplication",
      "@id": siteUrl + "#application",
      name: "Litix",
      url: siteUrl,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description,
      publisher: { "@id": siteUrl + "#organization" },
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
        {children}
        <LitixAI />
      </body>
    </html>
  );
}
