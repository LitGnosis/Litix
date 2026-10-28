// Install metadata only: never caches payments, orders, sessions, or supplier data.
export default function manifest() {
  return {
    id: "/",
    name: "Litix — Growth & Marketing",
    short_name: "Litix",
    description: "Litix social media marketing, growth planning, and order tracking.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#030712",
    theme_color: "#0c1b34",
    lang: "en",
    orientation: "any",
    icons: [
      { src: "/icons/litix-app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/litix-app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
