create type public.place_kind as enum ('campus', 'airport');
create type public.ride_status as enum ('active', 'cancelled');

create schema app;
revoke all on schema app from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, public;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, public;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

alter default privileges for role postgres in schema app
  revoke execute on functions from public;

create table public.places (
  slug text primary key,
  name text not null,
  short_name text not null,
  address text not null,
  kind public.place_kind not null,
  sort integer not null
);

insert into public.places (slug, name, short_name, address, kind, sort)
values
  ('gt', 'Georgia Tech', 'Campus', 'North Ave NW, Atlanta, GA 30332', 'campus', 1),
  ('atl-domestic', 'ATL Domestic Terminal', 'ATL Domestic', '6000 N Terminal Pkwy, Atlanta, GA 30320', 'airport', 2),
  ('atl-intl', 'ATL International Terminal', 'ATL Intl', '2600 Maynard H. Jackson Jr. Blvd, Atlanta, GA 30320', 'airport', 3);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique check (
    email = pg_catalog.lower(email)
    and email ~ '^[^@[:space:]]+@([a-z0-9-]+\.)*gatech\.edu$'
  ),
  first_name text not null check (
    first_name = pg_catalog.btrim(first_name)
    and pg_catalog.char_length(first_name) between 1 and 40
  ),
  last_name text not null check (
    last_name = pg_catalog.btrim(last_name)
    and pg_catalog.char_length(last_name) between 1 and 40
  ),
  phone text not null check (
    phone ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'
  ),
  venmo text check (
    venmo is null or venmo ~ '^[A-Za-z0-9_-]{5,30}$'
  ),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table public.rides (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  origin text not null references public.places (slug),
  destination text not null references public.places (slug),
  departs_at timestamptz not null,
  seats smallint not null check (seats between 2 and 6),
  notes text not null default '' check (pg_catalog.char_length(notes) <= 280),
  status public.ride_status not null default 'active',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check (origin <> destination)
);

create index rides_status_departs_at_idx
  on public.rides (status, departs_at);
create index rides_owner_id_idx
  on public.rides (owner_id);

