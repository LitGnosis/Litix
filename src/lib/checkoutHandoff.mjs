const nmiHosts = new Set(['secure.nmi.com', 'sandbox.nmi.com', 'secure.networkmerchants.com']);
const bridgeOrigin = 'https://litix-paykings-webhook.vercel.app';

// The existing bridge seals the order and NMI form URL into an expiring session.
// Permit only its card-entry endpoint, not arbitrary redirects on that hostname.
export function validateCheckoutHandoff(data, orderId) {
  const invalid = () => { throw new Error('Invalid gateway response'); };
  if (data?.reference !== String(orderId) || typeof data?.url !== 'string' || data.url.length > 4096) return invalid();
  let url;
  try { url = new URL(data.url); } catch { return invalid(); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return invalid();
  if (nmiHosts.has(url.hostname)) return url.href;
  if (url.origin !== bridgeOrigin || url.pathname !== '/api/payments/paykings/card-entry') return invalid();
  const params = [...url.searchParams];
  if (params.length !== 1 || params[0][0] !== 'session' || !/^[A-Za-z0-9_-]{40,3000}$/.test(params[0][1])) return invalid();
  return url.href;
}
