create function app.normalized_place_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.btrim(
    pg_catalog.regexp_replace(
      normalize(p_name, NFC),
      '[[:space:]]+',
      ' ',
      'g'
    )
  )
$$;

create function app.place_key(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.btrim(
    pg_catalog.regexp_replace(
      pg_catalog.lower(app.normalized_place_name(p_name)),
      '[^[:alnum:]]+',
      ' ',
      'g'
    )
  )
$$;

revoke all on function app.normalized_place_name(text) from public, anon, authenticated;
revoke all on function app.place_key(text) from public, anon, authenticated;

alter table public.places
  add column created_by uuid references public.profiles(id) on delete set null,
  add column created_at timestamptz not null default pg_catalog.now(),
  add column hidden boolean not null default false,
  add column name_key text;

update public.places set name_key = app.place_key(name);
alter table public.places alter column name_key set not null;
create unique index places_name_key_key on public.places(name_key);

create index rides_origin_status_departs_at_idx
  on public.rides(origin, status, departs_at);
create index rides_destination_status_departs_at_idx
  on public.rides(destination, status, departs_at);

create function public.add_place(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_key text;
  v_slug text;
  v_existing_name text;
  v_hidden boolean;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  perform 1 from public.profiles as p where p.id = v_uid for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'profile_required';
  end if;

  v_name := app.normalized_place_name(p_name);
  if v_name is null
    or pg_catalog.char_length(v_name) not between 2 and 32
    or pg_catalog.char_length(pg_catalog.regexp_replace(v_name, '[^[:alpha:]]', '', 'g')) < 2
    or v_name ~ '[^[:alpha:][:digit:] .,''’&()/\-]'
    or v_name ~* '(@|://|www|[[:alpha:]]+\.[[:alpha:]]+)'
    or pg_catalog.char_length(pg_catalog.regexp_replace(v_name, '[^[:digit:]]', '', 'g')) > 4
    or v_name ~ '^[[:digit:]]{2,} '
  then
    raise exception using errcode = 'P0001', message = 'invalid_place_name';
  end if;
  v_key := app.place_key(v_name);

  if exists (
    select 1 from public.places as p
    where p.kind <> 'other'
      and (app.place_key(p.name) = v_key
        or app.place_key(p.short_name) = v_key)
  ) or v_key = any(array[
    'atl', 'airport', 'atl airport', 'atlanta airport', 'hartsfield',
    'hartsfield jackson', 'hartsfield jackson airport', 'gt', 'gatech',
    'georgia tech', 'campus', 'tech'
  ]::text[]) then
    raise exception using errcode = 'P0001', message = 'place_reserved';
  end if;

  select p.name, p.hidden into v_existing_name, v_hidden
  from public.places as p where p.name_key = v_key;
  if found then
    if v_hidden then
      raise exception using errcode = 'P0001', message = 'place_unavailable';
    end if;
    return pg_catalog.jsonb_build_object(
      'slug', (select p.slug from public.places as p where p.name_key = v_key),
      'name', v_existing_name,
      'created', false
    );
  end if;

  if (
    select pg_catalog.count(*) from public.places as p
    where p.created_by = v_uid
      and p.kind = 'other'
      and p.created_at > pg_catalog.now() - interval '7 days'
  ) >= 3 then
    raise exception using errcode = 'P0001', message = 'place_limit';
  end if;

  v_slug := 'p-' || pg_catalog.substr(
    pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 10
  );
  insert into public.places (
    slug, name, short_name, address, kind, sort, created_by, name_key
  )
  values (v_slug, v_name, v_name, '', 'other', 100, v_uid, v_key)
  on conflict (name_key) do nothing
  returning slug into v_slug;

  if v_slug is not null then
    return pg_catalog.jsonb_build_object(
      'slug', v_slug, 'name', v_name, 'created', true
    );
  end if;

  select p.slug, p.name, p.hidden
  into v_slug, v_existing_name, v_hidden
  from public.places as p where p.name_key = v_key;
  if v_hidden then
    raise exception using errcode = 'P0001', message = 'place_unavailable';
  end if;
  return pg_catalog.jsonb_build_object(
    'slug', v_slug, 'name', v_existing_name, 'created', false
  );
end;
$$;

create function public.list_open_places()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with place_demand as (
    select p.slug, p.name,
      pg_catalog.count(distinct r.id) filter (where r.departs_at > pg_catalog.now())::integer as upcoming,
      pg_catalog.count(distinct rm.user_id)::integer as riders
    from public.places as p
    join public.rides as r
      on (r.origin = p.slug or r.destination = p.slug)
     and r.status = 'active'
     and r.departs_at > pg_catalog.now() - interval '30 days'
    left join public.ride_members as rm on rm.ride_id = r.id
    where p.kind = 'other' and not p.hidden
    group by p.slug, p.name
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'slug', d.slug, 'name', d.name,
        'upcoming', d.upcoming, 'riders', d.riders
      )
      order by d.upcoming desc, d.riders desc, d.name
    ),
    '[]'::jsonb
  )
  from (select * from place_demand order by upcoming desc, riders desc, name limit 50) as d
