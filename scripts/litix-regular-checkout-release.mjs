#!/usr/bin/env node
/**
 * Litix regular $1+ checkout release preflight.
 * Usage (with existing protected Production DATABASE_URL):
 *   node scripts/litix-regular-checkout-release.mjs
 *   node scripts/litix-regular-checkout-release.mjs --require-ready
 *
 * Read-only. Never creates payments, overrides verified merchant settlements,
 * enrolls fabricated nodes, or turns unfulfillable supplier listings into
 * customer-payable products.
 */
import { neon } from "@neondatabase/serverless";

const url=process.env.LITIX_V2_DATABASE_URL||process.env.DATABASE_URL||"";
if(!/^postgres(?:ql)?:\/\//.test(url)){
  process.stderr.write("Database connection is not configured.\n");
  process.exitCode=2;
}else{
  const sql=neon(url);
  try{
    const [r]=await sql.query(`
      SELECT
        (SELECT COUNT(*)::int FROM growth_ops.first_party_nodes n
         JOIN growth_ops.first_party_node_keys k ON k.node_name=n.node_name
         WHERE n.status='ONLINE' AND n.last_heartbeat>NOW()-INTERVAL '90 seconds'
           AND k.enabled) AS signed_online_nodes,
        (SELECT COUNT(*)::int FROM growth_ops.direct_service_catalog s
         WHERE s.first_party_only AND s.available AND s.billable) AS owned_billable_kinds,
        (SELECT COUNT(*)::int FROM growth_ops.direct_service_rates r
         JOIN growth_ops.direct_service_catalog s USING(service_kind)
         WHERE r.enabled AND s.available AND s.billable AND s.first_party_only
           AND r.unit_price_usd>=1) AS live_owned_rates,
        (SELECT COUNT(*)::int FROM growth_ops.direct_service_catalog
         WHERE service_kind IN ('followers','likes','views','subscribers')
           AND first_party_only AND available AND billable) AS verified_social_kinds,
        (SELECT COUNT(*)::int FROM growth_ops.litix_nmi_sale_receipts a
         JOIN growth_ops.litix_nmi_settled_transactions b
           ON a.transaction_id=b.transaction_id
         WHERE a.amount_cents>=100 AND a.currency='USD') AS verified_nmi_settlements,
        (SELECT merchant_settlement_verified FROM growth_ops.direct_release_gates
         WHERE id=true) AS merchant_flag,
        (SELECT fulfillment_capacity_verified FROM growth_ops.direct_release_gates
         WHERE id=true) AS capacity_flag,
        (SELECT recurring_checkout_enabled FROM growth_ops.direct_release_gates
         WHERE id=true) AS recurring_flag`,[]);
    const required={
      signedNodeOnline:r.signed_online_nodes>0,
      ownedBillableService:r.owned_billable_kinds>0,
      ownedRateAtLeastOneDollar:r.live_owned_rates>0,
      directSocialFulfillment:r.verified_social_kinds>0
    };
    // Approval of a single $1 NMI transaction is NOT a settlement.
    // Release flags are informational, not substitutions for signed capacity.
    const ready=Object.values(required).every(Boolean);
    process.stdout.write(JSON.stringify({
      service:"litix",regularSocialCheckoutReady:ready,
      checked:required,
      evidence:{verifiedNmiSettlements:Number(r.verified_nmi_settlements),
        existingReleaseFlags:{merchant:Boolean(r.merchant_flag),
          fulfillment:Boolean(r.capacity_flag),
          recurring:Boolean(r.recurring_flag)}},
      action:ready?"Capacity preflight passed; still require per-SKU ownership, signed receipt and NMI settlement verification.":
        "Keep paid social SKUs disabled; first-party delivery evidence is not established."
    },null,2)+"\n");
    if(process.argv.includes("--require-ready")&&!ready)process.exitCode=1;
  }catch(error){
    // Prevent any credential/connection-string leaks in CI.
    process.stderr.write("Regular checkout preflight failed; no charges enabled.\n");
    process.exitCode=2;
  }
}
