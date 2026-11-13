begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at
)
values
  ('15000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@gatech.edu', '', pg_catalog.now()),
  ('15000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'member@gatech.edu', '', pg_catalog.now()),
  ('15000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'joiner@gatech.edu', '', pg_catalog.now()),
  ('15000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'late@gatech.edu', '', pg_catalog.now()),
  ('15000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'outside@gatech.edu', '', pg_catalog.now());

insert into public.profiles (id, email, first_name, last_name, phone, gender)
values
  ('15000000-0000-4000-8000-000000000001', 'owner@gatech.edu', 'Remind', 'Owner', '+14045550123', 'woman'),
  ('15000000-0000-4000-8000-000000000002', 'member@gatech.edu', 'Remind', 'Member', '+14045550124', 'woman'),
  ('15000000-0000-4000-8000-000000000003', 'joiner@gatech.edu', 'Late', 'Joiner', '+14045550125', 'woman'),
  ('15000000-0000-4000-8000-000000000004', 'late@gatech.edu', 'New', 'Rider', '+14045550126', 'woman'),
  ('15000000-0000-4000-8000-000000000005', 'outside@gatech.edu', 'Far', 'Rider', '+14045550127', 'woman');

insert into public.rides (id, owner_id, origin, destination, departs_at, seats, status)
values
  ('15100000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '2 hours', 5, 'active'),
  ('15100000-0000-4000-8000-000000000002', '15000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '23 hours', 5, 'active'),
  ('15100000-0000-4000-8000-000000000003', '15000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '25 hours', 5, 'active'),
  ('15100000-0000-4000-8000-000000000004', '15000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '29 minutes', 5, 'active'),
  ('15100000-0000-4000-8000-000000000005', '15000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '2 hours', 5, 'cancelled'),
  ('15100000-0000-4000-8000-000000000006', '15000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '2 hours', 5, 'active'),
  ('15100000-0000-4000-8000-000000000007', '15000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '2 hours', 5, 'active'),
  ('15100000-0000-4000-8000-000000000008', '15000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '30 hours', 5, 'active'),
  ('15100000-0000-4000-8000-000000000009', '15000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '30 hours', 5, 'active');

insert into public.ride_members (ride_id, user_id)
values
  ('15100000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000001'),
  ('15100000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000002'),
  ('15100000-0000-4000-8000-000000000002', '15000000-0000-4000-8000-000000000001'),
  ('15100000-0000-4000-8000-000000000002', '15000000-0000-4000-8000-000000000002'),
  ('15100000-0000-4000-8000-000000000003', '15000000-0000-4000-8000-000000000001'),
  ('15100000-0000-4000-8000-000000000003', '15000000-0000-4000-8000-000000000002'),
  ('15100000-0000-4000-8000-000000000004', '15000000-0000-4000-8000-000000000001'),
  ('15100000-0000-4000-8000-000000000004', '15000000-0000-4000-8000-000000000002'),
  ('15100000-0000-4000-8000-000000000005', '15000000-0000-4000-8000-000000000001'),
  ('15100000-0000-4000-8000-000000000005', '15000000-0000-4000-8000-000000000002'),
  ('15100000-0000-4000-8000-000000000006', '15000000-0000-4000-8000-000000000001'),
  ('15100000-0000-4000-8000-000000000007', '15000000-0000-4000-8000-000000000001'),
  ('15100000-0000-4000-8000-000000000008', '15000000-0000-4000-8000-000000000001'),
  ('15100000-0000-4000-8000-000000000008', '15000000-0000-4000-8000-000000000002'),
  ('15100000-0000-4000-8000-000000000009', '15000000-0000-4000-8000-000000000001'),
  ('15100000-0000-4000-8000-000000000009', '15000000-0000-4000-8000-000000000002');

select is(
  public.enqueue_ride_reminders(),
  4,
  'R-NOTIF-2 active rides in the 30-minute to 24-hour window remind each member'
);
select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where kind = 'ride_reminder'
     and ride_id in (
       '15100000-0000-4000-8000-000000000001',
       '15100000-0000-4000-8000-000000000002'
     )),
  4,
  'R-NOTIF-2 reminders are inserted for both members of the 2-hour and 23-hour rides'
);
select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where kind = 'ride_reminder'
     and ride_id not in (
       '15100000-0000-4000-8000-000000000001',
       '15100000-0000-4000-8000-000000000002'
     )),
  0,
  'R-NOTIF-2 rides beyond 24 hours, under 30 minutes, cancelled, and solo are skipped'
);
select is(
  public.enqueue_ride_reminders(),
  0,
  'R-NOTIF-2 a second enqueue is idempotent'
);

update public.rides
set departs_at = pg_catalog.now() + interval '3 hours'
where id = '15100000-0000-4000-8000-000000000001';
select is(
  (select pg_catalog.count(*)::integer
   from public.ride_members
   where ride_id = '15100000-0000-4000-8000-000000000001'
     and reminded_at is null),
  2,
  'R-NOTIF-2 changing departure time clears each member reminder marker'
);
select is(
  public.enqueue_ride_reminders(),
  2,
  'R-NOTIF-2 a moved ride can be reminded again'
);

select is(
  public.enqueue_ride_reminders(),
  0,
  'R-NOTIF-2 a solo ride is not reminded'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"15000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.join_ride('15100000-0000-4000-8000-000000000007')$$,
  'R-NOTIF-3 a member can join a ride in the last 24 hours'
);
reset role;
select is(
  public.enqueue_ride_reminders(),
  2,
  'R-NOTIF-2 a formerly solo ride becomes eligible after its first member joins'
);
select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where ride_id = '15100000-0000-4000-8000-000000000007'
     and recipient_id = '15000000-0000-4000-8000-000000000001'
     and kind = 'member_joined'),
  1,
  'R-NOTIF-3 the owner receives exactly one late-join notification'
);
select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where ride_id = '15100000-0000-4000-8000-000000000007'
     and kind = 'ride_reminder'),
  2,
  'R-NOTIF-2 the next reminder run includes the formerly solo owner and new joiner'
);

update public.rides
set departs_at = pg_catalog.now() + interval '2 hours'
where id = '15100000-0000-4000-8000-000000000008';
select is(
  public.enqueue_ride_reminders(),
  2,
  'R-NOTIF-2 an active group in the reminder window is marked before a later join'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"15000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.join_ride('15100000-0000-4000-8000-000000000008')$$,
  'R-NOTIF-3 a late member can join a ride whose group has already been reminded'
);
reset role;
select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where ride_id = '15100000-0000-4000-8000-000000000008'
     and recipient_id = '15000000-0000-4000-8000-000000000002'
     and kind = 'member_joined'),
  1,
  'R-NOTIF-3 the late join notifies existing non-owner members'
);
select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where ride_id = '15100000-0000-4000-8000-000000000008'
     and recipient_id = '15000000-0000-4000-8000-000000000001'
     and kind = 'member_joined'),
  1,
  'R-NOTIF-3 the owner still receives exactly one late-join notification'
);
select is(
  public.enqueue_ride_reminders(),
  1,
  'R-NOTIF-2 only the new member is reminded after other members were already reminded'
);
select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where ride_id = '15100000-0000-4000-8000-000000000008'
     and kind = 'ride_reminder'
     and recipient_id in (
       '15000000-0000-4000-8000-000000000001',
       '15000000-0000-4000-8000-000000000002'
     )),
  2,
  'R-NOTIF-2 already-reminded members keep exactly one reminder each'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"15000000-0000-4000-8000-000000000005","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.join_ride('15100000-0000-4000-8000-000000000009')$$,
  'R-NOTIF-3 a member can join a ride outside the last 24 hours'
);
reset role;
select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where ride_id = '15100000-0000-4000-8000-000000000009'
     and kind = 'member_joined'),
  1,
  'R-NOTIF-3 an outside-window join notifies only the owner'
);
select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where ride_id = '15100000-0000-4000-8000-000000000009'
     and recipient_id = '15000000-0000-4000-8000-000000000002'),
  0,
  'R-NOTIF-3 an outside-window join does not notify other members'
);

