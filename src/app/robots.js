export default function robots() {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/account', '/signin', '/checkout'] }
    ],
    sitemap: 'https://www.litix.net/sitemap.xml',
    host: 'https://www.litix.net'
  };
}