$$;

create or replace function public.create_ride(
  p_origin text, p_destination text, p_departs_at timestamptz,
  p_seats integer, p_notes text, p_audience text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_gender public.gender;
  v_origin_kind public.place_kind;
  v_destination_kind public.place_kind;
  v_origin_hidden boolean;
  v_destination_hidden boolean;
  v_notes text := coalesce(pg_catalog.btrim(p_notes), '');
  v_owned_count bigint;
  v_ride_id uuid;
  v_audience public.ride_audience;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;
  select p.gender into v_gender from public.profiles as p where p.id = v_uid;
  if not found then
    raise exception using errcode = 'P0001', message = 'profile_required';
  end if;
  if p_audience is null or p_audience not in ('anyone', 'men', 'women') then
    raise exception using errcode = 'P0001', message = 'audience_not_allowed';
  end if;
  if p_audience <> 'anyone' and v_gender is null then
    raise exception using errcode = 'P0001', message = 'gender_required';
  end if;
  if p_audience <> 'anyone'
    and (v_gender = 'unspecified'
      or p_audience <> case when v_gender = 'man' then 'men' else 'women' end)
  then
    raise exception using errcode = 'P0001', message = 'audience_not_allowed';
  end if;
  v_audience := p_audience::public.ride_audience;

  select o.kind, d.kind, o.hidden, d.hidden
  into v_origin_kind, v_destination_kind, v_origin_hidden, v_destination_hidden
  from public.places as o cross join public.places as d
  where o.slug = p_origin and d.slug = p_destination;
  if not found then
    raise exception using errcode = 'P0001', message = 'invalid_route';
  end if;
  if v_origin_hidden or v_destination_hidden then
    raise exception using errcode = 'P0001', message = 'place_unavailable';
  end if;
  if p_origin = p_destination or not (
    (v_origin_kind = 'campus' and v_destination_kind in ('airport', 'other'))
    or (v_origin_kind in ('airport', 'other') and v_destination_kind = 'campus')
  ) then
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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text, 0));
  select pg_catalog.count(*) into v_owned_count from public.rides as r
  where r.owner_id = v_uid and r.status = 'active' and r.departs_at > pg_catalog.now();
  if v_owned_count >= 5 then
    raise exception using errcode = 'P0001', message = 'too_many_rides';
  end if;
  insert into public.rides (owner_id, origin, destination, departs_at, seats, notes, audience)
  values (v_uid, p_origin, p_destination, p_departs_at, p_seats, v_notes, v_audience)
  returning id into v_ride_id;
  insert into public.ride_members (ride_id, user_id) values (v_ride_id, v_uid);
  return v_ride_id;
