begin;

create extension if not exists pgtap with schema extensions;

select plan(33);

select ok(
  (select c.relrowsecurity
   from pg_catalog.pg_class as c
   where c.oid = 'app.email_exceptions'::regclass),
  'R-AUTH-2 email exceptions has row-level security enabled'
);
select is(
  (select pg_catalog.count(*)::integer
   from pg_catalog.pg_policy as p
   where p.polrelid = 'app.email_exceptions'::regclass),
  0,
  'R-AUTH-2 email exceptions has no RLS policies'
);
select ok(
  not pg_catalog.has_table_privilege('anon', 'app.email_exceptions', 'SELECT'),
  'R-AUTH-2 anon cannot select email exceptions'
);
select ok(
  not pg_catalog.has_table_privilege('anon', 'app.email_exceptions', 'INSERT'),
  'R-AUTH-2 anon cannot insert email exceptions'
);
select ok(
  not pg_catalog.has_table_privilege('anon', 'app.email_exceptions', 'DELETE'),
  'R-AUTH-2 anon cannot delete email exceptions'
);
select ok(
  not pg_catalog.has_table_privilege('authenticated', 'app.email_exceptions', 'SELECT'),
  'R-AUTH-2 authenticated cannot select email exceptions'
);
select ok(
  not pg_catalog.has_table_privilege('authenticated', 'app.email_exceptions', 'INSERT'),
  'R-AUTH-2 authenticated cannot insert email exceptions'
);
select ok(
  not pg_catalog.has_table_privilege('authenticated', 'app.email_exceptions', 'DELETE'),
  'R-AUTH-2 authenticated cannot delete email exceptions'
);
select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'app.is_allowed_email(text)'::regprocedure,
    'EXECUTE'
  ),
  'R-AUTH-2 anon cannot execute the allowlist helper'
);
select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'app.is_allowed_email(text)'::regprocedure,
    'EXECUTE'
  ),
  'R-AUTH-2 authenticated cannot execute the allowlist helper'
);
select ok(
  pg_catalog.has_function_privilege(
    'supabase_auth_admin',
    'app.is_allowed_email(text)'::regprocedure,
    'EXECUTE'
  ),
  'R-AUTH-2 Supabase Auth admin can execute the allowlist helper'
);
select ok(
  not pg_catalog.has_schema_privilege('anon', 'app', 'USAGE'),
  'R-AUTH-2 anon lacks usage on the internal app schema'
);
select ok(
  not pg_catalog.has_schema_privilege('authenticated', 'app', 'USAGE'),
  'R-AUTH-2 authenticated lacks usage on the internal app schema'
);
select ok(
  pg_catalog.has_schema_privilege('supabase_auth_admin', 'app', 'USAGE'),
  'R-AUTH-2 Supabase Auth admin has usage on the internal app schema'
);
select is(
  app.is_allowed_email(null),
  false,
  'R-AUTH-2 the allowlist helper rejects null'
);
select is(
  app.is_allowed_email('someone@gmail.com'),
  false,
  'R-AUTH-2 the allowlist helper rejects a non-GT address'
);
select is(
  app.is_allowed_email('x@gatech.edu.evil.com'),
  false,
  'R-AUTH-2 the allowlist helper rejects a look-alike domain'
);

select throws_ok(
  $$insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
    values ('21000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
      'someone@gmail.com', '', pg_catalog.now())$$,
  '23514',
  'email_not_allowed',
  'R-AUTH-2 auth trigger rejects a non-GT insert'
);
select throws_ok(
  $$insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
    values ('21000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
      'x@gatech.edu.evil.com', '', pg_catalog.now())$$,
  '23514',
  'email_not_allowed',
  'R-AUTH-2 auth trigger rejects a look-alike domain insert'
);
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '21000000-0000-4000-8000-000000000003',
  'authenticated',
  'authenticated',
  'trigger@gatech.edu',
  '',
  pg_catalog.now()
);
select throws_ok(
  $$update auth.users
    set email_change = 'someone@gmail.com'
    where id = '21000000-0000-4000-8000-000000000003'$$,
  '23514',
  'email_not_allowed',
  'R-AUTH-2 auth trigger rejects a non-GT email change'
);