create table public.ride_members (
  ride_id uuid not null references public.rides (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (ride_id, user_id)
);

create index ride_members_user_id_idx
  on public.ride_members (user_id);

alter table public.places enable row level security;
alter table public.profiles enable row level security;
alter table public.rides enable row level security;
alter table public.ride_members enable row level security;

create function app.leave_ride_as(p_uid uuid, p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride public.rides%rowtype;
  v_successor uuid;
begin
  select r.*
  into v_ride
  from public.rides as r
  where r.id = p_ride_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ride_not_found';
  end if;

  if v_ride.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'ride_not_active';
  end if;

  if v_ride.departs_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'ride_departed';
  end if;

  if not exists (
    select 1
    from public.ride_members as rm
    where rm.ride_id = p_ride_id
      and rm.user_id = p_uid
  ) then
    raise exception using errcode = 'P0001', message = 'not_member';
  end if;

  if v_ride.owner_id = p_uid then
    select rm.user_id
    into v_successor
    from public.ride_members as rm
    where rm.ride_id = p_ride_id
      and rm.user_id <> p_uid
    order by rm.joined_at, rm.user_id
    limit 1;

    if found then
      update public.rides
      set owner_id = v_successor,
          updated_at = pg_catalog.now()
      where id = p_ride_id;

      delete from public.ride_members
      where ride_id = p_ride_id
        and user_id = p_uid;
    else
      update public.rides
      set status = 'cancelled',
          updated_at = pg_catalog.now()
      where id = p_ride_id;
    end if;
  else
    delete from public.ride_members
    where ride_id = p_ride_id
      and user_id = p_uid;
  end if;
end;
$$;

create function public.hook_before_user_created(event jsonb)
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
    and v_email ~ '^[^@[:space:]]+@([a-z0-9-]+\.)*gatech\.edu$'
  then
    return '{}'::jsonb;
  end if;

  return '{"error":{"http_code":403,"message":"Use your @gatech.edu email."}}'::jsonb;
end;
$$;

create function public.get_my_profile()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  select p.*
  into v_profile
  from public.profiles as p
  where p.id = v_uid;

  if not found then
    return null;
  end if;

  return pg_catalog.jsonb_build_object(
    'id', v_profile.id,
    'email', v_profile.email,
    'first_name', v_profile.first_name,
    'last_name', v_profile.last_name,
    'phone', v_profile.phone,
    'venmo', v_profile.venmo
  );
end;
$$;

create function public.upsert_my_profile(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_venmo text
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
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  select pg_catalog.lower(u.email)
  into v_email
  from auth.users as u
  where u.id = v_uid;

  if v_email is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if v_email !~ '^[^@[:space:]]+@([a-z0-9-]+\.)*gatech\.edu$' then
    raise exception using errcode = 'P0001', message = 'email_not_allowed';
  end if;

  if v_first_name is null
    or v_last_name is null
    or p_phone is null
    or (v_venmo is not null and v_venmo !~ '^[A-Za-z0-9_-]{5,30}$')
  then
    raise exception using errcode = 'P0001', message = 'invalid_profile';
  end if;

  insert into public.profiles (id, email, first_name, last_name, phone, venmo)
  values (v_uid, v_email, v_first_name, v_last_name, p_phone, v_venmo)
  on conflict (id) do update
  set email = excluded.email,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      phone = excluded.phone,
      venmo = excluded.venmo,
      updated_at = pg_catalog.now()
  returning * into v_profile;

  return pg_catalog.jsonb_build_object(
    'id', v_profile.id,
    'email', v_profile.email,
    'first_name', v_profile.first_name,
    'last_name', v_profile.last_name,
    'phone', v_profile.phone,
    'venmo', v_profile.venmo
  );
exception
  when check_violation then
    raise exception using errcode = 'P0001', message = 'invalid_profile';
end;
$$;

create function public.create_ride(
  p_origin text,
  p_destination text,
  p_departs_at timestamptz,
  p_seats integer,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_origin_kind public.place_kind;
  v_destination_kind public.place_kind;
  v_notes text := coalesce(pg_catalog.btrim(p_notes), '');
  v_owned_count bigint;
  v_ride_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if not exists (
    select 1 from public.profiles as p where p.id = v_uid
  ) then
    raise exception using errcode = 'P0001', message = 'profile_required';
  end if;

  select origin_place.kind, destination_place.kind
  into v_origin_kind, v_destination_kind
  from public.places as origin_place
  cross join public.places as destination_place
  where origin_place.slug = p_origin
    and destination_place.slug = p_destination;

  if not found
    or p_origin = p_destination
    or not (
      (v_origin_kind = 'campus' and v_destination_kind = 'airport')
      or (v_origin_kind = 'airport' and v_destination_kind = 'campus')
    )
  then
    raise exception using errcode = 'P0001', message = 'invalid_route';
  end if;

  if p_departs_at is null
    or p_departs_at < pg_catalog.now() + interval '15 minutes'
    or p_departs_at > pg_catalog.now() + interval '120 days'
  then
    raise exception using errcode = 'P0001', message = 'invalid_time';
  end if;

  if p_seats is null or p_seats < 2 or p_seats > 6 then
    raise exception using errcode = 'P0001', message = 'invalid_seats';
  end if;

  if pg_catalog.char_length(v_notes) > 280 then
    raise exception using errcode = 'P0001', message = 'invalid_notes';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::text, 0)
  );

  select pg_catalog.count(*)
  into v_owned_count
  from public.rides as r
  where r.owner_id = v_uid
    and r.status = 'active'
    and r.departs_at > pg_catalog.now();

  if v_owned_count >= 5 then
    raise exception using errcode = 'P0001', message = 'too_many_rides';
  end if;

  insert into public.rides (owner_id, origin, destination, departs_at, seats, notes)
  values (v_uid, p_origin, p_destination, p_departs_at, p_seats, v_notes)
  returning id into v_ride_id;

  insert into public.ride_members (ride_id, user_id)
  values (v_ride_id, v_uid);

  return v_ride_id;
end;
$$;

create function public.update_ride(
  p_ride_id uuid,
  p_departs_at timestamptz,
  p_seats integer,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ride public.rides%rowtype;
  v_notes text := coalesce(pg_catalog.btrim(p_notes), '');
  v_member_count bigint;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  select r.*
  into v_ride
  from public.rides as r
  where r.id = p_ride_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ride_not_found';
  end if;

  if v_ride.owner_id <> v_uid then
    raise exception using errcode = 'P0001', message = 'not_owner';
  end if;

  if v_ride.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'ride_not_active';
  end if;

  if v_ride.departs_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'ride_departed';
  end if;

  if p_departs_at is null
    or p_departs_at < pg_catalog.now() + interval '15 minutes'
    or p_departs_at > pg_catalog.now() + interval '120 days'
  then
    raise exception using errcode = 'P0001', message = 'invalid_time';
  end if;

  if p_seats is null or p_seats < 2 or p_seats > 6 then
    raise exception using errcode = 'P0001', message = 'invalid_seats';
  end if;

  if pg_catalog.char_length(v_notes) > 280 then
    raise exception using errcode = 'P0001', message = 'invalid_notes';
  end if;

  select pg_catalog.count(*)
  into v_member_count
  from public.ride_members as rm
  where rm.ride_id = p_ride_id;

  if p_seats < v_member_count then
    raise exception using errcode = 'P0001', message = 'seats_below_members';
  end if;

  update public.rides
  set departs_at = p_departs_at,
      seats = p_seats::smallint,
      notes = v_notes,
      updated_at = pg_catalog.now()
  where id = p_ride_id;
end;
$$;

create function public.cancel_ride(p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ride public.rides%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  select r.*
  into v_ride
  from public.rides as r
  where r.id = p_ride_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ride_not_found';
  end if;

  if v_ride.owner_id <> v_uid then
    raise exception using errcode = 'P0001', message = 'not_owner';
  end if;

  if v_ride.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'ride_not_active';
  end if;

  if v_ride.departs_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'ride_departed';
  end if;

  update public.rides
  set status = 'cancelled',
      updated_at = pg_catalog.now()
  where id = p_ride_id;
end;
$$;

create function public.join_ride(p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ride public.rides%rowtype;
  v_member_count bigint;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if not exists (
    select 1 from public.profiles as p where p.id = v_uid
  ) then
    raise exception using errcode = 'P0001', message = 'profile_required';
  end if;

  select r.*
  into v_ride
  from public.rides as r
  where r.id = p_ride_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ride_not_found';
  end if;

  if v_ride.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'ride_not_active';
  end if;

  if v_ride.departs_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'ride_departed';
  end if;

  if exists (
    select 1
    from public.ride_members as rm
    where rm.ride_id = p_ride_id
      and rm.user_id = v_uid
  ) then
    raise exception using errcode = 'P0001', message = 'already_member';
  end if;

  select pg_catalog.count(*)
  into v_member_count
  from public.ride_members as rm
  where rm.ride_id = p_ride_id;

  if v_member_count >= v_ride.seats then
    raise exception using errcode = 'P0001', message = 'ride_full';
  end if;

  insert into public.ride_members (ride_id, user_id)
  values (p_ride_id, v_uid);
end;
$$;

create function public.leave_ride(p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  perform app.leave_ride_as(v_uid, p_ride_id);
end;
$$;

create function public.list_rides(p_direction text, p_day date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if p_direction not in ('airport', 'campus') or p_direction is null then
    raise exception using errcode = 'P0001', message = 'invalid_route';
  end if;

  with ride_data as (
    select
      r.id,
      r.departs_at,
      r.origin,
      origin_place.short_name as origin_short_name,
      r.destination,
      destination_place.short_name as destination_short_name,
      r.seats,
      pg_catalog.count(rm.user_id)::integer as member_count,
      origin_place.kind as origin_kind,
      destination_place.kind as destination_kind,
      (r.departs_at at time zone 'America/New_York')::date as local_day,
      pg_catalog.count(rm.user_id) >= r.seats as is_full,
      owner.first_name || ' ' || pg_catalog.left(owner.last_name, 1) || '.' as owner_name,
      pg_catalog.bool_or(rm.user_id = v_uid) as is_member
    from public.rides as r
    join public.places as origin_place on origin_place.slug = r.origin
    join public.places as destination_place on destination_place.slug = r.destination
    join public.profiles as owner on owner.id = r.owner_id
    left join public.ride_members as rm on rm.ride_id = r.id
    where r.status = 'active'
      and r.departs_at > pg_catalog.now()
      and (p_day is null or (r.departs_at at time zone 'America/New_York')::date = p_day)
    group by r.id, origin_place.short_name, destination_place.short_name,
      origin_place.kind, destination_place.kind, owner.first_name, owner.last_name
    having (
      (p_direction = 'airport' and destination_place.kind = 'airport')
      or (p_direction = 'campus' and destination_place.kind = 'campus')
    )
    order by local_day, is_full, r.departs_at, r.id
    limit 200
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', d.id,
        'departs_at', d.departs_at,
        'origin', pg_catalog.jsonb_build_object(
          'slug', d.origin,
          'short_name', d.origin_short_name
        ),
        'destination', pg_catalog.jsonb_build_object(
          'slug', d.destination,
          'short_name', d.destination_short_name
        ),
        'seats', d.seats,
        'seats_left', d.seats - d.member_count
      )
      || case
        when v_uid is null then '{}'::jsonb
        else pg_catalog.jsonb_build_object(
          'owner_name', d.owner_name,
          'is_member', coalesce(d.is_member, false)
        )
      end
      order by d.local_day, d.is_full, d.departs_at, d.id
    ),
    '[]'::jsonb
  )
  into v_result
  from ride_data as d;

  return v_result;
end;
$$;

create function public.find_similar_rides(
  p_origin text,
  p_destination text,
  p_departs_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  with ride_data as (
    select
      r.id,
      r.departs_at,
      r.origin,
      origin_place.short_name as origin_short_name,
      r.destination,
      destination_place.short_name as destination_short_name,
      r.seats,
      pg_catalog.count(rm.user_id)::integer as member_count,
      owner.first_name || ' ' || pg_catalog.left(owner.last_name, 1) || '.' as owner_name,
      pg_catalog.abs(pg_catalog.date_part('epoch', r.departs_at - p_departs_at)) as time_distance
    from public.rides as r
    join public.places as origin_place on origin_place.slug = r.origin
    join public.places as destination_place on destination_place.slug = r.destination
    join public.profiles as owner on owner.id = r.owner_id
    left join public.ride_members as rm on rm.ride_id = r.id
    where r.status = 'active'
      and r.departs_at > pg_catalog.now()
      and r.origin = p_origin
      and r.destination = p_destination
      and pg_catalog.abs(pg_catalog.date_part('epoch', r.departs_at - p_departs_at)) <= 5400
    group by r.id, origin_place.short_name, destination_place.short_name,
      owner.first_name, owner.last_name
    having pg_catalog.count(rm.user_id) < r.seats
      and not pg_catalog.bool_or(rm.user_id = v_uid)
    order by time_distance, r.id
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', d.id,
        'departs_at', d.departs_at,
        'origin', pg_catalog.jsonb_build_object(
          'slug', d.origin,
          'short_name', d.origin_short_name
        ),
        'destination', pg_catalog.jsonb_build_object(
          'slug', d.destination,
          'short_name', d.destination_short_name
        ),
        'seats', d.seats,
        'seats_left', d.seats - d.member_count,
        'owner_name', d.owner_name,
        'is_member', false
      )
      order by d.time_distance, d.id
    ),
    '[]'::jsonb
  )
  into v_result
  from ride_data as d;

  return v_result;
end;
$$;

create function public.get_ride(p_ride_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ride record;
  v_is_member boolean := false;
  v_is_past boolean;
  v_members jsonb;
  v_result jsonb;
begin
  select
    r.id,
    r.owner_id,
    r.departs_at,
    r.status,
    r.seats,
    r.notes,
    r.origin,
    origin_place.name as origin_name,
    origin_place.short_name as origin_short_name,
    origin_place.address as origin_address,
    r.destination,
    destination_place.name as destination_name,
    destination_place.short_name as destination_short_name,
    destination_place.address as destination_address,
    pg_catalog.count(rm.user_id)::integer as member_count
  into v_ride
  from public.rides as r
  join public.places as origin_place on origin_place.slug = r.origin
  join public.places as destination_place on destination_place.slug = r.destination
  left join public.ride_members as rm on rm.ride_id = r.id
  where r.id = p_ride_id
  group by r.id, origin_place.name, origin_place.short_name, origin_place.address,
    destination_place.name, destination_place.short_name, destination_place.address;

  if not found then
    return null;
  end if;

  if v_uid is not null then
    select exists (
      select 1
      from public.ride_members as rm
      where rm.ride_id = p_ride_id
        and rm.user_id = v_uid
    )
    into v_is_member;
  end if;

  v_is_past := v_ride.departs_at <= pg_catalog.now();

  if (v_ride.status <> 'active' or v_is_past) and not v_is_member then
    return null;
  end if;

  v_result := pg_catalog.jsonb_build_object(
    'id', v_ride.id,
    'departs_at', v_ride.departs_at,
    'status', v_ride.status,
    'is_past', v_is_past,
    'seats', v_ride.seats,
    'seats_left', v_ride.seats - v_ride.member_count,
    'origin', pg_catalog.jsonb_build_object(
      'slug', v_ride.origin,
      'name', v_ride.origin_name,
      'short_name', v_ride.origin_short_name,
      'address', v_ride.origin_address
    ),
    'destination', pg_catalog.jsonb_build_object(
      'slug', v_ride.destination,
      'name', v_ride.destination_name,
      'short_name', v_ride.destination_short_name,
      'address', v_ride.destination_address
    )
  );

  if v_uid is not null then
    if v_is_member then
      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'name', p.first_name || ' ' || p.last_name,
            'first_name', p.first_name,
            'last_name', p.last_name,
            'phone', p.phone,
            'venmo', p.venmo,
            'email', p.email,
            'is_owner', rm.user_id = v_ride.owner_id,
            'is_viewer', rm.user_id = v_uid
          )
          order by (rm.user_id = v_ride.owner_id) desc, rm.joined_at, rm.user_id
        ),
        '[]'::jsonb
      )
      into v_members
      from public.ride_members as rm
      join public.profiles as p on p.id = rm.user_id
      where rm.ride_id = p_ride_id;
    else
      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'name', p.first_name || ' ' || pg_catalog.left(p.last_name, 1) || '.',
            'is_owner', rm.user_id = v_ride.owner_id
          )
          order by (rm.user_id = v_ride.owner_id) desc, rm.joined_at, rm.user_id
        ),
        '[]'::jsonb
      )
      into v_members
      from public.ride_members as rm
      join public.profiles as p on p.id = rm.user_id
      where rm.ride_id = p_ride_id;
    end if;

    v_result := v_result || pg_catalog.jsonb_build_object(
      'notes', v_ride.notes,
      'viewer_is_member', v_is_member,
      'viewer_is_owner', v_ride.owner_id = v_uid,
      'members', v_members
    );
  end if;

  return v_result;