end;
$$;

create or replace function public.list_rides(p_direction text, p_day date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_gender public.gender; v_result jsonb;
begin
  if p_direction not in ('airport', 'campus', 'other') or p_direction is null then
    raise exception using errcode = 'P0001', message = 'invalid_route';
  end if;
  if v_uid is not null then
    select p.gender into v_gender from public.profiles p where p.id = v_uid;
  end if;
  with data as (
    select r.id, r.departs_at, r.origin, op.short_name origin_short, r.destination,
      dp.short_name dest_short, r.seats, r.audience, count(rm.user_id)::int members,
      op.kind origin_kind, dp.kind dest_kind,
      (r.departs_at at time zone 'America/New_York')::date local_day,
      count(rm.user_id) >= r.seats is_full,
      owner.first_name || ' ' || pg_catalog.left(owner.last_name, 1) || '.' owner_name,
      bool_or(rm.user_id = v_uid) is_member,
      count(*) filter (where member.gender = 'man')::int men,
      count(*) filter (where member.gender = 'woman')::int women
    from public.rides r
    join public.places op on op.slug = r.origin
    join public.places dp on dp.slug = r.destination
    join public.profiles owner on owner.id = r.owner_id
    left join public.ride_members rm on rm.ride_id = r.id
    left join public.profiles member on member.id = rm.user_id
    where r.status = 'active' and r.departs_at > pg_catalog.now()
      and (p_day is null or (r.departs_at at time zone 'America/New_York')::date = p_day)
      and (v_uid is null or r.audience = 'anyone' or v_gender is null
        or (r.audience = 'men' and v_gender = 'man')
        or (r.audience = 'women' and v_gender = 'woman')
        or exists (select 1 from public.ride_members m where m.ride_id = r.id and m.user_id = v_uid))
      and (p_direction <> 'other'
        or ((op.kind <> 'other' or not op.hidden) and (dp.kind <> 'other' or not dp.hidden)))
    group by r.id, op.short_name, dp.short_name, op.kind, dp.kind, op.hidden, dp.hidden,
      owner.first_name, owner.last_name
    having (p_direction = 'airport' and op.kind = 'campus' and dp.kind = 'airport')
      or (p_direction = 'campus' and op.kind = 'airport' and dp.kind = 'campus')
      or (p_direction = 'other' and (op.kind = 'other' or dp.kind = 'other'))
    order by local_day, is_full, r.departs_at, r.id limit 200
  )
  select coalesce(jsonb_agg(
    jsonb_build_object('id', d.id, 'departs_at', d.departs_at, 'origin',
      jsonb_build_object('slug', d.origin, 'short_name', d.origin_short),
      'destination', jsonb_build_object('slug', d.destination, 'short_name', d.dest_short),
      'seats', d.seats, 'seats_left', d.seats - d.members, 'audience', d.audience)
      || case when v_uid is null then '{}'::jsonb else
        jsonb_build_object('owner_name', d.owner_name, 'is_member', coalesce(d.is_member,false))
        || case when d.audience = 'anyone' then jsonb_build_object('mix', jsonb_build_object('men', d.men, 'women', d.women)) else '{}'::jsonb end
      end order by d.local_day, d.is_full, d.departs_at, d.id), '[]'::jsonb)
  into v_result from data d;
  return v_result;
end;
$$;

revoke all on function public.add_place(text) from public, anon, authenticated;
revoke all on function public.list_open_places() from public, anon, authenticated;
revoke all on function public.create_ride(text,text,timestamptz,integer,text,text) from public, anon, authenticated;
revoke all on function public.list_rides(text,date) from public, anon, authenticated;
grant execute on function public.add_place(text) to authenticated;
grant execute on function public.list_open_places() to anon, authenticated;
grant execute on function public.create_ride(text,text,timestamptz,integer,text,text) to authenticated;
grant execute on function public.list_rides(text,date) to anon, authenticated;
