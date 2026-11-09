begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('40000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@gatech.edu', '', pg_catalog.now()),
  ('40000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'incomplete@gatech.edu', '', pg_catalog.now());

insert into public.profiles (id, email, first_name, last_name, phone)
values (
  '40000000-0000-4000-8000-000000000001',
  'owner@gatech.edu',
  'Owner',
  'One',
  '+14045550123'
);
update public.profiles set gender = 'brother' where gender is null;

set local role authenticated;
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  $$select public.create_ride('gt', 'atl-domestic', pg_catalog.now() + interval '1 hour', 4, '', 'anyone')$$,
  'P0001',
  'not_authenticated',
  'R-RIDE-4 create ride requires authentication'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.create_ride('gt', 'atl-domestic', pg_catalog.now() + interval '1 hour', 4, '', 'anyone')$$,
  'P0001',
  'profile_required',
  'R-AUTH-4 create ride requires a complete profile'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.create_ride('gt', 'gt', pg_catalog.now(), 1, pg_catalog.repeat('x', 281), 'anyone')$$,
  'P0001',
  'invalid_route',
  'R-PLACE-2 create validates route before time seats and notes'
);
select throws_ok(
  $$select public.create_ride('gt', 'atl-domestic', pg_catalog.now() + interval '1 minute', 1, pg_catalog.repeat('x', 281), 'anyone')$$,
  'P0001',
  'invalid_time',
  'R-RIDE-2 create validates departure before seats and notes'
);
select throws_ok(
  $$select public.create_ride('gt', 'atl-domestic', pg_catalog.now() + interval '1 hour', 1, pg_catalog.repeat('x', 281), 'anyone')$$,
  'P0001',
  'invalid_seats',
  'R-RIDE-1 create validates seats before notes'
);
select throws_ok(
  $$select public.create_ride('gt', 'atl-domestic', pg_catalog.now() + interval '1 hour', 4, pg_catalog.repeat('x', 281), 'anyone')$$,
  'P0001',
  'invalid_notes',
  'R-RIDE-3 create rejects notes over 280 characters after trimming'
);
select ok(
  public.create_ride('gt', 'atl-domestic', pg_catalog.now() + interval '1 hour', 4, '  meet outside  ', 'anyone') is not null,
  'R-RIDE-1 valid create returns a ride id'
);

reset role;

select is(
  (select pg_catalog.count(*)::integer
   from public.rides as r
   join public.ride_members as rm on rm.ride_id = r.id
   where r.owner_id = '40000000-0000-4000-8000-000000000001'),
  1,
  'R-RIDE-1 create inserts the owner membership'
);
select ok(
  (select pg_catalog.count(*) <= r.seats
   from public.rides as r
   join public.ride_members as rm on rm.ride_id = r.id
   where r.owner_id = '40000000-0000-4000-8000-000000000001'
   group by r.id, r.seats),
  'R-JOIN-2 create leaves member count at or below seats'
);

insert into public.rides (owner_id, origin, destination, departs_at, seats)
select
  '40000000-0000-4000-8000-000000000001',
  'gt',
  'atl-domestic',
  pg_catalog.now() + interval '2 hours' + (n * interval '1 day'),
  4
from pg_catalog.generate_series(1, 4) as gs(n);

insert into public.ride_members (ride_id, user_id)
select r.id, r.owner_id
from public.rides as r
where r.owner_id = '40000000-0000-4000-8000-000000000001'
  and not exists (
    select 1 from public.ride_members as rm where rm.ride_id = r.id
  );

set local role authenticated;
select throws_ok(
  $$select public.create_ride('gt', 'atl-domestic', pg_catalog.now() + interval '1 hour', 4, '', 'anyone')$$,
  'P0001',
  'too_many_rides',
  'R-RIDE-4 fifth active upcoming owned ride blocks another create'
);

reset role;

select is(
  (select pg_catalog.count(*)::integer
   from public.rides as r
   where r.owner_id = '40000000-0000-4000-8000-000000000001'
     and r.status = 'active'
     and r.departs_at > pg_catalog.now()),
  5,
  'R-RIDE-4 rejected create does not add a sixth owned ride'
);
select is(
  (select pg_catalog.count(*)::integer
   from public.rides as r
   where r.owner_id = '40000000-0000-4000-8000-000000000001'
     and not exists (
       select 1 from public.ride_members as rm
       where rm.ride_id = r.id and rm.user_id = r.owner_id
     )),
  0,
  'R-LEAVE-2 owner remains a member of every owned ride'
);

select * from finish();

rollback;
