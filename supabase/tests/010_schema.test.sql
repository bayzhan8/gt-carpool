begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

select has_table('public', 'places', 'R-PLACE-1 curated places table exists');
select has_table('public', 'profiles', 'R-AUTH-4 profiles table exists');
select has_table('public', 'rides', 'R-RIDE-1 rides table exists');
select has_table('public', 'ride_members', 'R-JOIN-1 membership table exists');
select is(
  (select t.typtype::text from pg_catalog.pg_type as t where t.oid = 'public.place_kind'::regtype),
  'e',
  'R-PLACE-2 place kind is an enum'
);
select is(
  (select t.typtype::text from pg_catalog.pg_type as t where t.oid = 'public.ride_status'::regtype),
  'e',
  'R-CANCEL-1 ride status is an enum'
);
select is(
  (select pg_catalog.array_agg(p.slug order by p.sort) from public.places as p),
  array['gt', 'atl-domestic', 'atl-intl']::text[],
  'R-PLACE-1 curated place seed is present in order'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '10000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'schema@gatech.edu',
  '',
  pg_catalog.now()
);

insert into public.profiles (id, email, first_name, last_name, phone, venmo)
values (
  '10000000-0000-4000-8000-000000000001',
  'schema@gatech.edu',
  'Schema',
  'Tester',
  '+14045550123',
  'schema_user'
);
update public.profiles set gender = 'brother' where gender is null;

select throws_ok(
  $$update public.profiles set email = 'SCHEMA@gatech.edu'
    where id = '10000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'R-AUTH-3 profile email must be lowercase'
);
select throws_ok(
  $$update public.profiles set email = 'schema@gatech.edu.evil.com'
    where id = '10000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'R-AUTH-2 profile email domain must be gatech.edu'
);
select throws_ok(
  $$update public.profiles set first_name = ' A'
    where id = '10000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'R-PROF-1 profile first name must be trimmed'
);
select throws_ok(
  $$update public.profiles set last_name = pg_catalog.repeat('B', 41)
    where id = '10000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'R-PROF-1 profile name length is constrained'
);
select throws_ok(
  $$update public.profiles set phone = '404-555-0123'
    where id = '10000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'R-PROF-1 phone is stored as US E.164'
);
select throws_ok(
  $$update public.profiles set venmo = '@bad'
    where id = '10000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'R-PROF-1 Venmo handle has the required format'
);
select throws_ok(
  $$insert into public.rides (owner_id, origin, destination, departs_at, seats)
    values ('10000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 1)$$,
  '23514',
  null,
  'R-RIDE-1 ride seat count has a minimum of two'
);
select throws_ok(
  $$insert into public.rides (owner_id, origin, destination, departs_at, seats)
    values ('10000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 7)$$,
  '23514',
  null,
  'R-RIDE-1 ride seat count has a maximum of six'
);
select throws_ok(
  $$insert into public.rides (owner_id, origin, destination, departs_at, seats, notes)
    values ('10000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 4, pg_catalog.repeat('x', 281))$$,
  '23514',
  null,
  'R-RIDE-3 ride notes are limited to 280 characters'
);
select throws_ok(
  $$insert into public.rides (owner_id, origin, destination, departs_at, seats)
    values ('10000000-0000-4000-8000-000000000001', 'gt', 'gt', pg_catalog.now() + interval '1 day', 4)$$,
  '23514',
  null,
  'R-PLACE-2 ride endpoints must differ'
);

select * from finish();

rollback;
