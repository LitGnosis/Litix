import { neon } from '@neondatabase/serverless';

let client;
export function db() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
  if (!url) throw new Error('Database is not configured');
  if (!client) client = neon(url);
  return client;
}

export async function audit(action, entityType, entityId, details = {}) {
  try {
    const sql = db();
    await sql`
      insert into litix_audit_log (actor, action, entity_type, entity_id, details, created_at)
      values ('system', ${action}, ${entityType}, ${entityId}, ${JSON.stringify(details)}::jsonb, now())
    `;
  } catch (err) {
    console.error('audit_failed', err?.message || err);
  }
}
