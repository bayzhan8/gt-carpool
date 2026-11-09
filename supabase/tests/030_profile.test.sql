begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('30000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'Name@GATECH.EDU', '', pg_catalog.now()),
  ('30000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'empty@gatech.edu', '', pg_catalog.now()),
  ('30000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'person@gmail.com', '', pg_catalog.now());

set local role authenticated;
select set_config('request.jwt.claims', '{}', true);

select throws_ok(
  $$select public.get_my_profile()$$,
  'P0001',
  'not_authenticated',
  'R-AUTH-4 profile lookup requires authentication'
);
select throws_ok(
  $$select public.upsert_my_profile('A', 'B', '+14045550123', null)$$,
  'P0001',
  'not_authenticated',
  'R-AUTH-4 profile upsert requires authentication'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select is(
  public.get_my_profile(),
  null::jsonb,
  'R-AUTH-4 user without a complete profile has no profile row'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select is(
  public.upsert_my_profile('  Name ', ' Person  ', '+14045550123', ' @my_handle '),
  pg_catalog.jsonb_build_object(
    'id', '30000000-0000-4000-8000-000000000001'::uuid,
    'email', 'name@gatech.edu',
    'first_name', 'Name',
    'last_name', 'Person',
    'phone', '+14045550123',
    'venmo', 'my_handle'
  ),
  'R-PROF-1 profile upsert trims names and Venmo and copies normalized auth email'
);
select is(
  public.get_my_profile(),
  pg_catalog.jsonb_build_object(
    'id', '30000000-0000-4000-8000-000000000001'::uuid,
    'email', 'name@gatech.edu',
    'first_name', 'Name',
    'last_name', 'Person',
    'phone', '+14045550123',
    'venmo', 'my_handle'
  ),
  'R-AUTH-4 complete profile lookup returns only the viewer profile'
);
select throws_ok(
  $$select public.upsert_my_profile('   ', 'Person', '+14045550123', null)$$,
  'P0001',
  'invalid_profile',
  'R-PROF-1 blank names raise invalid_profile'
);
select throws_ok(
  $$select public.upsert_my_profile('Name', 'Person', '404-555-0123', null)$$,
  'P0001',
  'invalid_profile',
  'R-PROF-1 non-E.164 phone raises invalid_profile'
);
select throws_ok(
  $$select public.upsert_my_profile('Name', 'Person', '+14045550123', '@bad')$$,
  'P0001',
  'invalid_profile',
  'R-PROF-1 invalid Venmo raises invalid_profile'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.upsert_my_profile('Person', 'Outside', '+14045550123', null)$$,
  'P0001',
  'email_not_allowed',
  'R-AUTH-2 non-GT auth email raises email_not_allowed'
);

select * from finish();

rollback;
