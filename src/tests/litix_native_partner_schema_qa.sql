-- Isolated litix_native_partner_orders schema contract tests.
-- Run ONLY against ephemeral CI database after applying additive migration.
-- Transaction intentionally rolls back its fixture rows.
begin;
insert into public.litix_native_partner_orders
 (id,partner_id,request_id,service_id,request_hash,filename,mime_type,sha256,content,status)
values
 ('11111111-1111-4111-8111-111111111111','agency-alpha','litix-native-test-001','litix-native-caption-kit',
  repeat('a',64),'example-captions.txt','text/plain; charset=utf-8',repeat('b',64),'original content','COMPLETED');
insert into public.litix_native_partner_orders
 (id,partner_id,request_id,service_id,request_hash,filename,mime_type,sha256,content,status)
values
 ('22222222-2222-4222-8222-222222222222','agency-alpha','litix-native-test-001','litix-native-caption-kit',
  repeat('a',64),'example-captions.txt','text/plain; charset=utf-8',repeat('b',64),'original content','COMPLETED')
on conflict(partner_id,request_id) do nothing;
insert into public.litix_native_partner_orders
 (id,partner_id,request_id,service_id,request_hash,filename,mime_type,sha256,content,status)
values
 ('33333333-3333-4333-8333-333333333333','agency-beta','litix-native-test-001','litix-native-link-page',
  repeat('c',64),'example-links.html','text/html; charset=utf-8',repeat('d',64),'<html>owned link page</html>','COMPLETED');
do $$
declare rejected boolean:=false;
begin
 if (select count(*) from public.litix_native_partner_orders where partner_id='agency-alpha' and request_id='litix-native-test-001')<>1
  then raise exception 'Idempotent request uniqueness failed'; end if;
 if (select count(*) from public.litix_native_partner_orders where request_id='litix-native-test-001')<>2
  then raise exception 'Partner isolation failed'; end if;
 begin
   insert into public.litix_native_partner_orders
    (id,partner_id,request_id,service_id,request_hash,filename,mime_type,sha256,content,status)
   values
    ('44444444-4444-4444-8444-444444444444','agency-alpha','litix-native-test-002','litix-native-followers',
     repeat('e',64),'fake.txt','text/plain; charset=utf-8',repeat('f',64),'unverified','COMPLETED');
 exception when check_violation then rejected:=true;
 end;
 if not rejected then raise exception 'Unsupported artificial engagement SKU was accepted'; end if;
 rejected:=false;
 begin
   insert into public.litix_native_partner_orders
    (id,partner_id,request_id,service_id,request_hash,filename,mime_type,sha256,content,status)
   values
    ('55555555-5555-4555-8555-555555555555','agency-alpha','litix-native-test-003','litix-native-caption-kit',
     repeat('a',64),'example.txt','text/plain; charset=utf-8',repeat('b',64),'x','PENDING_PAYMENT');
 exception when check_violation then rejected:=true;
 end;
 if not rejected then raise exception 'Unpaid/nontrial order status was accepted'; end if;
end $$;
rollback;