end;
$$;

create function public.my_rides()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  with ride_data as (
    select
      r.id,
      r.departs_at,
      r.origin,
      origin_place.short_name as origin_short_name,
      r.destination,
      destination_place.short_name as destination_short_name,
      r.seats,
      r.status,
      r.owner_id,
      pg_catalog.count(rm.user_id)::integer as member_count,
      owner.first_name || ' ' || pg_catalog.left(owner.last_name, 1) || '.' as owner_name,
      (r.departs_at <= pg_catalog.now()) as is_past
    from public.ride_members as viewer_membership
    join public.rides as r on r.id = viewer_membership.ride_id
    join public.places as origin_place on origin_place.slug = r.origin
    join public.places as destination_place on destination_place.slug = r.destination
    join public.profiles as owner on owner.id = r.owner_id
    left join public.ride_members as rm on rm.ride_id = r.id
    where viewer_membership.user_id = v_uid
    group by r.id, origin_place.short_name, destination_place.short_name,
      owner.first_name, owner.last_name
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', d.id,
        'departs_at', d.departs_at,
        'origin', pg_catalog.jsonb_build_object(
          'slug', d.origin,
          'short_name', d.origin_short_name
        ),
        'destination', pg_catalog.jsonb_build_object(
          'slug', d.destination,
          'short_name', d.destination_short_name
        ),
        'seats', d.seats,
        'seats_left', d.seats - d.member_count,
        'owner_name', d.owner_name,
        'is_member', true,
        'status', d.status,
        'is_past', d.is_past,
        'is_owner', d.owner_id = v_uid
      )
      order by d.departs_at desc, d.id
    ),
    '[]'::jsonb
  )
  into v_result
  from ride_data as d;

  return v_result;
