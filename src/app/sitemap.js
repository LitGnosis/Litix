export default function sitemap() {
  const base = "https://litix.net";
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: base + "/privacy", changeFrequency: "yearly", priority: 0.3 },
    { url: base + "/terms", changeFrequency: "yearly", priority: 0.3 },
    { url: base + "/refunds", changeFrequency: "yearly", priority: 0.3 },
  ];
}
