begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('70000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@gatech.edu', '', pg_catalog.now()),
  ('70000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'member@gatech.edu', '', pg_catalog.now()),
  ('70000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'outsider@gatech.edu', '', pg_catalog.now());

insert into public.profiles (id, email, first_name, last_name, phone, venmo)
values
  ('70000000-0000-4000-8000-000000000001', 'owner@gatech.edu', 'Alex', 'Owner', '+14045550123', 'alex_owner'),
  ('70000000-0000-4000-8000-000000000002', 'member@gatech.edu', 'Taylor', 'Parker', '+14045550124', 'taylor_handle'),
  ('70000000-0000-4000-8000-000000000003', 'outsider@gatech.edu', 'Chris', 'Smith', '+14045550125', 'chris_handle');

insert into public.rides (id, owner_id, origin, destination, departs_at, seats, notes, status)
values
  ('77000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', '2026-12-12 04:30:00+00', 4, 'main notes', 'active'),
  ('77000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001', 'gt', 'atl-intl', '2026-12-12 04:50:00+00', 2, 'full notes', 'active'),
  ('77000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '2 days', 4, 'cancelled notes', 'cancelled'),
  ('77000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() - interval '1 day', 4, 'past notes', 'active'),
  ('77000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000001', 'atl-domestic', 'gt', pg_catalog.now() + interval '3 days', 4, 'campus notes', 'active');

insert into public.ride_members (ride_id, user_id, joined_at)
values
  ('77000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', pg_catalog.now() - interval '1 hour'),
  ('77000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000002', pg_catalog.now()),
  ('77000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001', pg_catalog.now() - interval '1 hour'),
  ('77000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000002', pg_catalog.now()),
  ('77000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000001', pg_catalog.now()),
  ('77000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000002', pg_catalog.now()),
  ('77000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000001', pg_catalog.now()),
  ('77000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000002', pg_catalog.now()),
  ('77000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000001', pg_catalog.now());

set local role anon;
select set_config('request.jwt.claims', '{}', true);
select is(
  (select pg_catalog.array_agg(k order by k)
   from pg_catalog.jsonb_object_keys(public.get_ride('77000000-0000-4000-8000-000000000001')) as keys(k)),
  array['departs_at', 'destination', 'id', 'is_past', 'origin', 'seats', 'seats_left', 'status']::text[],
  'R-VIS-1 signed-out ride response has exactly the public key set'
);
select ok(
  not (
    public.get_ride('77000000-0000-4000-8000-000000000001')
    ?| array['notes', 'members', 'viewer_is_member', 'viewer_is_owner']
  ),
  'R-VIS-1 signed-out ride response omits notes members and viewer flags'
);
select is(
  (select pg_catalog.array_agg(k order by k)
   from pg_catalog.jsonb_object_keys(
     public.get_ride('77000000-0000-4000-8000-000000000001') -> 'origin'
   ) as keys(k)),
  array['address', 'name', 'short_name', 'slug']::text[],
  'R-VIS-1 signed-out place object has exactly its public keys'
);
select is(
  public.get_ride('77000000-0000-4000-8000-000000000003'),
  null::jsonb,
  'R-VIS-5 signed-out viewer gets no cancelled ride'
);
select is(
  public.get_ride('77000000-0000-4000-8000-000000000004'),
  null::jsonb,
  'R-VIS-5 signed-out viewer gets no past ride'
);
select is(
  public.get_ride('77999999-0000-4000-8000-000000000001'),
  null::jsonb,
  'R-VIS-5 missing ride returns null'
);
select is(
  (select pg_catalog.array_agg(k order by k)
   from pg_catalog.jsonb_object_keys(
     (public.list_rides('airport', '2026-12-11'::date) -> 0)
   ) as keys(k)),
  array['departs_at', 'destination', 'id', 'origin', 'seats', 'seats_left']::text[],
  'R-VIS-1 signed-out list item has exactly its public key set'
);
select ok(
  not ((public.list_rides('airport', '2026-12-11'::date) -> 0) ?| array['owner_name', 'is_member']),
  'R-VIS-1 signed-out list item omits owner and membership details'
);
select is(
  (select pg_catalog.array_agg(item ->> 'id' order by item ->> 'id')
   from pg_catalog.jsonb_array_elements(public.list_rides('airport', null)) as rides(item)),
  array[
    '77000000-0000-4000-8000-000000000001',
    '77000000-0000-4000-8000-000000000002'
  ]::text[],
  'R-VIS-5 browse omits cancelled and past rides'
);
select is(
  pg_catalog.jsonb_array_length(public.list_rides('airport', '2026-12-11'::date)),
  2,
  'R-RIDE-5 p_day uses the Atlanta date for a ride at 04:30 UTC'
);
select is(
  pg_catalog.jsonb_array_length(public.list_rides('airport', '2026-12-12'::date)),
  0,
  'R-RIDE-5 ride at 04:30 UTC is not on the next Atlanta calendar day'
);
select is(
  (select pg_catalog.array_agg(item ->> 'id' order by ordinal)
   from pg_catalog.jsonb_array_elements(public.list_rides('airport', '2026-12-11'::date))
     with ordinality as rides(item, ordinal)),
  array[
    '77000000-0000-4000-8000-000000000001',
    '77000000-0000-4000-8000-000000000002'
  ]::text[],
  'R-VIS-1 browse places non-full rides before full rides'
);
select is(
  (select item ->> 'id'
   from pg_catalog.jsonb_array_elements(public.list_rides('campus', null)) as rides(item)
   limit 1),
  '77000000-0000-4000-8000-000000000005',
  'R-PLACE-2 campus direction filters by campus destination'
);
select throws_ok(
  $$select public.list_rides('invalid', null)$$,
  'P0001',
  'invalid_route',
  'R-PLACE-2 invalid list direction raises invalid_route'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
select is(
  (select pg_catalog.array_agg(k order by k)
   from pg_catalog.jsonb_object_keys(public.get_ride('77000000-0000-4000-8000-000000000001')) as keys(k)),
  array[
    'departs_at', 'destination', 'id', 'is_past', 'members', 'notes',
    'origin', 'seats', 'seats_left', 'status', 'viewer_is_member', 'viewer_is_owner'
  ]::text[],
  'R-VIS-2 signed-in non-member ride response has exactly its key set'
);
select is(
  (select pg_catalog.array_agg(k order by k)
   from pg_catalog.jsonb_object_keys(
     public.get_ride('77000000-0000-4000-8000-000000000001') -> 'members' -> 0
   ) as keys(k)),
  array['is_owner', 'name']::text[],
  'R-VIS-2 non-member sees first names and last initials only'
);
select ok(
  not pg_catalog.jsonb_path_exists(
    public.get_ride('77000000-0000-4000-8000-000000000001'),
    '$.members[*].phone'
  )
  and not pg_catalog.jsonb_path_exists(
    public.get_ride('77000000-0000-4000-8000-000000000001'),
    '$.members[*].email'
  )
  and not pg_catalog.jsonb_path_exists(
    public.get_ride('77000000-0000-4000-8000-000000000001'),
    '$.members[*].venmo'
  ),
  'R-VIS-2 non-member never sees member phone email or Venmo'
);
select is(
  (select pg_catalog.array_agg(k order by k)
   from pg_catalog.jsonb_object_keys(
     (public.list_rides('airport', '2026-12-11'::date) -> 0)
   ) as keys(k)),
  array[
    'departs_at', 'destination', 'id', 'is_member', 'origin',
    'owner_name', 'seats', 'seats_left'
  ]::text[],
  'R-VIS-2 signed-in list item has exactly its key set'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select is(
  (select pg_catalog.array_agg(k order by k)
   from pg_catalog.jsonb_object_keys(
     public.get_ride('77000000-0000-4000-8000-000000000001') -> 'members' -> 1
   ) as keys(k)),
  array['email', 'first_name', 'is_owner', 'is_viewer', 'last_name', 'name', 'phone', 'venmo']::text[],
  'R-VIS-3 member sees the exact full member key set'
);
select is(
  public.get_ride('77000000-0000-4000-8000-000000000001') -> 'members' -> 1 ->> 'email',
  'member@gatech.edu',
  'R-VIS-3 member sees member email'
);
select ok(
  public.get_ride('77000000-0000-4000-8000-000000000003') is not null,
  'R-VIS-5 cancelled ride remains visible to its member'
);
select ok(
  public.get_ride('77000000-0000-4000-8000-000000000004') is not null,
  'R-VIS-5 past ride remains visible to its member'
);

select * from finish();

rollback;
