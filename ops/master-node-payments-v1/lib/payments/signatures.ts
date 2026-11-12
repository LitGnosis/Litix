import { createHmac, timingSafeEqual } from 'node:crypto';

export type WebhookProvider = 'nmi' | 'stripe';

function compareHex(expected: string, actual: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(actual)) return false;
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(actual, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyNmiMerchantWebhook(rawBody: string, header: string | null, secret: string): boolean {
  if (!secret || !header || header.length > 256) return false;
  const match = /^t=([a-zA-Z0-9_-]{1,128}),s=([0-9a-fA-F]{64})$/.exec(header.trim());
  if (!match) return false;
  const expected = createHmac('sha256', secret).update(`${match[1]}.${rawBody}`, 'utf8').digest('hex');
  return compareHex(expected, match[2]);
}

export function verifyStripeWebhook(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): boolean {
  if (!secret || !header || header.length > 1024) return false;
  const parts = header.split(',').map((part) => part.trim());
  const timePart = parts.find((part) => /^t=\d+$/.test(part));
  if (!timePart) return false;
  const timestamp = Number(timePart.slice(2));
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
  return parts.some((part) => part.startsWith('v1=') && compareHex(expected, part.slice(3)));
}

export function selectProvider(headers: Headers): WebhookProvider | null {
  const nmi = headers.get('webhook-signature');
  const stripe = headers.get('stripe-signature');
  if (Boolean(nmi) === Boolean(stripe)) return null;
  return nmi ? 'nmi' : 'stripe';
}

export async function readLimitedBody(request: Request, maxBytes = 65_536): Promise<string> {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (!Number.isFinite(length) || length > maxBytes) throw new Error('BODY_TOO_LARGE');
  if (!request.body) throw new Error('EMPTY_BODY');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('BODY_TOO_LARGE');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((v) => Buffer.from(v))).toString('utf8');
}
