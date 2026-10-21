// Uses the existing Neon tagged-SQL API, never a nonexistent Prisma db.order model.
export function bundleRepository(sql, packages) {
  return {
    async verifyPayment(id,{cents,reference}) {
      const row=(await sql`select * from litix_supplier_orders where id=${id} limit 1`)[0];
      const pkg=packages.find(p=>p.id===row?.delivery_meta?.bundlePackageId);
      if (!row || !pkg || pkg.price<=0 || row.payment_provider!=='paykings' || Number(row.retail_cents)!==cents || Math.round(pkg.price*100)!==cents) return false;
      if (row.payment_status==='paid') return row.payment_reference===reference;
      const updated=await sql`update litix_supplier_orders set payment_status='paid',payment_reference=${reference},updated_at=now() where id=${id} and payment_status='pending' and retail_cents=${cents} returning id`;
      return updated.length===1;
    },
    async claim(id) {
      const row=(await sql`update litix_supplier_orders set fulfillment_status='submitting',updated_at=now() where id=${id} and payment_status='paid' and fulfillment_status='pending' and provider_order_id is null and delivery_meta->>'bundlePackageId' is not null returning *`)[0];
      if (!row) return null;
      return {packageId:row.delivery_meta.bundlePackageId,customerTargetUsername:row.delivery_meta.customerTargetUsername,customerTargetHandle:row.target_link};
    },
    async review(id,reason) {
      await sql`update litix_supplier_orders set fulfillment_status='review',provider_error=${`UNCERTAIN_SUBMISSION: ${reason}`},updated_at=now() where id=${id} and fulfillment_status='submitting'`;
    },
    async submitted(id,{provider,externalId,pkg}) {
      // Hold in review so legacy cron cannot reconcile subscription IDs using an unrelated panel.
      // Acceptance is not fulfillment completion. Supplier status sync must be wired before activation.
      await sql`update litix_supplier_orders set fulfillment_status='review',provider_order_id=${externalId},provider_status='Subscription accepted; awaiting provider sync',provider_error='UNCERTAIN_SUBMISSION: dedicated provider sync required',delivery_meta=delivery_meta || ${JSON.stringify({bundleProvider:provider})}::jsonb,refill_eligible=${Boolean(pkg.hasRefill)},refill_expires_at=${pkg.hasRefill?new Date(Date.now()+pkg.refillDurationDays*86400000).toISOString():null},updated_at=now() where id=${id} and fulfillment_status='submitting'`;
    }
  };
}
