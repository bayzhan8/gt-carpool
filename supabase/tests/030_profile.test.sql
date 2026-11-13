begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('30000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'Name@GATECH.EDU', '', pg_catalog.now()),
  ('30000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'empty@gatech.edu', '', pg_catalog.now());

set local role authenticated;
select set_config('request.jwt.claims', '{}', true);

select throws_ok(
  $$select public.get_my_profile()$$,
  'P0001',
  'not_authenticated',
  'R-AUTH-4 profile lookup requires authentication'
);
select throws_ok(
  $$select public.upsert_my_profile('A', 'B', '+14045550123', null, 'man')$$,
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
select is(
  public.upsert_my_profile(
    'Empty', 'Profile', '+14045550123', null, null
  ) -> 'gender',
  'null'::jsonb,
  'R-PROF-1 a new profile can be saved without gender'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select is(
  public.upsert_my_profile(
    p_first_name => '  Name ',
    p_last_name => ' Person  ',
    p_phone => '+14045550123',
    p_venmo => ' @my_handle ',
    p_gender => 'man'
  ),
  pg_catalog.jsonb_build_object(
    'id', '30000000-0000-4000-8000-000000000001'::uuid,
    'email', 'name@gatech.edu',
    'first_name', 'Name',
    'last_name', 'Person',
    'phone', '+14045550123',
    'venmo', 'my_handle',
    'gender', 'man',
    'show_phone', true
  ),
  'R-PROF-1 five-argument named profile upsert trims fields and defaults show_phone to true'
);
select is(
  public.get_my_profile(),
  pg_catalog.jsonb_build_object(
    'id', '30000000-0000-4000-8000-000000000001'::uuid,
    'email', 'name@gatech.edu',
    'first_name', 'Name',
    'last_name', 'Person',
    'phone', '+14045550123',
    'venmo', 'my_handle',
    'gender', 'man',
    'show_phone', true
  ),
  'R-AUTH-4 complete profile lookup returns only the viewer profile'
);
select is(
  public.upsert_my_profile(
    p_first_name => 'Name',
    p_last_name => 'Person',
    p_phone => '+14045550123',
    p_venmo => null,
    p_gender => null
  ) ->> 'gender',
  'man',
  'R-PROF-1 null gender keeps the current gender on profile update'
);
select is(
  public.upsert_my_profile(
    'Name', 'Person', '+14045550123', null, 'man', false
  ) -> 'show_phone',
  'false'::jsonb,
  'R-PROF-1 six-argument profile upsert can hide the phone number'
);
select throws_ok(
  $$select public.upsert_my_profile('   ', 'Person', '+14045550123', null, 'man')$$,
  'P0001',
  'invalid_profile',
  'R-PROF-1 blank names raise invalid_profile'
);
select throws_ok(
  $$select public.upsert_my_profile('Name', '   ', '+14045550123', null, 'man')$$,
  'P0001',
  'invalid_profile',
  'R-PROF-1 whitespace-only last names raise invalid_profile'
);
select throws_ok(
  $$select public.upsert_my_profile(pg_catalog.repeat('A', 41), 'Person', '+14045550123', null, 'man')$$,
  'P0001',
  'invalid_profile',
  'R-PROF-1 names longer than 40 characters raise invalid_profile'
);
select throws_ok(
  $$select public.upsert_my_profile('Name', 'Person', '404-555-0123', null, 'man')$$,
  'P0001',
  'invalid_profile',
  'R-PROF-1 non-E.164 phone raises invalid_profile'
);
select throws_ok(
  $$select public.upsert_my_profile('Name', 'Person', '+14045550123', '@bad', 'man')$$,
  'P0001',
  'invalid_profile',
  'R-PROF-1 invalid Venmo raises invalid_profile'
);
select throws_ok(
  $$select public.upsert_my_profile('Name', 'Person', '+14045550123', null, 'other')$$,
  'P0001',
  'invalid_gender',
  'R-PROF-1 non-null gender remains validated'
);

reset role;

select throws_ok(
  $$insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
    values ('30000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
      'person@gmail.com', '', pg_catalog.now())$$,
  '23514',
  'email_not_allowed',
  'R-AUTH-2 non-GT auth email is rejected on insert'
);

select * from finish();

rollback;