end;
$$;

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ride_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  for v_ride_id in
    select r.id
    from public.rides as r
    join public.ride_members as rm on rm.ride_id = r.id
    where rm.user_id = v_uid
      and r.status = 'active'
      and r.departs_at > pg_catalog.now()
    order by r.id
  loop
    perform app.leave_ride_as(v_uid, v_ride_id);
  end loop;

  delete from auth.users
  where id = v_uid;
end;
$$;

revoke all on all tables in schema public from anon, authenticated, public;
revoke all on all sequences in schema public from anon, authenticated, public;
revoke execute on function app.leave_ride_as(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
revoke execute on function public.get_my_profile() from public, anon, authenticated;
revoke execute on function public.upsert_my_profile(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.create_ride(text, text, timestamptz, integer, text) from public, anon, authenticated;
revoke execute on function public.update_ride(uuid, timestamptz, integer, text) from public, anon, authenticated;
revoke execute on function public.cancel_ride(uuid) from public, anon, authenticated;
revoke execute on function public.join_ride(uuid) from public, anon, authenticated;
revoke execute on function public.leave_ride(uuid) from public, anon, authenticated;
revoke execute on function public.list_rides(text, date) from public, anon, authenticated;
revoke execute on function public.find_similar_rides(text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.get_ride(uuid) from public, anon, authenticated;
revoke execute on function public.my_rides() from public, anon, authenticated;
revoke execute on function public.delete_my_account() from public, anon, authenticated;

grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.upsert_my_profile(text, text, text, text) to authenticated;
grant execute on function public.create_ride(text, text, timestamptz, integer, text) to authenticated;
grant execute on function public.update_ride(uuid, timestamptz, integer, text) to authenticated;
grant execute on function public.cancel_ride(uuid) to authenticated;
grant execute on function public.join_ride(uuid) to authenticated;
grant execute on function public.leave_ride(uuid) to authenticated;
grant execute on function public.list_rides(text, date) to anon, authenticated;
grant execute on function public.find_similar_rides(text, text, timestamptz) to authenticated;
grant execute on function public.get_ride(uuid) to anon, authenticated;
grant execute on function public.my_rides() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
