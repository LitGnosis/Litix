// Uses the existing Neon tagged-SQL API, never a nonexistent Prisma db.order model.
export function bundleRepository(sql, packages) {
  return {
    async verifySettledPayment(id) {
      // The existing NMI receiver alone authenticates and populates this outbox.
      // Never trust a browser, a second guessed webhook contract, or an "approved" event.
      const original=(await sql`select * from litix_supplier_orders where id=${id} limit 1`)[0];
      const selected=packages.find(p=>p.id===original?.delivery_meta?.bundlePackageId);
      if (!selected || selected.price<=0 || Math.round(selected.price*100)!==Number(original.retail_cents)) return false;
      const rows=await sql`update litix_supplier_orders as supplier
        set payment_status='paid', payment_reference=outbox.transaction_id, updated_at=now()
        from litix_paykings_outbox as outbox
        join litix_paykings_checkout_orders as checkout on checkout.order_id=outbox.order_id
          and checkout.gateway_transaction_id=outbox.transaction_id
        where supplier.id=${id} and supplier.id=outbox.order_id
          and supplier.payment_provider='paykings'
          and supplier.payment_status in ('pending','paid')
          and checkout.payment_state='settled'
          and upper(checkout.currency)='USD'
          and supplier.retail_cents=outbox.amount_cents
          and checkout.amount_cents=outbox.amount_cents
          and lower(supplier.customer_email)=lower(checkout.billing_email)
          and (supplier.payment_status='pending' or supplier.payment_reference=outbox.transaction_id)
          and supplier.delivery_meta->>'bundlePackageId'=${selected.id}
          and supplier.retail_cents=${Math.round(selected.price*100)}
        returning supplier.*`;
      const row=rows[0], pkg=packages.find(p=>p.id===row?.delivery_meta?.bundlePackageId);
      return Boolean(row && pkg && pkg.price>0 && Math.round(pkg.price*100)===Number(row.retail_cents));
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
