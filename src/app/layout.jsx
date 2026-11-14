import "./style.css";
import "./metallic.css";
import "./litix-ai.css";
import "./catalog.css";
import "./quick-checkout.css";
import "./litix-flow.css";
import "./litix-custom-calculator.css";
import LitixAI from "../components/LitixAI";
import {LITIX_SITE_URL,LITIX_DISCOVERY_TITLE,LITIX_DISCOVERY_DESCRIPTION,LITIX_DISCOVERY_SCHEMA} from "../lib/litixBrandDiscovery.mjs";

const keywords = [
  "Litix.net",
  "digital social media services",
  "business marketing workflows",
  "creator tools",
  "marketing operations",
  "order tracking",
];
const siteUrl = LITIX_SITE_URL;
const description = LITIX_DISCOVERY_DESCRIPTION;

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: LITIX_DISCOVERY_TITLE,
  description,
  keywords,
  applicationName: "Litix",
  category: "Business",
  creator: "Litix",
  publisher: "Litix",
  authors: [{ name: "Litix" }],
  alternates: { canonical: siteUrl },
  openGraph: {
    title: LITIX_DISCOVERY_TITLE,
    description,
    url: siteUrl,
    siteName: "Litix",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: LITIX_DISCOVERY_TITLE,
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

const schema = LITIX_DISCOVERY_SCHEMA;

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
