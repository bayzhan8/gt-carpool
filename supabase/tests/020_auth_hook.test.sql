begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select is(
  public.hook_before_user_created('{"user":{"email":"name@gatech.edu"}}'::jsonb),
  '{}'::jsonb,
  'R-AUTH-2 hook accepts gatech.edu'
);
select is(
  public.hook_before_user_created('{"user":{"email":"Name@GATECH.EDU "}}'::jsonb),
  '{}'::jsonb,
  'R-AUTH-2 hook trims and lowercases before checking'
);
select is(
  public.hook_before_user_created('{"user":{"email":"name@cc.gatech.edu"}}'::jsonb),
  '{}'::jsonb,
  'R-AUTH-2 hook accepts a gatech subdomain'
);
select is(
  public.hook_before_user_created('{"user":{"email":"name@a.cc.gatech.edu"}}'::jsonb),
  '{}'::jsonb,
  'R-AUTH-2 hook accepts nested gatech subdomains'
);
select is(
  public.hook_before_user_created('{"user":{"email":"x@gatech.edu.evil.com"}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  'R-AUTH-2 hook rejects a suffix attack'
);
select is(
  public.hook_before_user_created('{"user":{"email":"x@evilgatech.edu"}}'::jsonb) -> 'error' ->> 'message',
  'Use your @gatech.edu email.',
  'R-AUTH-2 hook returns the required rejection message'
);
select is(
  public.hook_before_user_created('{"user":{"email":"a@b@gatech.edu"}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  'R-AUTH-2 hook rejects multiple at signs'
);
select is(
  public.hook_before_user_created('{"user":{"email":"@gatech.edu"}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  'R-AUTH-2 hook rejects an empty local part'
);
select is(
  public.hook_before_user_created('{"user":{"email":"name with space@gatech.edu"}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  'R-AUTH-2 hook rejects whitespace in the local part'
);
select is(
  public.hook_before_user_created('{"user":{"email":"x@.gatech.edu"}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  'R-AUTH-2 hook rejects an empty subdomain label'
);
select is(
  public.hook_before_user_created('{"user":{"email":"x@gatech.edu."}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  'R-AUTH-2 hook rejects a trailing domain dot'
);
select is(
  public.hook_before_user_created('{"user":{"email":"name@sub_domain.gatech.edu"}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  'R-AUTH-2 hook rejects underscores in domain labels'
);

select * from finish();

rollback;
