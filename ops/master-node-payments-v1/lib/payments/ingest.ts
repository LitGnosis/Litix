import { createHash } from 'node:crypto';
import pg, { type Pool as PgPool, type PoolClient } from 'pg';
const { Pool } = pg;
import type { MoneyEvent } from './normalize';

const globalPool = globalThis as unknown as { litixPaymentPool?: PgPool };
const getPool = (): PgPool => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing');
  if (globalPool.litixPaymentPool) return globalPool.litixPaymentPool;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 6000,
    idleTimeoutMillis: 15000, application_name:'litix_payment_ingest' });
  if (process.env.NODE_ENV !== 'production') globalPool.litixPaymentPool = pool;
  return pool;
};

type Intent = {
  order_id:string; provider:'nmi'|'stripe'; provider_transaction_id:string;
  expected_amount_cents:number; currency:string; live_mode:boolean;
  execution_approved:boolean; service_kind:'website_preview'|'owned_app_qa';
  payload:Record<string,unknown>; tenant_key:string; state:string;
};

async function createFirstPartyJob(db: PoolClient, intent: Intent, provider: string, eventId: string) {
  if (!intent.execution_approved || !['website_preview','owned_app_qa'].includes(intent.service_kind)) return 'captured_needs_approval';
  const verificationSource = `${provider}:${createHash('sha256').update(eventId).digest('hex')}`;
  await db.query(
    `INSERT INTO master_fulfillment_grants(order_id,kind,verification_source,verified_at)
     VALUES ($1,$2,$3,NOW()) ON CONFLICT(order_id) DO NOTHING`,
    [intent.order_id,intent.service_kind,verificationSource],
  );
  const payload = JSON.stringify(intent.payload);
  const hash = createHash('sha256').update(payload).digest('hex');
  const job = await db.query<{id:string}>(
    `INSERT INTO master_node_jobs(order_id,tenant_key,kind,payload,payload_hash,status)
     VALUES ($1,$2,$3,$4::jsonb,$5,'queued') ON CONFLICT(order_id) DO NOTHING RETURNING id`,
    [intent.order_id,intent.tenant_key,intent.service_kind,payload,hash],
  );
  if (job.rowCount) {
    await db.query(
      `INSERT INTO growth_ops.litix_payment_dispatch_outbox(order_id,job_id)
       VALUES ($1,$2) ON CONFLICT(order_id) DO NOTHING`,[intent.order_id,job.rows[0].id],
    );
  }
  return 'dispatch_pending';
}

async function promote(db: PoolClient, intent: Intent, event: MoneyEvent): Promise<string> {
  if (!['pending','awaiting_settlement','captured_needs_approval'].includes(intent.state)) return 'already_handled';
  if (intent.provider!==event.provider || intent.provider_transaction_id!==event.transactionId ||
    intent.live_mode!==event.liveMode || intent.currency!==event.currency ||
    intent.expected_amount_cents!==event.amountCents || !Number.isSafeInteger(intent.expected_amount_cents)) {
    await db.query(`UPDATE growth_ops.litix_owned_payment_intents SET state='requires_review',updated_at=NOW()
      WHERE order_id=$1`,[intent.order_id]);
    return 'mismatch_requires_review';
  }
  const status=await createFirstPartyJob(db,intent,event.provider,event.eventId);
  await db.query(`UPDATE growth_ops.litix_owned_payment_intents SET state=$2, updated_at=NOW()
    WHERE order_id=$1`,[intent.order_id,status]);
  return status;
}

