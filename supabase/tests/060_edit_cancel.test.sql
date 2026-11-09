begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('60000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@gatech.edu', '', pg_catalog.now()),
  ('60000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'member@gatech.edu', '', pg_catalog.now()),
  ('60000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'member2@gatech.edu', '', pg_catalog.now()),
  ('60000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'outsider@gatech.edu', '', pg_catalog.now());

insert into public.profiles (id, email, first_name, last_name, phone)
select u.id, u.email, 'Edit', pg_catalog.left(u.email, 1), '+14045550123'
from auth.users as u
where u.id between '60000000-0000-4000-8000-000000000001'::uuid
  and '60000000-0000-4000-8000-000000000004'::uuid;
update public.profiles set gender = 'man' where gender is null;

insert into public.rides (id, owner_id, origin, destination, departs_at, seats, notes, status)
values
  ('66000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 4, 'old', 'active'),
  ('66000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 4, 'cancelled', 'cancelled'),
  ('66000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() - interval '1 hour', 4, 'past', 'active'),
  ('66000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '2 days', 2, 'cancel target', 'active');

insert into public.ride_members (ride_id, user_id)
values
  ('66000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001'),
  ('66000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002'),
  ('66000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000003'),
  ('66000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001'),
  ('66000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000001'),
  ('66000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  $$select public.update_ride('66000000-0000-4000-8000-000000000001', pg_catalog.now() + interval '2 hours', 3, '', 'anyone')$$,
  'P0001',
  'not_authenticated',
  'R-EDIT-1 update requires authentication'
);
select throws_ok(
  $$select public.cancel_ride('66000000-0000-4000-8000-000000000001')$$,
  'P0001',
  'not_authenticated',
  'R-CANCEL-1 cancel requires authentication'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.update_ride('66999999-0000-4000-8000-000000000001', pg_catalog.now() + interval '2 hours', 3, '', 'anyone')$$,
  'P0001',
  'ride_not_found',
  'R-EDIT-1 update rejects a missing ride'
);
select throws_ok(
  $$select public.update_ride('66000000-0000-4000-8000-000000000001', pg_catalog.now() + interval '2 hours', 3, '', 'anyone')$$,
  'P0001',
  'not_owner',
  'R-EDIT-1 update rejects a non-owner'
);
select throws_ok(
  $$select public.update_ride('66000000-0000-4000-8000-000000000002', pg_catalog.now() + interval '2 hours', 3, '', 'anyone')$$,
  'P0001',
  'not_owner',
  'R-EDIT-1 owner check precedes inactive status check'
);
select throws_ok(
  $$select public.cancel_ride('66999999-0000-4000-8000-000000000001')$$,
  'P0001',
  'ride_not_found',
  'R-CANCEL-1 cancel rejects a missing ride'
);
select throws_ok(
  $$select public.cancel_ride('66000000-0000-4000-8000-000000000001')$$,
  'P0001',
  'not_owner',
  'R-CANCEL-1 cancel rejects a non-owner'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.update_ride('66999999-0000-4000-8000-000000000001', pg_catalog.now() + interval '2 hours', 3, '', 'anyone')$$,
  'P0001',
  'ride_not_found',
  'R-EDIT-1 update reports missing ride before ownership'
);
select throws_ok(
  $$select public.update_ride('66000000-0000-4000-8000-000000000002', pg_catalog.now() + interval '2 hours', 3, '', 'anyone')$$,
  'P0001',
  'ride_not_active',
  'R-EDIT-1 update rejects cancelled ride'
);
select throws_ok(
  $$select public.update_ride('66000000-0000-4000-8000-000000000003', pg_catalog.now() + interval '2 hours', 3, '', 'anyone')$$,
  'P0001',
  'ride_departed',
  'R-PAST-1 update rejects departed ride'
);
select throws_ok(
  $$select public.update_ride('66000000-0000-4000-8000-000000000001', pg_catalog.now() + interval '1 minute', 1, pg_catalog.repeat('x', 281), 'anyone')$$,
  'P0001',
  'invalid_time',
  'R-RIDE-2 update validates time before seats and notes'
);
select throws_ok(
  $$select public.update_ride('66000000-0000-4000-8000-000000000001', pg_catalog.now() + interval '2 hours', 1, pg_catalog.repeat('x', 281), 'anyone')$$,
  'P0001',
  'invalid_seats',
  'R-RIDE-1 update validates seat bounds before notes'
);
select throws_ok(
  $$select public.update_ride('66000000-0000-4000-8000-000000000001', pg_catalog.now() + interval '2 hours', 3, pg_catalog.repeat('x', 281), 'anyone')$$,
  'P0001',
  'invalid_notes',
  'R-RIDE-3 update rejects notes over 280 characters'
);
select throws_ok(
  $$select public.update_ride('66000000-0000-4000-8000-000000000001', pg_catalog.now() + interval '2 hours', 2, '', 'anyone')$$,
  'P0001',
  'seats_below_members',
  'R-EDIT-1 update rejects seats below current member count'
);
select throws_ok(
  $$select public.cancel_ride('66999999-0000-4000-8000-000000000001')$$,
  'P0001',
  'ride_not_found',
  'R-CANCEL-1 cancel reports missing ride before ownership'
);
select throws_ok(
  $$select public.cancel_ride('66000000-0000-4000-8000-000000000002')$$,
  'P0001',
  'ride_not_active',
  'R-CANCEL-1 cancel rejects cancelled ride'
);
select throws_ok(
  $$select public.cancel_ride('66000000-0000-4000-8000-000000000003')$$,
  'P0001',
  'ride_departed',
  'R-PAST-1 cancel rejects departed ride'
);
select lives_ok(
  $$select public.update_ride('66000000-0000-4000-8000-000000000001', pg_catalog.now() + interval '2 hours', 3, '  edited notes  ', 'anyone')$$,
  'R-EDIT-1 owner can update departure seats and notes'
);
select lives_ok(
  $$select public.cancel_ride('66000000-0000-4000-8000-000000000004')$$,
  'R-CANCEL-1 owner can cancel an upcoming active ride'
);

reset role;
select ok(
  (select r.seats = 3
      and r.notes = 'edited notes'
      and r.departs_at between pg_catalog.now() + interval '1 hour' and pg_catalog.now() + interval '3 hours'
   from public.rides as r
   where r.id = '66000000-0000-4000-8000-000000000001'),
  'R-EDIT-1 update stores trimmed notes and validated values'
);
select ok(
  exists (
    select 1 from public.ride_members as rm
    where rm.ride_id = '66000000-0000-4000-8000-000000000001'
      and rm.user_id = '60000000-0000-4000-8000-000000000001'
  )
  and (
    select pg_catalog.count(*) <= r.seats
    from public.rides as r
    join public.ride_members as rm on rm.ride_id = r.id
    where r.id = '66000000-0000-4000-8000-000000000001'
    group by r.id, r.seats
  ),
  'R-EDIT-1 update keeps owner in membership and member count within seats'
);
select is(
  (select status::text from public.rides where id = '66000000-0000-4000-8000-000000000004'),
  'cancelled',
  'R-CANCEL-1 cancel marks ride cancelled'
);
select ok(
  exists (
    select 1 from public.ride_members
    where ride_id = '66000000-0000-4000-8000-000000000004'
      and user_id = '60000000-0000-4000-8000-000000000001'
  ),
  'R-CANCEL-1 cancellation retains owner membership'
);
select ok(
  (select pg_catalog.count(*) <= r.seats
   from public.rides as r
   join public.ride_members as rm on rm.ride_id = r.id
   where r.id = '66000000-0000-4000-8000-000000000004'
   group by r.id, r.seats),
  'R-CANCEL-1 cancellation preserves member count within seats'
);

select * from finish();

rollback;
