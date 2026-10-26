-- Additive migration. Preserve historical order pricing, package IDs and payment records.
-- Followers belong to the purchased Instagram/TikTok account, not each post.
ALTER TABLE litix_growth_bundle_orders ADD COLUMN IF NOT EXISTS followers_fulfilled integer NOT NULL DEFAULT 0;
DO $ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='litix_growth_bundle_followers_nonnegative' AND conrelid='litix_growth_bundle_orders'::regclass) THEN
  ALTER TABLE litix_growth_bundle_orders ADD CONSTRAINT litix_growth_bundle_followers_nonnegative CHECK (followers_fulfilled >= 0);
 END IF;
END $;
-- Recreate the atomic allocation procedure for current package snapshots.
-- Legacy items in older order snapshots are supported without adding new catalog listings.
CREATE OR REPLACE FUNCTION litix_bundle_save_post(
 p_order text, p_post text, p_url text, p_allocations jsonb
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE o litix_growth_bundle_orders%rowtype;
 existing litix_growth_bundle_posts%rowtype;
 used numeric; proposed numeric; max_posts integer; k text;
BEGIN
 SELECT * INTO o FROM litix_growth_bundle_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'BUNDLE_NOT_FOUND'; END IF;
 IF o.payment_state <> 'settled' THEN RAISE EXCEPTION 'PAYMENT_NOT_SETTLED'; END IF;
 IF o.order_state NOT IN ('Awaiting WhatsApp Submission','Under Review','Approved') THEN
  RAISE EXCEPTION 'BUNDLE_NOT_EDITABLE';
 END IF;
 IF jsonb_typeof(p_allocations) <> 'object' THEN RAISE EXCEPTION 'INVALID_ALLOCATIONS'; END IF;
 -- A profile-level Followers quantity may never be allocated to a post.
 FOR k IN SELECT jsonb_object_keys(p_allocations) LOOP
  IF k = 'Followers' OR NOT (o.package_items ? k) THEN RAISE EXCEPTION 'INVALID_SERVICE_ALLOCATION'; END IF;
 END LOOP;
 SELECT * INTO existing FROM litix_growth_bundle_posts WHERE order_id=p_order AND post_url=p_url;
 IF FOUND AND existing.status IN ('Approved','Processing','Completed') THEN RAISE EXCEPTION 'POST_ALREADY_APPROVED'; END IF;
 SELECT count(*) INTO max_posts FROM litix_growth_bundle_posts
  WHERE order_id=p_order AND status <> 'Rejected' AND post_url <> p_url;
 IF max_posts >= 10 THEN RAISE EXCEPTION 'MAX_TEN_POSTS'; END IF;
 FOR k IN SELECT jsonb_object_keys(o.package_items) LOOP
  IF k='Followers' THEN CONTINUE; END IF;
  IF p_allocations ? k AND jsonb_typeof(p_allocations->k) <> 'number' THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
  proposed := COALESCE((p_allocations->>k)::numeric,0);
  IF proposed<0 OR trunc(proposed)<>proposed THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
  SELECT COALESCE(sum(COALESCE((allocations->>k)::numeric,0)),0) INTO used
   FROM litix_growth_bundle_posts WHERE order_id=p_order AND post_url<>p_url AND status<>'Rejected';
  IF proposed+used>COALESCE((o.package_items->>k)::numeric,0) THEN RAISE EXCEPTION 'BUNDLE_QUOTA_EXCEEDED'; END IF;
 END LOOP;
 INSERT INTO litix_growth_bundle_posts(id,order_id,post_url,status,allocations)
  VALUES(p_post,p_order,p_url,'Under Review',p_allocations)
  ON CONFLICT(order_id,post_url) DO UPDATE
   SET status='Under Review',allocations=excluded.allocations
  RETURNING id INTO p_post;
 UPDATE litix_growth_bundle_orders SET order_state='Under Review',updated_at=now()
  WHERE id=p_order AND order_state='Awaiting WhatsApp Submission';
 RETURN p_post;
END $$;
