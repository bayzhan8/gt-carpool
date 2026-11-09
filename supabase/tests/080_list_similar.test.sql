begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('80000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@gatech.edu', '', pg_catalog.now()),
  ('80000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'viewer@gatech.edu', '', pg_catalog.now()),
  ('80000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'other@gatech.edu', '', pg_catalog.now());

insert into public.profiles (id, email, first_name, last_name, phone, venmo)
values
  ('80000000-0000-4000-8000-000000000001', 'owner@gatech.edu', 'Owner', 'One', '+14045550123', 'owner_one'),
  ('80000000-0000-4000-8000-000000000002', 'viewer@gatech.edu', 'Viewer', 'Two', '+14045550124', 'viewer_two'),
  ('80000000-0000-4000-8000-000000000003', 'other@gatech.edu', 'Other', 'Three', '+14045550125', 'other_three');
update public.profiles set gender = 'brother' where gender is null;

insert into public.rides (id, owner_id, origin, destination, departs_at, seats, status)
values
  ('88000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '4 hours', 4, 'active'),
  ('88000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '3 hours 30 minutes', 4, 'active'),
  ('88000000-0000-4000-8000-000000000003', '80000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '5 hours 30 minutes', 4, 'active'),
  ('88000000-0000-4000-8000-000000000004', '80000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '5 hours 30 minutes 1 second', 4, 'active'),
  ('88000000-0000-4000-8000-000000000005', '80000000-0000-4000-8000-000000000001', 'gt', 'atl-intl', pg_catalog.now() + interval '4 hours', 4, 'active'),
  ('88000000-0000-4000-8000-000000000006', '80000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '4 hours', 2, 'active'),
  ('88000000-0000-4000-8000-000000000007', '80000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '4 hours', 4, 'cancelled'),
  ('88000000-0000-4000-8000-000000000008', '80000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() - interval '1 hour', 4, 'active'),
  ('88000000-0000-4000-8000-000000000009', '80000000-0000-4000-8000-000000000002', 'gt', 'atl-domestic', pg_catalog.now() + interval '3 days', 4, 'active'),
  ('88000000-0000-4000-8000-000000000010', '80000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '2 days', 4, 'cancelled'),
  ('88000000-0000-4000-8000-000000000011', '80000000-0000-4000-8000-000000000003', 'gt', 'atl-domestic', pg_catalog.now() - interval '1 day', 4, 'active');

insert into public.ride_members (ride_id, user_id)
values
  ('88000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001'),
  ('88000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000001'),
  ('88000000-0000-4000-8000-000000000003', '80000000-0000-4000-8000-000000000001'),
  ('88000000-0000-4000-8000-000000000004', '80000000-0000-4000-8000-000000000001'),
  ('88000000-0000-4000-8000-000000000005', '80000000-0000-4000-8000-000000000001'),
  ('88000000-0000-4000-8000-000000000006', '80000000-0000-4000-8000-000000000001'),
  ('88000000-0000-4000-8000-000000000006', '80000000-0000-4000-8000-000000000003'),
  ('88000000-0000-4000-8000-000000000007', '80000000-0000-4000-8000-000000000001'),
  ('88000000-0000-4000-8000-000000000008', '80000000-0000-4000-8000-000000000001'),
  ('88000000-0000-4000-8000-000000000009', '80000000-0000-4000-8000-000000000002'),
  ('88000000-0000-4000-8000-000000000010', '80000000-0000-4000-8000-000000000002'),
  ('88000000-0000-4000-8000-000000000011', '80000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  $$select public.find_similar_rides('gt', 'atl-domestic', pg_catalog.now() + interval '4 hours')$$,
  'P0001',
  'not_authenticated',
  'R-DUP-1 similar ride lookup requires authentication'
);
select throws_ok(
  $$select public.my_rides()$$,
  'P0001',
  'not_authenticated',
  'R-AUTH-4 my rides requires authentication'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select is(
  (select pg_catalog.array_agg(item ->> 'id' order by ordinal)
   from pg_catalog.jsonb_array_elements(
     public.find_similar_rides('gt', 'atl-domestic', pg_catalog.now() + interval '4 hours')
   ) with ordinality as rides(item, ordinal)),
  array[
    '88000000-0000-4000-8000-000000000001',
    '88000000-0000-4000-8000-000000000002',
    '88000000-0000-4000-8000-000000000003'
  ]::text[],
  'R-DUP-1 similar rides include only active upcoming available non-member rides within 90 minutes in time order'
);
select is(
  (select pg_catalog.array_agg(k order by k)
   from pg_catalog.jsonb_object_keys(
     public.find_similar_rides('gt', 'atl-domestic', pg_catalog.now() + interval '4 hours') -> 0
   ) as keys(k)),
  array[
    'audience', 'departs_at', 'destination', 'id', 'is_member', 'mix', 'origin',
    'owner_name', 'seats', 'seats_left'
  ]::text[],
  'R-DUP-1 similar ride item uses the signed-in browse shape'
);
select ok(
  not exists (
    select 1
    from pg_catalog.jsonb_array_elements(
      public.find_similar_rides('gt', 'atl-domestic', pg_catalog.now() + interval '4 hours')
    ) as rides(item)
    where (item ->> 'is_member')::boolean
  ),
  'R-DUP-1 similar rides exclude the viewer as a member'
);
select is(
  (select pg_catalog.array_agg(item ->> 'id' order by ordinal)
   from pg_catalog.jsonb_array_elements(public.my_rides()) with ordinality as rides(item, ordinal)),
  array[
    '88000000-0000-4000-8000-000000000009',
    '88000000-0000-4000-8000-000000000010',
    '88000000-0000-4000-8000-000000000011'
  ]::text[],
  'R-AUTH-4 my rides includes future cancelled and past memberships ordered by departure descending'
);
select is(
  (select pg_catalog.array_agg(k order by k)
   from pg_catalog.jsonb_object_keys(public.my_rides() -> 0) as keys(k)),
  array[
    'audience', 'departs_at', 'destination', 'id', 'is_member', 'is_owner',
    'is_past', 'mix', 'origin', 'owner_name', 'seats', 'seats_left', 'status'
  ]::text[],
  'R-AUTH-4 my ride item has the required list fields and status flags'
);
select is(
  (select item ->> 'status'
   from pg_catalog.jsonb_array_elements(public.my_rides()) as rides(item)
   where item ->> 'id' = '88000000-0000-4000-8000-000000000010'),
  'cancelled',
  'R-CANCEL-1 my rides retains cancelled rides in history'
);
select is(
  (select (item ->> 'is_past')::boolean
   from pg_catalog.jsonb_array_elements(public.my_rides()) as rides(item)
   where item ->> 'id' = '88000000-0000-4000-8000-000000000011'),
  true,
  'R-PAST-1 my rides marks departed history as past'
);

select * from finish();

rollback;
