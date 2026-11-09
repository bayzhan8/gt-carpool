begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('90000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'deleting@gatech.edu', '', pg_catalog.now()),
  ('90000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'successor@gatech.edu', '', pg_catalog.now()),
  ('90000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'successor2@gatech.edu', '', pg_catalog.now()),
  ('90000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'otherowner@gatech.edu', '', pg_catalog.now());

insert into public.profiles (id, email, first_name, last_name, phone)
select u.id, u.email, 'Delete', pg_catalog.left(u.email, 1), '+14045550123'
from auth.users as u;
update public.profiles set gender = 'man' where gender is null;

insert into public.rides (id, owner_id, origin, destination, departs_at, seats, status)
values
  ('99000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 4, 'active'),
  ('99000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000004', 'gt', 'atl-domestic', pg_catalog.now() + interval '2 days', 4, 'active'),
  ('99000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000004', 'gt', 'atl-domestic', pg_catalog.now() + interval '3 days', 4, 'cancelled');

insert into public.ride_members (ride_id, user_id, joined_at)
values
  ('99000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', '2026-01-01 00:00:00+00'),
  ('99000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002', '2026-01-02 00:00:00+00'),
  ('99000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000003', '2026-01-02 00:00:00+00'),
  ('99000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000004', pg_catalog.now()),
  ('99000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', pg_catalog.now()),
  ('99000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000004', pg_catalog.now()),
  ('99000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001', pg_catalog.now());

set local role authenticated;
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  $$select public.delete_my_account()$$,
  'P0001',
  'not_authenticated',
  'R-PROF-2 account deletion requires authentication'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.delete_my_account()$$,
  'R-PROF-2 account deletion leaves upcoming rides before deleting the auth user'
);

reset role;
select is(
  (select owner_id from public.rides where id = '99000000-0000-4000-8000-000000000001'),
  '90000000-0000-4000-8000-000000000002'::uuid,
  'R-PROF-2 account deletion transfers owned ride to the earliest joiner with user-id tie break'
);
select ok(
  not exists (select 1 from auth.users where id = '90000000-0000-4000-8000-000000000001')
  and not exists (select 1 from public.profiles where id = '90000000-0000-4000-8000-000000000001'),
  'R-PROF-2 account deletion removes auth user and cascades profile'
);
select ok(
  exists (
    select 1 from public.ride_members
    where ride_id = '99000000-0000-4000-8000-000000000001'
      and user_id = '90000000-0000-4000-8000-000000000002'
  )
  and not exists (
    select 1 from public.ride_members
    where ride_id = '99000000-0000-4000-8000-000000000001'
      and user_id = '90000000-0000-4000-8000-000000000001'
  ),
  'R-PROF-2 transferred owner remains a member and deleted owner leaves membership'
);
select ok(
  exists (
    select 1 from public.rides as r
    join public.ride_members as rm on rm.ride_id = r.id
    where r.id = '99000000-0000-4000-8000-000000000001'
      and rm.user_id = r.owner_id
  )
  and (
    select pg_catalog.count(*) <= r.seats
    from public.rides as r
    join public.ride_members as rm on rm.ride_id = r.id
    where r.id = '99000000-0000-4000-8000-000000000001'
    group by r.id, r.seats
  ),
  'R-PROF-2 ownership transfer preserves owner membership and seat invariant'
);
select ok(
  not exists (
    select 1 from public.ride_members
    where ride_id = '99000000-0000-4000-8000-000000000002'
      and user_id = '90000000-0000-4000-8000-000000000001'
  )
  and exists (
    select 1 from public.ride_members
    where ride_id = '99000000-0000-4000-8000-000000000002'
      and user_id = '90000000-0000-4000-8000-000000000004'
  ),
  'R-PROF-2 account deletion removes user from another active upcoming ride'
);
select ok(
  not exists (
    select 1 from public.ride_members
    where ride_id = '99000000-0000-4000-8000-000000000003'
      and user_id = '90000000-0000-4000-8000-000000000001'
  ),
  'R-PROF-2 profile cascade removes membership from cancelled history'
);
select is(
  (select pg_catalog.count(*)::integer
   from public.ride_members
   where ride_id = '99000000-0000-4000-8000-000000000001'),
  2,
  'R-PROF-2 account deletion leaves both remaining ride members intact'
);
select is(
  (select status::text from public.rides where id = '99000000-0000-4000-8000-000000000002'),
  'active',
  'R-PROF-2 non-owned upcoming ride remains active after account deletion'
);

select * from finish();

rollback;
