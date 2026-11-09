begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
select
  ('50000000-0000-4000-8000-' || pg_catalog.lpad(n::text, 12, '0'))::uuid,
  'authenticated',
  'authenticated',
  case when n = 5 then 'outsider@gatech.edu' else 'joiner' || n::text || '@gatech.edu' end,
  '',
  pg_catalog.now()
from pg_catalog.generate_series(1, 9) as users(n);

insert into public.profiles (id, email, first_name, last_name, phone)
select
  u.id,
  pg_catalog.lower(u.email),
  'Member',
  pg_catalog.right(u.email, 1),
  '+14045550123'
from auth.users as u
where u.id <> '50000000-0000-4000-8000-000000000004';

insert into public.rides (id, owner_id, origin, destination, departs_at, seats, status)
values
  ('55000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 3, 'active'),
  ('55000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 3, 'cancelled'),
  ('55000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() - interval '1 hour', 3, 'active'),
  ('55000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000006', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 4, 'active'),
  ('55000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000009', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 2, 'active'),
  ('55000000-0000-4000-8000-000000000006', '50000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 2, 'active');

insert into public.ride_members (ride_id, user_id, joined_at)
values
  ('55000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', pg_catalog.now() - interval '4 hours'),
  ('55000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', pg_catalog.now() - interval '3 hours'),
  ('55000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', pg_catalog.now() - interval '2 hours'),
  ('55000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', pg_catalog.now()),
  ('55000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000001', pg_catalog.now()),
  ('55000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000006', '2026-01-01 00:00:00+00'),
  ('55000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000007', '2026-01-02 00:00:00+00'),
  ('55000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000008', '2026-01-02 00:00:00+00'),
  ('55000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000005', '2026-01-03 00:00:00+00'),
  ('55000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000009', pg_catalog.now()),
  ('55000000-0000-4000-8000-000000000006', '50000000-0000-4000-8000-000000000001', pg_catalog.now());

set local role authenticated;
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  $$select public.join_ride('55000000-0000-4000-8000-000000000006')$$,
  'P0001',
  'not_authenticated',
  'R-JOIN-1 join requires authentication'
);
select throws_ok(
  $$select public.leave_ride('55000000-0000-4000-8000-000000000006')$$,
  'P0001',
  'not_authenticated',
  'R-LEAVE-1 leave requires authentication'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"50000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.join_ride('55000000-0000-4000-8000-000000000006')$$,
  'P0001',
  'profile_required',
  'R-AUTH-4 join requires a complete profile'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.join_ride('55999999-0000-4000-8000-000000000001')$$,
  'P0001',
  'ride_not_found',
  'R-JOIN-1 join rejects a missing ride'
);
select throws_ok(
  $$select public.join_ride('55000000-0000-4000-8000-000000000002')$$,
  'P0001',
  'ride_not_active',
  'R-JOIN-1 join rejects a cancelled ride'
);
select throws_ok(
  $$select public.join_ride('55000000-0000-4000-8000-000000000003')$$,
  'P0001',
  'ride_departed',
  'R-PAST-1 join rejects a departed ride'
);
select throws_ok(
  $$select public.join_ride('55000000-0000-4000-8000-000000000001')$$,
  'P0001',
  'already_member',
  'R-JOIN-1 join rejects an existing member before the full-seat check'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"50000000-0000-4000-8000-000000000005","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.join_ride('55000000-0000-4000-8000-000000000001')$$,
  'P0001',
  'ride_full',
  'R-JOIN-1 join rejects a full ride'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"50000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.join_ride('55000000-0000-4000-8000-000000000006')$$,
  'R-JOIN-2 join adds one member to a ride with a free seat'
);
reset role;
select is(
  (select pg_catalog.count(*)::integer
   from public.ride_members
   where ride_id = '55000000-0000-4000-8000-000000000006'),
  2,
  'R-JOIN-2 joined membership count equals two'
);
select ok(
  exists (
    select 1
    from public.rides as r
    join public.ride_members as rm on rm.ride_id = r.id
    where r.id = '55000000-0000-4000-8000-000000000006'
      and rm.user_id = r.owner_id
  ),
  'R-JOIN-1 owner remains a member after another user joins'
);
select ok(
  (select pg_catalog.count(*) <= r.seats
   from public.rides as r
   join public.ride_members as rm on rm.ride_id = r.id
   where r.id = '55000000-0000-4000-8000-000000000006'
   group by r.id, r.seats),
  'R-JOIN-2 successful join never exceeds seats'
);

set local role authenticated;
select throws_ok(
  $$select public.join_ride('55000000-0000-4000-8000-000000000006')$$,
  'P0001',
  'already_member',
  'R-JOIN-1 joining twice raises already_member'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.leave_ride('55999999-0000-4000-8000-000000000001')$$,
  'P0001',
  'ride_not_found',
  'R-LEAVE-1 leave rejects a missing ride'
);
select throws_ok(
  $$select public.leave_ride('55000000-0000-4000-8000-000000000002')$$,
  'P0001',
  'ride_not_active',
  'R-CANCEL-1 leave rejects a cancelled ride'
);
select throws_ok(
  $$select public.leave_ride('55000000-0000-4000-8000-000000000003')$$,
  'P0001',
  'ride_departed',
  'R-PAST-1 leave rejects a departed ride'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"50000000-0000-4000-8000-000000000005","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.leave_ride('55000000-0000-4000-8000-000000000001')$$,
  'P0001',
  'not_member',
  'R-LEAVE-1 leave rejects a non-member'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"50000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.leave_ride('55000000-0000-4000-8000-000000000001')$$,
  'R-LEAVE-1 non-owner member can leave before departure'
);
reset role;
select ok(
  not exists (
    select 1 from public.ride_members
    where ride_id = '55000000-0000-4000-8000-000000000001'
      and user_id = '50000000-0000-4000-8000-000000000002'
  )
  and exists (
    select 1 from public.ride_members
    where ride_id = '55000000-0000-4000-8000-000000000001'
      and user_id = '50000000-0000-4000-8000-000000000001'
  ),
  'R-LEAVE-1 non-owner leave deletes only that membership'
);
select ok(
  (select pg_catalog.count(*) <= r.seats
   from public.rides as r
   join public.ride_members as rm on rm.ride_id = r.id
   where r.id = '55000000-0000-4000-8000-000000000001'
   group by r.id, r.seats),
  'R-LEAVE-1 non-owner leave preserves member count within seats'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"50000000-0000-4000-8000-000000000006","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.leave_ride('55000000-0000-4000-8000-000000000004')$$,
  'R-LEAVE-2 owner can leave and transfer an active ride'
);
reset role;
select is(
  (select owner_id from public.rides where id = '55000000-0000-4000-8000-000000000004'),
  '50000000-0000-4000-8000-000000000007'::uuid,
  'R-LEAVE-2 transfer chooses earliest joined user id for equal timestamps'
);
select ok(
  not exists (
    select 1 from public.ride_members
    where ride_id = '55000000-0000-4000-8000-000000000004'
      and user_id = '50000000-0000-4000-8000-000000000006'
  )
  and exists (
    select 1 from public.ride_members
    where ride_id = '55000000-0000-4000-8000-000000000004'
      and user_id = '50000000-0000-4000-8000-000000000007'
  ),
  'R-LEAVE-2 old owner leaves and selected successor remains a member'
);
select ok(
  (select pg_catalog.count(*) <= r.seats
   from public.rides as r
   join public.ride_members as rm on rm.ride_id = r.id
   where r.id = '55000000-0000-4000-8000-000000000004'
   group by r.id, r.seats),
  'R-LEAVE-2 transfer preserves member count within seats'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"50000000-0000-4000-8000-000000000009","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.leave_ride('55000000-0000-4000-8000-000000000005')$$,
  'R-LEAVE-3 owner alone can leave'
);
reset role;
select is(
  (select status::text from public.rides where id = '55000000-0000-4000-8000-000000000005'),
  'cancelled',
  'R-LEAVE-3 owner-alone leave cancels the ride'
);
select ok(
  exists (
    select 1 from public.ride_members
    where ride_id = '55000000-0000-4000-8000-000000000005'
      and user_id = '50000000-0000-4000-8000-000000000009'
  ),
  'R-LEAVE-3 owner-alone cancellation retains the owner membership'
);
select ok(
  (select pg_catalog.count(*) <= r.seats
   from public.rides as r
   join public.ride_members as rm on rm.ride_id = r.id
   where r.id = '55000000-0000-4000-8000-000000000005'
   group by r.id, r.seats),
  'R-LEAVE-3 owner-alone cancellation preserves member count within seats'
);

select * from finish();

rollback;
