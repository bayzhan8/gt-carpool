begin;

create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('16000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'dest-owner@gatech.edu', '', pg_catalog.now()),
  ('16000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'dest-rider@gatech.edu', '', pg_catalog.now()),
  ('16000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'dest-delete@gatech.edu', '', pg_catalog.now());

insert into public.profiles (id, email, first_name, last_name, phone, gender)
values
  ('16000000-0000-4000-8000-000000000001', 'dest-owner@gatech.edu', 'Dest', 'Owner', '+14045550101', null),
  ('16000000-0000-4000-8000-000000000002', 'dest-rider@gatech.edu', 'Dest', 'Rider', '+14045550102', null),
  ('16000000-0000-4000-8000-000000000003', 'dest-delete@gatech.edu', 'Dest', 'Delete', '+14045550103', null);

select set_config(
  'request.jwt.claims',
  '{"sub":"16000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select kind::text from public.places where slug = 'gt'),
  'campus',
  'R-DEST-1 curated campus place remains available'
);
select ok(
  exists (select 1 from pg_catalog.pg_enum e join pg_catalog.pg_type t on t.oid = e.enumtypid
          where t.oid = 'public.place_kind'::regtype and e.enumlabel = 'other'),
  'R-DEST-1 place_kind includes community destinations'
);

select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  $$select public.add_place('Athens')$$,
  'P0001', 'not_authenticated',
  'R-DEST-3 add_place requires authentication'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"16000000-0000-4000-8000-000000000099","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.add_place('Athens')$$,
  'P0001', 'profile_required',
  'R-DEST-3 add_place requires a profile'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"16000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok($$select public.add_place('  ')$$, 'P0001', 'invalid_place_name', 'R-DEST-3 rejects an empty normalized name');
select throws_ok($$select public.add_place('A')$$, 'P0001', 'invalid_place_name', 'R-DEST-3 rejects single-letter names');
select throws_ok($$select public.add_place('A1')$$, 'P0001', 'invalid_place_name', 'R-DEST-3 requires at least two letters');
select throws_ok($$select public.add_place('foo.com')$$, 'P0001', 'invalid_place_name', 'R-DEST-3 rejects domain-like names');
select throws_ok($$select public.add_place('a@b')$$, 'P0001', 'invalid_place_name', 'R-DEST-3 rejects email-like names');
select throws_ok($$select public.add_place('www Atlanta')$$, 'P0001', 'invalid_place_name', 'R-DEST-3 rejects names containing www');
select throws_ok($$select public.add_place('Venue 12345')$$, 'P0001', 'invalid_place_name', 'R-DEST-3 limits the total digit count');
select throws_ok($$select public.add_place('123 Main St')$$, 'P0001', 'invalid_place_name', 'R-DEST-3 rejects street addresses');
select throws_ok($$select public.add_place('12 Main Street')$$, 'P0001', 'invalid_place_name', 'R-DEST-3 rejects names starting with two digits');
select throws_ok($$select public.add_place('4045551234')$$, 'P0001', 'invalid_place_name', 'R-DEST-3 rejects phone numbers');
select throws_ok($$select public.add_place('A place with an invalid name that is far too long')$$, 'P0001', 'invalid_place_name', 'R-DEST-3 enforces the 32-character limit');
select throws_ok($$select public.add_place('Bad! Name')$$, 'P0001', 'invalid_place_name', 'R-DEST-3 rejects unsupported punctuation');
select throws_ok($$select public.add_place('Atlanta Airport')$$, 'P0001', 'place_reserved', 'R-DEST-3 reserves airport aliases');
select throws_ok($$select public.add_place('ATL')$$, 'P0001', 'place_reserved', 'R-DEST-3 reserves the atl alias');
select throws_ok($$select public.add_place('Airport')$$, 'P0001', 'place_reserved', 'R-DEST-3 reserves the airport alias');
select throws_ok($$select public.add_place('ATL Airport')$$, 'P0001', 'place_reserved', 'R-DEST-3 reserves the atl airport alias');
select throws_ok($$select public.add_place('Hartsfield')$$, 'P0001', 'place_reserved', 'R-DEST-3 reserves the hartsfield alias');
select throws_ok($$select public.add_place('Hartsfield Jackson')$$, 'P0001', 'place_reserved', 'R-DEST-3 reserves the Hartsfield Jackson alias');
select throws_ok($$select public.add_place('Hartsfield Jackson Airport')$$, 'P0001', 'place_reserved', 'R-DEST-3 reserves the Hartsfield Jackson Airport alias');
select throws_ok($$select public.add_place('GT')$$, 'P0001', 'place_reserved', 'R-DEST-3 reserves the gt alias');
select throws_ok($$select public.add_place('GaTech')$$, 'P0001', 'place_reserved', 'R-DEST-3 reserves the gatech alias');
select throws_ok($$select public.add_place('Georgia Tech')$$, 'P0001', 'place_reserved', 'R-DEST-3 reserves the Georgia Tech alias');
select throws_ok($$select public.add_place('Campus')$$, 'P0001', 'place_reserved', 'R-DEST-3 reserves curated names and short names');
select throws_ok($$select public.add_place('Tech')$$, 'P0001', 'place_reserved', 'R-DEST-3 reserves the tech alias');
select throws_ok($$select public.add_place('ATL Domestic')$$, 'P0001', 'place_reserved', 'R-DEST-3 reserves curated short names');

select ok(
  (public.add_place('St. Louis')->>'created')::boolean,
  'R-DEST-3 accepts a city name with a period'
);
select is(
  public.add_place('  st louis  ')->>'created',
  'false',
  'R-DEST-3 reuses a normalized punctuation and case duplicate'
);
select is(
  public.add_place('st.   louis')->>'slug',
  public.add_place('St. Louis')->>'slug',
  'R-DEST-3 collapses whitespace and shares the existing slug'
);
select is(
  public.add_place(U&'Cafe\0301')->>'name',
  U&'Caf\00E9',
  'R-DEST-3 normalizes Unicode names to NFC'
);
select ok(
  (select p.slug ~ '^p-[0-9a-f]{10}$'
      and p.name = 'St. Louis'
      and p.short_name = p.name
      and p.address = ''
      and p.kind = 'other'
      and p.sort = 100
      and p.created_by = '16000000-0000-4000-8000-000000000001'
      and p.created_at is not null
      and p.name_key = 'st louis'
   from public.places as p where p.name_key = app.place_key('St. Louis')),
  'R-DEST-3 creates a name-only community place with an opaque slug'
);
select ok(
  not public.list_open_places() @>
    (select pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('slug', p.slug))
     from public.places as p where p.name_key = app.place_key('St. Louis')),
  'R-DEST-4 adding a place without a ride does not make it open'
);

insert into public.places (slug, name, short_name, address, kind, sort, hidden, name_key)
values ('p-hidden160000', 'Hidden Venue', 'Hidden Venue', '', 'other', 100, true, app.place_key('Hidden Venue'));
select throws_ok(
  $$select public.add_place('Hidden Venue')$$,
  'P0001', 'place_unavailable',
  'R-DEST-3 hidden duplicates return place_unavailable'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"16000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select ok((public.add_place('Blue Heron Park')->>'created')::boolean, 'R-DEST-3 creates the first community place');
select ok((public.add_place('North Point Mall')->>'created')::boolean, 'R-DEST-3 creates the second community place');
select ok((public.add_place('Oak Grove Center')->>'created')::boolean, 'R-DEST-3 creates the third community place');
select is(public.add_place('Blue Heron Park')->>'created', 'false', 'R-DEST-3 reuse does not count against the limit');
select throws_ok(
  $$select public.add_place('Pine Lake')$$,
  'P0001', 'place_limit',
  'R-DEST-3 limits new places to three per seven days'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"16000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
insert into public.places (slug, name, short_name, address, kind, sort, name_key)
values
  ('p-open-alpha160', 'Open Alpha', 'Open Alpha', '', 'other', 100, app.place_key('Open Alpha')),
  ('p-open-beta160', 'Open Beta', 'Open Beta', '', 'other', 100, app.place_key('Open Beta')),
  ('p-open-gamma160', 'Open Gamma', 'Open Gamma', '', 'other', 100, app.place_key('Open Gamma')),
  ('p-open-zeta160', 'Open Zeta', 'Open Zeta', '', 'other', 100, app.place_key('Open Zeta')),
  ('p-closed-none160', 'Closed None', 'Closed None', '', 'other', 100, app.place_key('Closed None')),
  ('p-closed-old160', 'Closed Old', 'Closed Old', '', 'other', 100, app.place_key('Closed Old')),
  ('p-closed-cancel160', 'Closed Cancel', 'Closed Cancel', '', 'other', 100, app.place_key('Closed Cancel'));

insert into public.rides (id, owner_id, origin, destination, departs_at, seats, status)
values
  ('16100000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000001', 'gt', 'p-open-alpha160', pg_catalog.now() + interval '2 days', 4, 'active'),
  ('16100000-0000-4000-8000-000000000002', '16000000-0000-4000-8000-000000000001', 'p-open-alpha160', 'gt', pg_catalog.now() + interval '3 days', 4, 'active'),
  ('16100000-0000-4000-8000-000000000003', '16000000-0000-4000-8000-000000000001', 'gt', 'p-open-beta160', pg_catalog.now() - interval '29 days', 4, 'active'),
  ('16100000-0000-4000-8000-000000000004', '16000000-0000-4000-8000-000000000001', 'gt', 'p-closed-old160', pg_catalog.now() - interval '31 days', 4, 'active'),
  ('16100000-0000-4000-8000-000000000005', '16000000-0000-4000-8000-000000000001', 'gt', 'p-closed-cancel160', pg_catalog.now() + interval '1 day', 4, 'cancelled'),
  ('16100000-0000-4000-8000-000000000009', '16000000-0000-4000-8000-000000000001', 'gt', 'p-open-gamma160', pg_catalog.now() - interval '29 days', 4, 'active'),
  ('16100000-0000-4000-8000-000000000010', '16000000-0000-4000-8000-000000000001', 'gt', 'p-open-zeta160', pg_catalog.now() - interval '29 days', 4, 'active');

insert into public.ride_members (ride_id, user_id)
values
  ('16100000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000001'),
  ('16100000-0000-4000-8000-000000000002', '16000000-0000-4000-8000-000000000001'),
  ('16100000-0000-4000-8000-000000000002', '16000000-0000-4000-8000-000000000002'),
  ('16100000-0000-4000-8000-000000000003', '16000000-0000-4000-8000-000000000001'),
  ('16100000-0000-4000-8000-000000000009', '16000000-0000-4000-8000-000000000001'),
  ('16100000-0000-4000-8000-000000000009', '16000000-0000-4000-8000-000000000002'),
  ('16100000-0000-4000-8000-000000000010', '16000000-0000-4000-8000-000000000001');

select is(
  (select item->>'upcoming' from jsonb_array_elements(public.list_open_places()) item where item->>'slug' = 'p-open-alpha160'),
  '2',
  'R-DEST-5 and R-DEST-7 open places count future active rides'
);
select is(
  (select item->>'riders' from jsonb_array_elements(public.list_open_places()) item where item->>'slug' = 'p-open-alpha160'),
  '2',
  'R-DEST-7 open places count distinct riders across the window'
);
select ok(
  public.list_open_places() @> '[{"slug":"p-open-beta160","upcoming":0}]'::jsonb,
  'R-DEST-5 a ride departed 29 days ago keeps a place open'
);
select ok(
  not public.list_open_places() @> '[{"slug":"p-closed-none160"}]'::jsonb
  and not public.list_open_places() @> '[{"slug":"p-closed-old160"}]'::jsonb
  and not public.list_open_places() @> '[{"slug":"p-closed-cancel160"}]'::jsonb,
  'R-DEST-5 no-ride, 31-day-old, and cancelled-only places stay closed'
);
select is(
  (select item->>'slug' from jsonb_array_elements(public.list_open_places()) with ordinality as places(item, ord) order by ord limit 1),
  'p-open-alpha160',
  'R-DEST-7 open places are ordered by upcoming demand'
);
select is(
  (select item->>'slug' from jsonb_array_elements(public.list_open_places()) with ordinality as places(item, ord) where ord = 2),
  'p-open-gamma160',
  'R-DEST-7 ties sort by distinct riders after upcoming rides'
);
select is(
  (select item->>'slug' from jsonb_array_elements(public.list_open_places()) with ordinality as places(item, ord) where ord = 3),
  'p-open-beta160',
  'R-DEST-7 equal ride and rider counts sort by place name'
);
select lives_ok(
  $$
    select public.create_ride(
      'gt',
      (select slug from public.places where name_key = app.place_key('St. Louis')),
      pg_catalog.now() + interval '6 days',
      4, '', 'anyone'
    )
  $$,
  'R-DEST-6 reusing a closed place in a new ride opens it again'
);
select ok(
  public.list_open_places() @>
    (select pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('slug', p.slug))
     from public.places as p where p.name_key = app.place_key('St. Louis')),
  'R-DEST-6 a newly posted ride reopens its existing destination'
);

select throws_ok(
  $$select public.create_ride('p-open-alpha160', 'atl-domestic', pg_catalog.now() + interval '1 day', 4, '', 'anyone')$$,
  'P0001', 'invalid_route',
  'R-DEST-1 rejects community-to-airport routes'
);
select throws_ok(
  $$select public.create_ride('p-open-alpha160', 'p-open-beta160', pg_catalog.now() + interval '1 day', 4, '', 'anyone')$$,
  'P0001', 'invalid_route',
  'R-DEST-1 rejects community-to-community routes'
);
select lives_ok(
  $$select public.create_ride('gt', 'p-open-alpha160', pg_catalog.now() + interval '4 days', 4, '', 'anyone')$$,
  'R-DEST-1 permits campus-to-community routes'
);
select lives_ok(
  $$select public.create_ride('p-open-alpha160', 'gt', pg_catalog.now() + interval '5 days', 4, '', 'anyone')$$,
  'R-DEST-1 permits community-to-campus routes'
);
select throws_ok(
  $$select public.create_ride('gt', 'p-hidden160000', pg_catalog.now() + interval '1 day', 4, '', 'anyone')$$,
  'P0001', 'place_unavailable',
  'R-DEST-9 create_ride rejects hidden places'
);

insert into public.rides (id, owner_id, origin, destination, departs_at, seats, status)
values
  ('16100000-0000-4000-8000-000000000006', '16000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 4, 'active'),
  ('16100000-0000-4000-8000-000000000007', '16000000-0000-4000-8000-000000000001', 'atl-domestic', 'gt', pg_catalog.now() + interval '1 day', 4, 'active'),
  ('16100000-0000-4000-8000-000000000008', '16000000-0000-4000-8000-000000000001', 'gt', 'p-hidden160000', pg_catalog.now() + interval '2 days', 3, 'active');
insert into public.ride_members (ride_id, user_id)
values
  ('16100000-0000-4000-8000-000000000006', '16000000-0000-4000-8000-000000000001'),
  ('16100000-0000-4000-8000-000000000007', '16000000-0000-4000-8000-000000000001'),
  ('16100000-0000-4000-8000-000000000008', '16000000-0000-4000-8000-000000000001');
select ok(
  public.list_rides('airport', null) @> '[{"origin":{"slug":"gt"},"destination":{"slug":"atl-domestic"}}]'
  and not (public.list_rides('airport', null) @> '[{"origin":{"slug":"gt"},"destination":{"slug":"p-open-alpha160"}}]'),
  'R-DEST-8 airport and campus directions exclude community routes'
);
select ok(
  public.list_rides('campus', null) @> '[{"origin":{"slug":"atl-domestic"},"destination":{"slug":"gt"}}]'
  and not (public.list_rides('campus', null) @> '[{"origin":{"slug":"p-open-alpha160"},"destination":{"slug":"gt"}}]'),
  'R-DEST-8 From ATL includes airport-to-campus and excludes community routes'
);
select ok(
  public.list_rides('other', null) @> '[{"origin":{"slug":"gt"},"destination":{"slug":"p-open-alpha160"}}]'
  and public.list_rides('other', null) @> '[{"origin":{"slug":"p-open-alpha160"},"destination":{"slug":"gt"}}]',
  'R-DEST-8 Other destinations includes both community route directions'
);
select ok(
  not (public.list_rides('other', null) @> '[{"destination":{"slug":"p-hidden160000"}}]'),
  'R-DEST-9 Other destinations excludes hidden destinations'
);
select ok(
  not public.list_open_places() @> '[{"slug":"p-hidden160000"}]',
  'R-DEST-9 hidden places stay closed even when a ride touches them'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"16000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.join_ride('16100000-0000-4000-8000-000000000008'::uuid)$$,
  'R-DEST-6 a ride touching a closed or hidden place remains joinable'
);

insert into public.places (slug, name, short_name, address, kind, sort, name_key)
select 'p-cap' || s::text, 'Cap Destination ' || s::text, 'Cap Destination ' || s::text,
       '', 'other', 100, app.place_key('Cap Destination ' || s::text)
from generate_series(1, 51) as s;
insert into public.rides (owner_id, origin, destination, departs_at, seats, status)
select '16000000-0000-4000-8000-000000000001', 'gt', p.slug,
       pg_catalog.now() + interval '10 days', 4, 'active'
from public.places as p where p.slug ~ '^p-cap[0-9]+$';
insert into public.ride_members (ride_id, user_id)
select r.id, '16000000-0000-4000-8000-000000000001'
from public.rides as r where r.destination ~ '^p-cap[0-9]+$';
select is(
  pg_catalog.jsonb_array_length(public.list_open_places()),
  50,
  'R-DEST-7 list_open_places returns at most 50 destinations'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"16000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
insert into public.places (slug, name, short_name, address, kind, sort, created_by, name_key)
values ('p-delete160000', 'Delete Venue', 'Delete Venue', '', 'other', 100, '16000000-0000-4000-8000-000000000003', app.place_key('Delete Venue'));
select lives_ok($$select public.delete_my_account()$$, 'R-DEST-10 account deletion succeeds with a created place');
select ok(
  (select created_by is null from public.places where slug = 'p-delete160000'),
  'R-DEST-10 deleting an account preserves its place and clears created_by'
);

select * from finish();
rollback;
