begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('16100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'edge-owner@gatech.edu', '', pg_catalog.now()),
  ('16100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'edge-man@gatech.edu', '', pg_catalog.now()),
  ('16100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'edge-woman@gatech.edu', '', pg_catalog.now()),
  ('16100000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'edge-creator@gatech.edu', '', pg_catalog.now()),
  ('16100000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'edge-viewer@gatech.edu', '', pg_catalog.now());

insert into public.profiles (id, email, first_name, last_name, phone, gender)
values
  ('16100000-0000-4000-8000-000000000001', 'edge-owner@gatech.edu', 'Edge', 'Owner', '+14045550101', 'woman'),
  ('16100000-0000-4000-8000-000000000002', 'edge-man@gatech.edu', 'Edge', 'Man', '+14045550102', 'man'),
  ('16100000-0000-4000-8000-000000000003', 'edge-woman@gatech.edu', 'Edge', 'Woman', '+14045550103', 'woman'),
  ('16100000-0000-4000-8000-000000000004', 'edge-creator@gatech.edu', 'Edge', 'Creator', '+14045550104', 'woman'),
  ('16100000-0000-4000-8000-000000000005', 'edge-viewer@gatech.edu', 'Edge', 'Viewer', '+14045550105', 'woman');

select ok(
  not pg_catalog.has_function_privilege('anon', 'public.add_place(text)', 'execute'),
  'R-DEST-10 anon cannot execute add_place'
);
select ok(
  not pg_catalog.has_table_privilege('anon', 'public.places', 'select')
  and not pg_catalog.has_table_privilege('anon', 'public.places', 'insert')
  and not pg_catalog.has_table_privilege('anon', 'public.places', 'update')
  and not pg_catalog.has_table_privilege('authenticated', 'public.places', 'select')
  and not pg_catalog.has_table_privilege('authenticated', 'public.places', 'insert')
  and not pg_catalog.has_table_privilege('authenticated', 'public.places', 'update'),
  'R-DEST-10 anon and authenticated cannot access public.places directly'
);

set local role anon;
select throws_ok(
  $$select public.add_place('Unauthenticated Venue')$$,
  '42501',
  'permission denied for function add_place',
  'R-DEST-10 anon add_place invocation is denied'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok($$select public.add_place('Athens 🎉')$$, 'P0001', 'invalid_place_name', 'R-DEST-3 rejects emoji');
select throws_ok($$select public.add_place(U&'athens\200Bville')$$, 'P0001', 'invalid_place_name', 'R-DEST-3 rejects zero-width space');
select throws_ok($$select public.add_place(U&'athens\200Dville')$$, 'P0001', 'invalid_place_name', 'R-DEST-3 rejects zero-width joiner');
select throws_ok($$select public.add_place('   ')$$, 'P0001', 'invalid_place_name', 'R-DEST-3 rejects whitespace-only names');
select throws_ok($$select public.add_place(null)$$, 'P0001', 'invalid_place_name', 'R-DEST-3 rejects NULL names');
select throws_ok($$select public.add_place(pg_catalog.repeat('a', 33))$$, 'P0001', 'invalid_place_name', 'R-DEST-3 rejects 33 characters after normalization');
select throws_ok($$select public.add_place('St.Louis')$$, 'P0001', 'invalid_place_name', 'R-DEST-3 rejects a domain-shaped city name without a space');
select throws_ok($$select public.add_place('athens.ga')$$, 'P0001', 'invalid_place_name', 'R-DEST-3 rejects a domain-like destination');
select throws_ok(
  $$select public.add_place($name$'; drop table places;--$name$)$$,
  'P0001',
  'invalid_place_name',
  'R-DEST-3 rejects SQL-looking punctuation without executing it'
);

create temporary table edge_places (
  label text primary key,
  slug text not null
);

insert into edge_places
select 'sao', public.add_place('São Paulo')->>'slug';
insert into edge_places
select 'moscow', public.add_place('Москва')->>'slug';
insert into edge_places
select 'cairo', public.add_place('القاهرة')->>'slug';
select ok((select slug like 'p-%' from edge_places where label = 'sao'), 'R-DEST-3 accepts accented Latin letters');
select ok((select slug like 'p-%' from edge_places where label = 'moscow'), 'R-DEST-3 accepts Cyrillic letters');
select ok((select slug like 'p-%' from edge_places where label = 'cairo'), 'R-DEST-3 accepts Arabic letters');

select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
insert into edge_places
select 'auburn', public.add_place('Sweet Auburn (MLK)')->>'slug';
insert into edge_places
select 'six-austell', public.add_place('Six Flags / Austell')->>'slug';
insert into edge_places
select 'six-flags', public.add_place('Six Flags')->>'slug';
select ok((select slug like 'p-%' from edge_places where label = 'auburn'), 'R-DEST-3 accepts parentheses and hyphens');
select ok((select slug like 'p-%' from edge_places where label = 'six-austell'), 'R-DEST-3 accepts slash punctuation');

select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
insert into edge_places
select 'cafe-first', public.add_place(U&'Caf\00E9')->>'slug';
select is(
  public.add_place(U&'Cafe\0301')->>'slug',
  (select slug from edge_places where label = 'cafe-first'),
  'R-DEST-3 composed and decomposed Café reuse the same place'
);
select is(
  (public.add_place(U&'Cafe\0301')->>'created')::boolean,
  false,
  'R-DEST-3 the second NFC form is a reuse, not a creation'
);
insert into edge_places
select 'long-name',
  public.add_place(pg_catalog.repeat('a', 15) || '     ' || pg_catalog.repeat('b', 16))->>'slug';
select is(
  (select p.name from public.places p join edge_places e on e.slug = p.slug where e.label = 'long-name'),
  pg_catalog.repeat('a', 15) || ' ' || pg_catalog.repeat('b', 16),
  'R-DEST-3 a normalized 32-character name collapses internal whitespace'
);
select is(
  (select pg_catalog.char_length(p.name) from public.places p join edge_places e on e.slug = p.slug where e.label = 'long-name'),
  32,
  'R-DEST-3 normalized name length is checked after whitespace collapse'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
insert into edge_places
select 'closed', public.add_place('Closed Edge')->>'slug';
insert into public.rides (id, owner_id, origin, destination, departs_at, seats, status)
values
  ('16200000-0000-4000-8000-000000000001', '16100000-0000-4000-8000-000000000001', 'gt',
   (select slug from edge_places where label = 'closed'), pg_catalog.now() - interval '31 days', 4, 'active');
insert into public.ride_members (ride_id, user_id)
values ('16200000-0000-4000-8000-000000000001', '16100000-0000-4000-8000-000000000001');
select ok(
  not public.list_open_places() @> pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('slug', (select slug from edge_places where label = 'closed'))
  ),
  'R-DEST-5 a destination with only 31-day-old rides is closed'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
create temporary table closed_ride (id uuid);
insert into closed_ride
select public.create_ride(
  'gt',
  (select slug from edge_places where label = 'closed'),
  pg_catalog.now() + interval '2 hours',
  4,
  '',
  'anyone'
);
select ok(
  public.list_open_places() @> pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('slug', (select slug from edge_places where label = 'closed'))
  ),
  'R-DEST-6 creating a new ride reopens a closed destination'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.join_ride((select id from closed_ride))$$,
  'R-DEST-6 an upcoming ride on a formerly closed destination can be joined'
);
select lives_ok(
  $$select public.leave_ride((select id from closed_ride))$$,
  'R-DEST-6 a member can leave the community ride'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.update_ride((select id from closed_ride), pg_catalog.now() + interval '3 hours', 4, 'Updated community route', 'anyone')$$,
  'R-DEST-6 the owner can update a community ride'
);
select lives_ok(
  $$select public.cancel_ride((select id from closed_ride))$$,
  'R-DEST-6 the owner can cancel a community ride'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);
insert into edge_places
select 'hidden', public.add_place('Hidden Edge')->>'slug';
update public.places set hidden = true where slug = (select slug from edge_places where label = 'hidden');
insert into public.rides (id, owner_id, origin, destination, departs_at, seats, status)
values
  ('16200000-0000-4000-8000-000000000002', '16100000-0000-4000-8000-000000000004', 'gt',
   (select slug from edge_places where label = 'hidden'), pg_catalog.now() + interval '3 days', 4, 'active');
insert into public.ride_members (ride_id, user_id)
values ('16200000-0000-4000-8000-000000000002', '16100000-0000-4000-8000-000000000004');
select is(
  public.get_ride('16200000-0000-4000-8000-000000000002'::uuid)->>'id',
  '16200000-0000-4000-8000-000000000002',
  'R-DEST-9 a member can still get a ride on a hidden destination'
);
select ok(
  not public.list_rides('other', null) @> '[{"id":"16200000-0000-4000-8000-000000000002"}]'::jsonb
  and not public.list_open_places() @> pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('slug', (select slug from edge_places where label = 'hidden'))
  ),
  'R-DEST-9 hidden community rides and places are omitted from discovery'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000005","role":"authenticated"}',
  true
);
select ok(
  not public.find_similar_rides(
    'gt',
    (select slug from edge_places where label = 'hidden'),
    pg_catalog.now() + interval '3 days'
  ) @> '[{"id":"16200000-0000-4000-8000-000000000002"}]'::jsonb,
  'R-DEST-9 find_similar_rides does not leak hidden community routes'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
create temporary table restricted_ride (id uuid);
insert into restricted_ride
select public.create_ride(
  'gt',
  (select slug from edge_places where label = 'six-flags'),
  pg_catalog.now() + interval '10 days',
  4,
  '',
  'women'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.join_ride((select id from restricted_ride))$$,
  'P0001',
  'audience_restricted',
  'R-DEST-8 a man cannot join a women-only community ride'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.join_ride((select id from restricted_ride))$$,
  'R-DEST-8 a woman can join a women-only community ride'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
create temporary table similar_ride (id uuid);
insert into similar_ride
select public.create_ride(
  'gt',
  (select slug from edge_places where label = 'six-flags'),
  pg_catalog.now() + interval '10 days 20 minutes',
  4,
  '',
  'anyone'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select ok(
  public.find_similar_rides(
    'gt',
    (select slug from edge_places where label = 'six-flags'),
    pg_catalog.now() + interval '10 days 80 minutes'
  ) @> pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('id', (select id from similar_ride))
  ),
  'R-DEST-8 find_similar_rides matches the same community route within 90 minutes'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);
insert into edge_places
select 'creator-place', public.add_place('Creator Keep')->>'slug';
select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
create temporary table retained_ride (id uuid);
insert into retained_ride
select public.create_ride(
  'gt',
  (select slug from edge_places where label = 'creator-place'),
  pg_catalog.now() + interval '12 days',
  4,
  '',
  'anyone'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.join_ride((select id from retained_ride))$$,
  'R-DEST-10 another rider can join a destination creator ride'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);
select lives_ok($$select public.delete_my_account()$$, 'R-DEST-10 deleting a place creator succeeds');
select ok(
  (select created_by is null from public.places where slug = (select slug from edge_places where label = 'creator-place'))
  and exists (select 1 from public.rides where id = (select id from retained_ride) and status = 'active')
  and exists (select 1 from public.ride_members where ride_id = (select id from retained_ride) and user_id = '16100000-0000-4000-8000-000000000002'),
  'R-DEST-10 deleting a place creator preserves the place and other riders rides'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
create temporary table reminder_ride (id uuid);
insert into reminder_ride
select public.create_ride(
  'gt',
  (select slug from edge_places where label = 'six-flags'),
  pg_catalog.now() + interval '2 hours',
  4,
  '',
  'anyone'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"16100000-0000-4000-8000-000000000005","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.join_ride((select id from reminder_ride))$$,
  'R-DEST-10 a member can join a community ride eligible for reminders'
);
select is(
  public.enqueue_ride_reminders(),
  2,
  'R-DEST-10 reminders enqueue for both riders on a community route'
);
create temporary table community_claim (data jsonb);
insert into community_claim select public.claim_notifications(100);
select ok(
  exists (
    select 1
    from community_claim,
      lateral pg_catalog.jsonb_array_elements(data) as claimed(item)
    where item->'ride'->>'id' = (select id::text from reminder_ride)
      and item->'ride'->>'origin_short_name' = 'Campus'
      and item->'ride'->>'destination_short_name' = 'Six Flags'
      and item->>'kind' in ('member_joined', 'ride_reminder')
  ),
  'R-DEST-10 claimed notification payload uses community place short names'
);
select is(
  (select pg_catalog.count(*)::integer
   from community_claim,
     lateral pg_catalog.jsonb_array_elements(data) as claimed(item)
   where item->'ride'->>'id' = (select id::text from reminder_ride)
     and item->>'kind' = 'ride_reminder'),
  2,
  'R-DEST-10 reminder claims include community route place names'
);

select * from finish();
rollback;
