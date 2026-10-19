const BASE = 'https://www.litix.net';
export default function sitemap() {
  const pages = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/about', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/platform', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/resources/visibility-acceleration', priority: 0.65, changeFrequency: 'monthly' },
    { path: '/acceptable-use', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/api-docs', priority: 0.6, changeFrequency: 'monthly' }
  ];
  return pages.map(({ path, priority, changeFrequency }) => ({ url: `${BASE}${path}`, priority, changeFrequency }));
}
