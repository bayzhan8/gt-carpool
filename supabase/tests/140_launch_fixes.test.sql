begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('71000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@gatech.edu', '', pg_catalog.now()),
  ('71000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'member@gatech.edu', '', pg_catalog.now());

insert into public.profiles (id, email, first_name, last_name, phone, gender)
values
  ('71000000-0000-4000-8000-000000000001', 'owner@gatech.edu', 'Launch', 'Owner', '+14045550123', 'woman'),
  ('71000000-0000-4000-8000-000000000002', 'member@gatech.edu', 'Launch', 'Member', '+14045550124', 'man');

select throws_ok(
  $$update auth.users set email = 'owner@gmail.com'
    where id = '71000000-0000-4000-8000-000000000001'$$,
  '23514',
  'email_not_allowed',
  'R-AUTH-2 auth email cannot be changed to Gmail'
);
select throws_ok(
  $$update auth.users set email_change = 'owner@gmail.com'
    where id = '71000000-0000-4000-8000-000000000001'$$,
  '23514',
  'email_not_allowed',
  'R-AUTH-2 pending email change cannot use Gmail'
);
select lives_ok(
  $$update auth.users set email = 'owner@cc.gatech.edu'
    where id = '71000000-0000-4000-8000-000000000001'$$,
  'R-AUTH-2 a Georgia Tech subdomain email is allowed'
);
select lives_ok(
  $$insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
    values ('71000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
      'signup@cc.gatech.edu', '', pg_catalog.now())$$,
  'R-AUTH-2 a Georgia Tech signup remains allowed'
);

insert into public.rides (id, owner_id, origin, destination, departs_at, seats)
values
  ('71100000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001',
    'gt', 'atl-domestic', pg_catalog.now() + interval '10 minutes', 2),
  ('71100000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001',
    'gt', 'atl-domestic', pg_catalog.now() - interval '1 minute', 2),
  ('71100000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000001',
    'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 2);

insert into public.ride_members (ride_id, user_id)
values ('71100000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.update_ride(
    '71100000-0000-4000-8000-000000000001',
    pg_catalog.now() + interval '10 minutes',
    2, 'updated close to departure', 'anyone'
  )$$,
  'R-EDIT-1 owner can edit seats and notes within 15 minutes when departure is unchanged'
);
select throws_ok(
  $$select public.update_ride(
    '71100000-0000-4000-8000-000000000003',
    pg_catalog.now() + interval '1 minute', 2, '', 'anyone'
  )$$,
  'P0001',
  'invalid_time',
  'R-EDIT-1 changed departure must remain at least 15 minutes away'
);
select throws_ok(
  $$select public.update_ride(
    '71100000-0000-4000-8000-000000000003',
    pg_catalog.now() + interval '121 days', 2, '', 'anyone'
  )$$,
  'P0001',
  'invalid_time',
  'R-EDIT-1 changed departure cannot exceed 120 days'
);

reset role;

insert into public.notifications (recipient_id, ride_id, kind, actor_name)
values
  ('71000000-0000-4000-8000-000000000001', '71100000-0000-4000-8000-000000000002', 'member_joined', 'Member'),
  ('71000000-0000-4000-8000-000000000001', '71100000-0000-4000-8000-000000000003', 'member_left', 'Member'),
  ('71000000-0000-4000-8000-000000000001', '71100000-0000-4000-8000-000000000003', 'ride_cancelled', 'Member');
update public.rides
set status = 'cancelled'
where id = '71100000-0000-4000-8000-000000000003';

set local role service_role;
select set_config(
  'launch.claimed_notifications',
  public.claim_notifications(20)::text,
  true
);
reset role;

select is(
  pg_catalog.jsonb_array_length(
    pg_catalog.current_setting('launch.claimed_notifications')::jsonb
  ),
  1,
  'R-NOTIF-1 claim omits departed and non-cancellation notifications for cancelled rides'
);
select is(
  (pg_catalog.current_setting('launch.claimed_notifications')::jsonb->0->>'kind'),
  'ride_cancelled',
  'R-NOTIF-1 cancellation notification remains claimable'
);

select is(
  (select pg_catalog.count(*)::integer from public.notifications
   where ride_id = '71100000-0000-4000-8000-000000000002' and status = 'sent'),
  1,
  'R-NOTIF-1 departed notification is completed without sending'
);
select is(
  (select pg_catalog.count(*)::integer from public.notifications
   where ride_id = '71100000-0000-4000-8000-000000000003'
     and kind = 'member_left' and status = 'sent'),
  1,
  'R-NOTIF-1 stale notification for a cancelled ride is completed'
);
select is(
  (select pg_catalog.count(*)::integer from public.notifications
   where ride_id = '71100000-0000-4000-8000-000000000003'
     and kind = 'ride_cancelled' and status = 'sending'),
  1,
  'R-NOTIF-1 cancellation notification is claimed for sending'
);

select * from finish();

rollback;
