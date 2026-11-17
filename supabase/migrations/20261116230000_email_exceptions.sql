create table app.email_exceptions (
  email text primary key check (
    email = pg_catalog.lower(pg_catalog.btrim(email))
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  note text,
  created_at timestamptz not null default now()
);

alter table app.email_exceptions enable row level security;
revoke all on table app.email_exceptions from public, anon, authenticated;

create function app.is_allowed_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_email is not null
    and (
      pg_catalog.lower(pg_catalog.btrim(p_email))
        ~ '^[^@[:space:]]+@([a-z0-9-]+\.)*gatech\.edu$'
      or exists (
        select 1
        from app.email_exceptions as allowed_email
        where allowed_email.email =
          pg_catalog.lower(pg_catalog.btrim(p_email))
      )
    );
$$;

revoke all on function app.is_allowed_email(text)
  from public, anon, authenticated;
grant usage on schema app to supabase_auth_admin;
grant execute on function app.is_allowed_email(text) to supabase_auth_admin;

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  v_email := pg_catalog.lower(pg_catalog.btrim(event -> 'user' ->> 'email'));

  if v_email is not null
    and app.is_allowed_email(v_email)
  then
    return '{}'::jsonb;
  end if;

  return '{"error":{"http_code":403,"message":"Use your @gatech.edu email."}}'::jsonb;
end;
$$;

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

create or replace function public.upsert_my_profile(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_venmo text,
  p_gender text,
  p_show_phone boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_first_name text := pg_catalog.btrim(p_first_name);
  v_last_name text := pg_catalog.btrim(p_last_name);
  v_venmo text := nullif(pg_catalog.regexp_replace(pg_catalog.btrim(p_venmo), '^@', ''), '');
  v_show_phone boolean := coalesce(p_show_phone, true);
  v_gender public.gender;
  v_current_gender public.gender;
  v_profile public.profiles%rowtype;
  v_profile_exists boolean;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;
  if p_gender is not null then
    if p_gender not in ('man', 'woman', 'unspecified') then
      raise exception using errcode = 'P0001', message = 'invalid_gender';
    end if;
    v_gender := p_gender::public.gender;
  end if;

  select pg_catalog.lower(u.email) into v_email
  from auth.users as u where u.id = v_uid;
  if v_email is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;
  if not app.is_allowed_email(v_email) then
    raise exception using errcode = 'P0001', message = 'email_not_allowed';
  end if;
  if v_first_name is null or v_last_name is null or p_phone is null
    or (v_venmo is not null and v_venmo !~ '^[A-Za-z0-9_-]{5,30}$')
  then
    raise exception using errcode = 'P0001', message = 'invalid_profile';
  end if;

  select p.gender into v_current_gender
  from public.profiles as p where p.id = v_uid for update;
  v_profile_exists := found;

  perform r.id
  from public.ride_members as rm
  join public.rides as r on r.id = rm.ride_id
  where rm.user_id = v_uid
    and r.status = 'active'
    and r.departs_at > pg_catalog.now()
  order by r.id
  for update of r;

  if v_profile_exists and p_gender is null then
    v_gender := v_current_gender;
  end if;
  if v_profile_exists and v_current_gender is distinct from v_gender and exists (
    select 1 from public.ride_members as rm
    join public.rides as r on r.id = rm.ride_id
    where rm.user_id = v_uid and r.status = 'active'
      and r.departs_at > pg_catalog.now() and r.audience <> 'anyone'
  ) then
    raise exception using errcode = 'P0001', message = 'gender_locked';
  end if;

  insert into public.profiles (
    id, email, first_name, last_name, phone, venmo, gender, show_phone
  )
  values (
    v_uid, v_email, v_first_name, v_last_name, p_phone, v_venmo, v_gender, v_show_phone
  )
  on conflict (id) do update
  set email = excluded.email, first_name = excluded.first_name,
      last_name = excluded.last_name, phone = excluded.phone,
      venmo = excluded.venmo,
      gender = coalesce(excluded.gender, public.profiles.gender),
      show_phone = excluded.show_phone, updated_at = pg_catalog.now()
  returning * into v_profile;

  return pg_catalog.jsonb_build_object(
    'id', v_profile.id, 'email', v_profile.email,
    'first_name', v_profile.first_name, 'last_name', v_profile.last_name,
    'phone', v_profile.phone, 'venmo', v_profile.venmo,
    'gender', v_profile.gender, 'show_phone', v_profile.show_phone
  );
exception when check_violation then
  raise exception using errcode = 'P0001', message = 'invalid_profile';
end;
$$;

alter table public.profiles
  drop constraint profiles_email_check;

alter table public.profiles
  add constraint profiles_email_check
  check (email = lower(email) and app.is_allowed_email(email));
