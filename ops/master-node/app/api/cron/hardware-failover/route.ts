import { timingSafeEqual } from 'node:crypto';
import { assignOneJob } from '../../../../lib/infrastructure/master-node-queue';
import { inTransaction } from '../../../../lib/infrastructure/pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(value: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32 || !value?.startsWith('Bearer ')) return false;
  const left = Buffer.from(value.slice(7));
  const right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request): Promise<Response> {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'not_configured' }, { status: 503 });
  if (!authorized(request.headers.get('authorization'))) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const counts = await inTransaction(async (db) => {
      await db.query(`SET LOCAL lock_timeout='2s'`);
      await db.query(`SET LOCAL statement_timeout='8s'`);
      const unassigned = await db.query(
        `WITH candidates AS (
           SELECT j.id FROM master_node_jobs j
           LEFT JOIN master_execution_nodes n ON n.id=j.node_id
           WHERE j.status='queued' AND j.node_id IS NOT NULL
             AND (n.id IS NULL OR n.owned=FALSE OR n.enabled=FALSE
               OR n.last_seen IS NULL OR n.last_seen<NOW()-INTERVAL '90 seconds')
           ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 100
         )
         UPDATE master_node_jobs j SET node_id=NULL
         FROM candidates c WHERE j.id=c.id RETURNING j.id`,
      );
      const review = await db.query(
        `WITH candidates AS (
           SELECT j.id FROM master_node_jobs j
           LEFT JOIN master_execution_nodes n ON n.id=j.node_id
           WHERE j.status='running'
             AND (j.lease_until IS NULL OR j.lease_until<NOW())
           ORDER BY j.started_at FOR UPDATE OF j SKIP LOCKED LIMIT 100
         )
         UPDATE master_node_jobs j
         SET status='needs_review', last_error_code='EXPIRED_LEASE_UNKNOWN_SIDE_EFFECT',
             finished_at=NOW(),lease_token=NULL,lease_until=NULL
         FROM candidates c WHERE j.id=c.id RETURNING j.id`,
      );
      return { safeQueuedReleases: unassigned.rowCount ?? 0, uncertainRunningQuarantined: review.rowCount ?? 0 };
    });
    let reassigned = 0;
    for (let i = 0; i < 20; i += 1) {
      if (!(await assignOneJob())) break;
      reassigned += 1;
    }
    return Response.json({
      ok: true,
      ...counts,
      reassignedQueuedJobs: reassigned,
      uncertainJobsRequireReview: counts.uncertainRunningQuarantined > 0,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('hardware_failover_cron_failed', { code: error instanceof Error ? error.name : 'unknown' });
    return Response.json({ error: 'internal_failure' }, { status: 500 });
  }
}