select lives_ok(
  $$select public.run_ride_reminders()$$,
  'R-NOTIF-2 the scheduled worker enqueues locally when Vault credentials are absent'
);
select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.verify_drain_token(text)'::regprocedure,
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.verify_drain_token(text)'::regprocedure,
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.verify_drain_token(text)'::regprocedure,
    'EXECUTE'
  ),
  'R-NOTIF-2 only service_role can execute verify_drain_token'
);
select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.enqueue_ride_reminders()'::regprocedure,
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.enqueue_ride_reminders()'::regprocedure,
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.run_ride_reminders()'::regprocedure,
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.run_ride_reminders()'::regprocedure,
    'EXECUTE'
  ),
  'R-NOTIF-2 reminder worker functions are unavailable to anon and authenticated'
);
select is(
  public.verify_drain_token('missing-token'),
  false,
  'R-NOTIF-2 missing Vault token verifies false'
);
select vault.create_secret(
  'test-reminder-drain-token',
  'notifications_drain_token'
);
select is(
  public.verify_drain_token('test-reminder-drain-token'),
  true,
  'R-NOTIF-2 configured drain token verifies true'
);
select is(
  public.verify_drain_token('wrong-reminder-drain-token'),
  false,
  'R-NOTIF-2 incorrect drain token verifies false'
);

set local role anon;
select throws_ok(
  $$select public.verify_drain_token('test-reminder-drain-token')$$,
  '42501',
  null,
  'R-NOTIF-2 anon cannot execute verify_drain_token'
);
reset role;
set local role authenticated;
select throws_ok(
  $$select public.verify_drain_token('test-reminder-drain-token')$$,
  '42501',
  null,
  'R-NOTIF-2 authenticated cannot execute verify_drain_token'
);
reset role;

select is(
  (select pg_catalog.count(*)::integer
   from cron.job
   where jobname = 'ride-reminders'),
  1,
  'R-NOTIF-2 the ten-minute reminder cron job is scheduled exactly once'
);

select * from finish();

rollback;