export async function processVerifiedPayment(event: MoneyEvent): Promise<string> {
  const db = await getPool().connect();
  try {
    await db.query('BEGIN');
    const eventInserted = await db.query(
      `INSERT INTO growth_ops.litix_verified_payment_events(provider,event_id,event_type,order_id,transaction_id)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT(provider,event_id) DO NOTHING RETURNING event_id`,
      [event.provider,event.eventId,event.eventType,event.orderId,event.transactionId],
    );
    if (!eventInserted.rowCount) { await db.query('COMMIT'); return 'duplicate'; }
    if (event.action === 'settlement_batch' && event.provider === 'nmi') {
      if (event.batchTransactions.length === 0) { await db.query('COMMIT'); return 'batch_empty'; }
      await db.query(
        `INSERT INTO growth_ops.litix_nmi_settled_transactions(transaction_id,event_id)
         SELECT unnest($1::text[]),$2 ON CONFLICT(transaction_id) DO NOTHING`,
        [event.batchTransactions,event.eventId],
      );
      const result=await db.query<Intent>(
        `SELECT * FROM growth_ops.litix_owned_payment_intents
         WHERE provider='nmi' AND provider_transaction_id=ANY($1::text[])
           AND state='awaiting_settlement' FOR UPDATE`,[event.batchTransactions],
      );
      let n=0;
      for (const intent of result.rows) {
        if (intent.live_mode!==event.liveMode) continue;
        const matched=await db.query<{amount_cents:number,currency:string}>(
          `SELECT amount_cents,currency FROM growth_ops.litix_nmi_sale_receipts
           WHERE order_id=$1 AND transaction_id=$2`,[intent.order_id,intent.provider_transaction_id],
        );
        if (!matched.rowCount || matched.rows[0].amount_cents!==intent.expected_amount_cents || matched.rows[0].currency!==intent.currency) continue;
        const promoted=await createFirstPartyJob(db,intent,'nmi',event.eventId);
        await db.query(`UPDATE growth_ops.litix_owned_payment_intents SET state=$2,updated_at=NOW() WHERE order_id=$1`,
          [intent.order_id,promoted]);
        if (promoted==='dispatch_pending') n++;
      }
      await db.query('COMMIT');
      return `batch_recorded_dispatches_${n}`;
    }

    if (event.action==='review' || !event.orderId || !event.transactionId || !event.amountCents || !event.currency) {
      await db.query('COMMIT'); return 'recorded_for_review';
    }
    const rows=await db.query<Intent>(
      `SELECT * FROM growth_ops.litix_owned_payment_intents WHERE order_id=$1 FOR UPDATE`,[event.orderId],
    );
    if (!rows.rowCount) { await db.query('COMMIT'); return 'unmatched_order'; }
    const intent=rows.rows[0];
    if (intent.provider!==event.provider || intent.provider_transaction_id!==event.transactionId ||
        intent.live_mode!==event.liveMode || intent.expected_amount_cents!==event.amountCents ||
        intent.currency!==event.currency) {
      await db.query(`UPDATE growth_ops.litix_owned_payment_intents SET state='requires_review',updated_at=NOW()
        WHERE order_id=$1`,[intent.order_id]);
      await db.query('COMMIT'); return 'mismatch_requires_review';
    }
    if (event.action === 'pending_settlement') {
      await db.query(`INSERT INTO growth_ops.litix_nmi_sale_receipts(order_id,transaction_id,amount_cents,currency)
        VALUES($1,$2,$3,$4) ON CONFLICT(order_id) DO NOTHING`,
        [intent.order_id,event.transactionId,event.amountCents,event.currency]);
      const settled=await db.query(`SELECT 1 FROM growth_ops.litix_nmi_settled_transactions
        WHERE transaction_id=$1`,[event.transactionId]);
      if (!settled.rowCount) {
        if (intent.state==='pending') await db.query(`UPDATE growth_ops.litix_owned_payment_intents
          SET state='awaiting_settlement',updated_at=NOW() WHERE order_id=$1`,[intent.order_id]);
        await db.query('COMMIT'); return 'awaiting_settlement';
      }
      const state=await promote(db,intent,{...event,action:'captured'});
      await db.query('COMMIT');return state;
    }
    const state=await promote(db,intent,event);
    await db.query('COMMIT');
    return state;
  } catch(error) {
    await db.query('ROLLBACK').catch(()=>{});
    throw error;
  } finally { db.release(); }
}
