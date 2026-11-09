begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

select has_type('public', 'gender', 'R-COMFORT-1 gender enum exists');
select has_type('public', 'ride_audience', 'R-COMFORT-2 audience enum exists');
select has_column('public', 'profiles', 'gender', 'R-COMFORT-1 profiles include gender');
select has_column('public', 'rides', 'audience', 'R-COMFORT-2 rides include audience');
select is(
  pg_catalog.pg_get_expr(d.adbin, d.adrelid),
  '''anyone''::ride_audience',
  'R-COMFORT-2 SQL audience default remains anyone'
)
from pg_catalog.pg_attrdef d
join pg_catalog.pg_class c on c.oid = d.adrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'rides'
  and d.adnum = (select a.attnum from pg_catalog.pg_attribute a
    where a.attrelid = c.oid and a.attname = 'audience');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('cc000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'woman@gatech.edu', '', now()),
  ('cc000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'man@gatech.edu', '', now()),
  ('cc000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'woman2@gatech.edu', '', now()),
  ('cc000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'incomplete@gatech.edu', '', now()),
  ('cc000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'unspecified@gatech.edu', '', now());

insert into public.profiles (id, email, first_name, last_name, phone, gender)
values
  ('cc000000-0000-4000-8000-000000000001', 'woman@gatech.edu', 'Morgan', 'Owner', '+14045550123', 'woman'),
  ('cc000000-0000-4000-8000-000000000002', 'man@gatech.edu', 'Alex', 'Viewer', '+14045550124', 'man'),
  ('cc000000-0000-4000-8000-000000000003', 'woman2@gatech.edu', 'Casey', 'Member', '+14045550125', 'woman'),
  ('cc000000-0000-4000-8000-000000000004', 'incomplete@gatech.edu', 'Incomplete', 'Profile', '+14045550126', null),
  ('cc000000-0000-4000-8000-000000000005', 'unspecified@gatech.edu', 'Unspecified', 'Profile', '+14045550127', 'unspecified');

insert into public.rides (id, owner_id, origin, destination, departs_at, seats, audience)
values
  ('cc100000-0000-4000-8000-000000000001', 'cc000000-0000-4000-8000-000000000001',
   'gt', 'atl-domestic', now() + interval '1 day', 4, 'women'),
  ('cc100000-0000-4000-8000-000000000002', 'cc000000-0000-4000-8000-000000000001',
   'gt', 'atl-domestic', now() + interval '2 days', 4, 'anyone');

insert into public.ride_members (ride_id, user_id)
values
  ('cc100000-0000-4000-8000-000000000001', 'cc000000-0000-4000-8000-000000000001'),
  ('cc100000-0000-4000-8000-000000000002', 'cc000000-0000-4000-8000-000000000001'),
  ('cc100000-0000-4000-8000-000000000002', 'cc000000-0000-4000-8000-000000000003'),
  ('cc100000-0000-4000-8000-000000000002', 'cc000000-0000-4000-8000-000000000002'),
  ('cc100000-0000-4000-8000-000000000002', 'cc000000-0000-4000-8000-000000000005');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cc000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$select public.upsert_my_profile('Morgan','Owner','+14045550123',null,'other')$$,
  'P0001', 'invalid_gender',
  'R-COMFORT-1 invalid gender raises invalid_gender'
);
select throws_ok(
  $$select public.create_ride('gt','atl-domestic',now()+interval '2 days',4,'','men')$$,
  'P0001', 'audience_not_allowed',
  'R-COMFORT-2 owner cannot create the other group audience'
);
select throws_ok(
  $$select public.update_ride('cc100000-0000-4000-8000-000000000001',now()+interval '1 day',4,'','men')$$,
  'P0001', 'audience_not_allowed',
  'R-COMFORT-4 owner cannot edit a ride to the other group audience'
);
select throws_ok(
  $$select public.update_ride('cc100000-0000-4000-8000-000000000002',now()+interval '2 days',4,'','women')$$,
  'P0001', 'audience_members_mismatch',
  'R-COMFORT-4 restricted edit rejects a mismatched current member'
);
select ok(
  not (public.find_similar_rides(
    'gt', 'atl-domestic', now() + interval '1 day'
  ) @> '[{"id":"cc100000-0000-4000-8000-000000000001"}]'::jsonb),
  'R-COMFORT-5 similar-ride results hide restricted rides from non-matching viewers'
);
select public.update_ride(
  'cc100000-0000-4000-8000-000000000001', now()+interval '1 day', 4, '', 'women'
);
select is(
  public.get_ride('cc100000-0000-4000-8000-000000000001')->>'audience',
  'women',
  'R-COMFORT-4 edit succeeds when all members match'
);
select is(
  public.get_ride('cc100000-0000-4000-8000-000000000002')->'mix',
  '{"men":1,"women":2}'::jsonb,
  'R-COMFORT-6 signed-in viewer receives mix counts while unspecified members are omitted'
);
select is(
  public.get_ride('cc100000-0000-4000-8000-000000000001')->>'viewer_can_join_audience',
  'true',
  'R-COMFORT-5 matching viewer can join a restricted ride'
);
select ok(
  not (public.get_ride('cc100000-0000-4000-8000-000000000001') ? 'mix'),
  'R-COMFORT-6 restricted rides do not include a member mix'
);
select ok(
  public.list_rides('airport', null) @> '[{"id":"cc100000-0000-4000-8000-000000000001"}]'::jsonb,
  'R-COMFORT-5 matching viewer sees a restricted ride in browse'
);

select set_config('request.jwt.claims',
  '{"sub":"cc000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select ok(
  public.find_similar_rides('gt','atl-domestic',now()+interval '1 day')
    @> '[{"id":"cc100000-0000-4000-8000-000000000001"}]'::jsonb,
  'R-COMFORT-5 matching non-member sees a restricted similar ride'
);

select set_config('request.jwt.claims',
  '{"sub":"cc000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select ok(
  not (public.list_rides('airport', null) @> '[{"id":"cc100000-0000-4000-8000-000000000001"}]'::jsonb),
  'R-COMFORT-5 non-matching non-member cannot browse a restricted ride'
);
select is(
  public.get_ride('cc100000-0000-4000-8000-000000000001')->>'viewer_can_join_audience',
  'false',
  'R-COMFORT-5 direct link reports that non-matching viewer cannot join'
);
select throws_ok(
  $$select public.join_ride('cc100000-0000-4000-8000-000000000001')$$,
  'P0001', 'audience_restricted',
  'R-COMFORT-3 locked join rejects a non-matching gender'
);

reset role;
insert into public.ride_members (ride_id, user_id)
values ('cc100000-0000-4000-8000-000000000001', 'cc000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cc000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select ok(
  public.list_rides('airport', null) @> '[{"id":"cc100000-0000-4000-8000-000000000001"}]'::jsonb,
  'R-COMFORT-5 non-matching existing member can still browse the ride'
);
select throws_ok(
  $$select public.upsert_my_profile('Alex','Viewer','+14045550124',null,'woman')$$,
  'P0001', 'gender_locked',
  'R-COMFORT-1 gender change is locked in an upcoming restricted ride'
);

select set_config('request.jwt.claims', '{}', true);
select ok(
  public.list_rides('airport', null) @> '[{"id":"cc100000-0000-4000-8000-000000000001"}]'::jsonb,
  'R-COMFORT-5 anonymous browse includes restricted rides'
);
select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.list_rides('airport', null)) as rides(item)
    where item ? 'mix'
  ),
  'R-COMFORT-6 anonymous browse never includes a mix'
);
select ok(
  not (public.get_ride('cc100000-0000-4000-8000-000000000002') ? 'mix'),
  'R-COMFORT-6 anonymous viewer receives no mix'
);

select set_config('request.jwt.claims',
  '{"sub":"cc000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is(
  public.upsert_my_profile('Casey','Member','+14045550125',null,'man')->>'gender',
  'man',
  'R-COMFORT-1 gender can change while the user belongs only to an anyone ride'
);

select set_config('request.jwt.claims',
  '{"sub":"cc000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select throws_ok(
  $$select public.create_ride('gt','atl-domestic',now()+interval '2 days',4,'','anyone')$$,
  'P0001', 'profile_required',
  'R-COMFORT-1 incomplete profile without gender cannot create a ride'
);
select throws_ok(
  $$select public.join_ride('cc100000-0000-4000-8000-000000000002')$$,
  'P0001', 'profile_required',
  'R-COMFORT-1 incomplete profile without gender cannot join a ride'
);

select set_config('request.jwt.claims',
  '{"sub":"cc000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select is(
  public.upsert_my_profile('Unspecified','Profile','+14045550127',null,'unspecified')->>'gender',
  'unspecified',
  'R-COMFORT-1 unspecified gender is a valid profile value'
);
select lives_ok(
  $$select public.create_ride('gt','atl-domestic',now()+interval '2 days',4,'','anyone')$$,
  'R-COMFORT-2 unspecified user can create an anyone ride'
);
select throws_ok(
  $$select public.create_ride('gt','atl-domestic',now()+interval '3 days',4,'','women')$$,
  'P0001', 'audience_not_allowed',
  'R-COMFORT-2 unspecified user cannot create a women-only ride'
);
select throws_ok(
  $$select public.join_ride('cc100000-0000-4000-8000-000000000001')$$,
  'P0001', 'audience_restricted',
  'R-COMFORT-3 unspecified user cannot join a gender-restricted ride'
);

select * from finish();
rollback;