create or replace function app.enforce_gatech_auth_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  return new;
end;
$$;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '21000000-0000-4000-8000-000000000004',
  'authenticated',
  'authenticated',
  'someone@gmail.com',
  '',
  pg_catalog.now()
);

create or replace function app.enforce_gatech_auth_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null
    and not app.is_allowed_email(new.email)
  then
    raise exception using errcode = '23514', message = 'email_not_allowed';
  end if;

  if new.email_change is not null
    and new.email_change <> ''
    and not app.is_allowed_email(new.email_change)
  then
    raise exception using errcode = '23514', message = 'email_not_allowed';
  end if;

  return new;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"21000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.upsert_my_profile('Guest', 'Rider', '+14045550123', null, null)$$,
  'P0001',
  'email_not_allowed',
  'R-AUTH-2 profile upsert rejects a non-GT address'
);
reset role;
select throws_ok(
  $$insert into public.profiles (id, email, first_name, last_name, phone)
    values ('21000000-0000-4000-8000-000000000004',
      'someone@gmail.com', 'Guest', 'Rider', '+14045550123')$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_email_check"',
  'R-AUTH-2 profiles email constraint rejects a non-GT address'
);
select throws_ok(
  $$insert into public.profiles (id, email, first_name, last_name, phone)
    values ('21000000-0000-4000-8000-000000000004',
      'x@gatech.edu.evil.com', 'Guest', 'Rider', '+14045550123')$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_email_check"',
  'R-AUTH-2 profiles email constraint rejects a look-alike domain'
);

insert into app.email_exceptions (email, note)
values ('guest.rider@example.com', 'test exception');

select is(
  app.is_allowed_email('guest.rider@example.com'),
  true,
  'R-AUTH-2 the allowlist helper accepts the test exception'
);
select is(
  app.is_allowed_email('Guest.Rider@Example.com'),
  true,
  'R-AUTH-2 the allowlist helper accepts uppercase input'
);
select is(
  app.is_allowed_email(' Guest.Rider@Example.com '),
  true,
  'R-AUTH-2 the allowlist helper trims input'
);

insert into auth.users (id, aud, role, email, email_change, encrypted_password, email_confirmed_at)
values (
  '21000000-0000-4000-8000-000000000005',
  'authenticated',
  'authenticated',
  ' Guest.Rider@EXAMPLE.com ',
  null,
  '',
  pg_catalog.now()
);
select lives_ok(
  $$update auth.users
    set email_change = 'Guest.Rider@Example.com'
    where id = '21000000-0000-4000-8000-000000000005'$$,
  'R-AUTH-2 auth trigger accepts an uppercase exception email change'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"21000000-0000-4000-8000-000000000005","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  public.upsert_my_profile('Guest', 'Rider', '+14045550123', null, null) ->> 'email',
  ' guest.rider@example.com ',
  'R-AUTH-2 profile upsert accepts uppercase and whitespace exception input'
);
reset role;
select lives_ok(
  $$update public.profiles
    set email = ' guest.rider@example.com '
    where id = '21000000-0000-4000-8000-000000000005'$$,
  'R-AUTH-2 profiles email constraint accepts a normalized exception address'
);

delete from app.email_exceptions
where email = 'guest.rider@example.com';

select is(
  app.is_allowed_email('guest.rider@example.com'),
  false,
  'R-AUTH-2 the allowlist helper rejects the address after its row is removed'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"21000000-0000-4000-8000-000000000005","role":"authenticated"}',
  true
);
select throws_ok(
  $$update auth.users
    set email_change = 'guest.rider@example.com'
    where id = '21000000-0000-4000-8000-000000000005'$$,
  '23514',
  'email_not_allowed',
  'R-AUTH-2 auth trigger rejects the exception after its row is removed'
);
set local role authenticated;
select throws_ok(
  $$select public.upsert_my_profile('Guest', 'Rider', '+14045550123', null, null)$$,
  'P0001',
  'email_not_allowed',
  'R-AUTH-2 profile upsert rejects the exception after its row is removed'
);
reset role;
select throws_ok(
  $$update public.profiles
    set email = ' guest.rider@example.com '
    where id = '21000000-0000-4000-8000-000000000005'$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_email_check"',
  'R-AUTH-2 profiles email constraint rejects the exception after its row is removed'
);

select * from finish();

rollback;
