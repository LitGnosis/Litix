import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { inTransaction } from '../../../../lib/infrastructure/pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const eventSchema = z.object({
  sourceEventId: z.string().regex(/^[a-zA-Z0-9_-]{8,120}$/),
  accountKey: z.string().regex(/^[a-zA-Z0-9_:.@-]{3,128}$/),
  platform: z.enum(['instagram', 'tiktok', 'youtube']),
  postId: z.string().regex(/^[a-zA-Z0-9_-]{4,128}$/),
  permalink: z.string().url().max(600),
  publishedAt: z.string().datetime({ offset: true }),
  type: z.literal('post.published'),
}).strict();

type Event = z.infer<typeof eventSchema>;

function validatePermalink(event: Event): boolean {
  let host: string;
  try {
    const url = new URL(event.permalink);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    host = url.hostname.toLowerCase();
  } catch {
    return false;
  }
  const authorizedHosts: Record<Event['platform'], string[]> = {
    instagram: ['instagram.com', 'www.instagram.com'],
    tiktok: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
    youtube: ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'],
  };
  return authorizedHosts[event.platform].includes(host);
}

function verifySignature(rawBody: string, signature: string, timestamp: string): boolean {
  const secret = process.env.LITIX_PUBLISHER_WEBHOOK_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32 || !/^\d{10}$/.test(timestamp)) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(Date.now() - seconds * 1000) > 300_000) return false;
  if (!/^sha256=[0-9a-f]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return timingSafeEqual(Buffer.from(signature.slice(7), 'hex'), Buffer.from(expected, 'hex'));
}

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get('x-litix-signature') ?? '';
  const timestamp = request.headers.get('x-litix-timestamp') ?? '';
  if (Number(request.headers.get('content-length') ?? 0) > 16_384) {
    return Response.json({ error: 'payload_too_large' }, { status: 413 });
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > 16_384) {
    return Response.json({ error: 'payload_too_large' }, { status: 413 });
  }
  if (!verifySignature(rawBody, signature, timestamp)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(rawBody) as unknown; }
  catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }
  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success || !validatePermalink(parsed.data)) {
    return Response.json({ error: 'invalid_event' }, { status: 400 });
  }
  const event = parsed.data;
  const publishTime = Date.parse(event.publishedAt);
  if (!Number.isFinite(publishTime) || publishTime > Date.now() + 300_000 || publishTime < Date.now() - 86_400_000) {
    return Response.json({ error: 'outdated_or_future_post_event' }, { status: 422 });
  }
  const payloadHash = createHash('sha256').update(JSON.stringify(event)).digest('hex');
  try {
    const result = await inTransaction(async (db) => {
      const lease = await db.query<{
        id: string;
        sellPriceCents: number;
        serviceCostCents: number;
      }>(
        `SELECT "id", "sellPriceCents", "serviceCostCents"
         FROM growth_ops."LitixPostLease"
         WHERE "accountKey"=$1 AND "platform"=$2 AND "isActive"=TRUE
           AND "consentRecordedAt" IS NOT NULL AND "expiresAt">NOW()
         ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE`,
        [event.accountKey, event.platform],
      );
      if (!lease.rowCount) return { status: 'inactive_lease' as const };
      const record = lease.rows[0];
      if (record.sellPriceCents * 2 < record.serviceCostCents * 5) {
        return { status: 'pricing_review' as const };
      }
      const existing = await db.query<{ id: string; payloadHash: string; sourceEventId: string }>(
        `SELECT "id", "payloadHash", "sourceEventId" FROM growth_ops."LitixPostEvent"
         WHERE "sourceEventId"=$1 OR ("leaseId"=$2 AND "postId"=$3)
         ORDER BY CASE WHEN "sourceEventId"=$1 THEN 0 ELSE 1 END LIMIT 1`,
        [event.sourceEventId, record.id, event.postId],
      );
      if (existing.rowCount) {
        const match = existing.rows[0];
        return match.sourceEventId !== event.sourceEventId || match.payloadHash === payloadHash
          ? { status: 'duplicate' as const, id: match.id }
          : { status: 'conflict' as const };
      }
      const inserted = await db.query<{ id: string }>(
        `INSERT INTO growth_ops."LitixPostEvent"
           ("leaseId","sourceEventId","platform","accountKey","postId","permalink","publishedAt","payloadHash","status")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending_review')
         ON CONFLICT DO NOTHING RETURNING "id"`,
        [record.id, event.sourceEventId, event.platform, event.accountKey,
          event.postId, event.permalink, event.publishedAt, payloadHash],
      );
      if (!inserted.rowCount) return { status: 'duplicate' as const };
      const id = inserted.rows[0].id;
      await db.query(
        `INSERT INTO growth_ops."LitixPostOutbox" ("eventId","status") VALUES ($1,'pending')`,
        [id],
      );
      return { status: 'accepted' as const, id };
    });
    if (result.status === 'inactive_lease') return Response.json({ error: 'inactive_or_unapproved_lease' }, { status: 403 });
    if (result.status === 'pricing_review') return Response.json({ error: 'pricing_requires_review' }, { status: 409 });
    if (result.status === 'conflict') return Response.json({ error: 'conflicting_event' }, { status: 409 });
    if (result.status === 'duplicate') return Response.json({ accepted: true, duplicate: true }, { status: 200 });
    return Response.json({ accepted: true, eventId: result.id, next: 'owner_review' }, { status: 202 });
  } catch (error) {
    console.error('post_listener_failed', { code: error instanceof Error ? error.name : 'unknown' });
    return Response.json({ error: 'internal_failure' }, { status: 500 });
  }
}