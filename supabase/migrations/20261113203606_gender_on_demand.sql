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
  if v_email !~ '^[^@[:space:]]+@([a-z0-9-]+\.)*gatech\.edu$' then
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

create function public.set_gender(p_gender text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_gender public.gender;
  v_current_gender public.gender;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  select p.gender into v_current_gender
  from public.profiles as p where p.id = v_uid for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'profile_required';
  end if;
  if p_gender is null or p_gender not in ('man', 'woman', 'unspecified') then
    raise exception using errcode = 'P0001', message = 'invalid_gender';
  end if;
  v_gender := p_gender::public.gender;

  perform r.id
  from public.ride_members as rm
  join public.rides as r on r.id = rm.ride_id
  where rm.user_id = v_uid
    and r.status = 'active'
    and r.departs_at > pg_catalog.now()
  order by r.id
  for update of r;

  if v_current_gender is distinct from v_gender and exists (
    select 1 from public.ride_members as rm
    join public.rides as r on r.id = rm.ride_id
    where rm.user_id = v_uid and r.status = 'active'
      and r.departs_at > pg_catalog.now() and r.audience <> 'anyone'
  ) then
    raise exception using errcode = 'P0001', message = 'gender_locked';
  end if;

  update public.profiles
  set gender = v_gender, updated_at = pg_catalog.now()
  where id = v_uid;
  return v_gender::text;
end;
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

  select o.kind, d.kind into v_origin_kind, v_destination_kind
  from public.places as o cross join public.places as d
  where o.slug = p_origin and d.slug = p_destination;
  if not found or p_origin = p_destination or not (
    (v_origin_kind = 'campus' and v_destination_kind = 'airport')
    or (v_origin_kind = 'airport' and v_destination_kind = 'campus')
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

create or replace function public.join_ride(p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ride public.rides%rowtype;
  v_member_count bigint;
  v_gender public.gender;
begin
  if v_uid is null then raise exception using errcode = 'P0001', message = 'not_authenticated'; end if;
  select r.* into v_ride from public.rides as r where r.id = p_ride_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'ride_not_found'; end if;
  if v_ride.status <> 'active' then raise exception using errcode = 'P0001', message = 'ride_not_active'; end if;
  if v_ride.departs_at <= pg_catalog.now() then raise exception using errcode = 'P0001', message = 'ride_departed'; end if;
  select p.gender into v_gender from public.profiles as p
  where p.id = v_uid for share;
  if not found then raise exception using errcode = 'P0001', message = 'profile_required'; end if;
  if v_ride.audience <> 'anyone' and v_gender is null then
    raise exception using errcode = 'P0001', message = 'gender_required';
  end if;
  if (v_ride.audience = 'men' and v_gender <> 'man')
    or (v_ride.audience = 'women' and v_gender <> 'woman')
  then raise exception using errcode = 'P0001', message = 'audience_restricted'; end if;
  if exists (select 1 from public.ride_members as rm where rm.ride_id = p_ride_id and rm.user_id = v_uid)
  then raise exception using errcode = 'P0001', message = 'already_member'; end if;
  select pg_catalog.count(*) into v_member_count from public.ride_members as rm where rm.ride_id = p_ride_id;
  if v_member_count >= v_ride.seats then raise exception using errcode = 'P0001', message = 'ride_full'; end if;
  insert into public.ride_members (ride_id, user_id) values (p_ride_id, v_uid);
  insert into public.notifications (recipient_id, ride_id, kind, actor_name)
  select v_ride.owner_id, p_ride_id, 'member_joined',
    pg_catalog.concat(p.first_name, ' ', pg_catalog.left(p.last_name, 1), '.')
  from public.profiles as p where p.id = v_uid;
end;
$$;

create or replace function public.update_ride(
  p_ride_id uuid, p_departs_at timestamptz, p_seats integer,
  p_notes text, p_audience text
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
  v_gender public.gender;
  v_audience public.ride_audience;
begin
  if v_uid is null then raise exception using errcode = 'P0001', message = 'not_authenticated'; end if;
  select r.* into v_ride from public.rides as r where r.id = p_ride_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'ride_not_found'; end if;
  if v_ride.owner_id <> v_uid then raise exception using errcode = 'P0001', message = 'not_owner'; end if;
  if v_ride.status <> 'active' then raise exception using errcode = 'P0001', message = 'ride_not_active'; end if;
  if v_ride.departs_at <= pg_catalog.now() then raise exception using errcode = 'P0001', message = 'ride_departed'; end if;

  perform p.id
  from public.ride_members as rm
  join public.profiles as p on p.id = rm.user_id
  where rm.ride_id = p_ride_id
  order by p.id
  for share of p;
  select p.gender into v_gender from public.profiles as p where p.id = v_uid;
  if not found then raise exception using errcode = 'P0001', message = 'profile_required'; end if;

  if p_departs_at is distinct from v_ride.departs_at
    and (
      p_departs_at is null
      or p_departs_at < pg_catalog.now() + interval '15 minutes'
      or p_departs_at > pg_catalog.now() + interval '120 days'
    )
  then raise exception using errcode = 'P0001', message = 'invalid_time'; end if;
  if p_seats is null or p_seats < 2 or p_seats > 6
  then raise exception using errcode = 'P0001', message = 'invalid_seats'; end if;
  if pg_catalog.char_length(v_notes) > 280
  then raise exception using errcode = 'P0001', message = 'invalid_notes'; end if;
  if p_audience is null or p_audience not in ('anyone', 'men', 'women')
  then raise exception using errcode = 'P0001', message = 'audience_not_allowed'; end if;
  if p_audience <> 'anyone' and v_gender is null
  then raise exception using errcode = 'P0001', message = 'gender_required'; end if;
  if p_audience <> 'anyone'
    and (v_gender = 'unspecified'
      or p_audience <> case when v_gender = 'man' then 'men' else 'women' end)
  then raise exception using errcode = 'P0001', message = 'audience_not_allowed'; end if;
  v_audience := p_audience::public.ride_audience;
  if v_audience <> 'anyone' and exists (
    select 1 from public.ride_members as rm join public.profiles as p on p.id = rm.user_id
    where rm.ride_id = p_ride_id
      and ((v_audience = 'men' and p.gender is distinct from 'man'::public.gender)
        or (v_audience = 'women' and p.gender is distinct from 'woman'::public.gender))
  ) then raise exception using errcode = 'P0001', message = 'audience_members_mismatch'; end if;
  select pg_catalog.count(*) into v_member_count from public.ride_members as rm where rm.ride_id = p_ride_id;
  if p_seats < v_member_count then
    raise exception using errcode = 'P0001', message = 'seats_below_members';
  end if;
  update public.rides set departs_at = p_departs_at, seats = p_seats::smallint,
    notes = v_notes, audience = v_audience, updated_at = pg_catalog.now()
  where id = p_ride_id;
  if p_departs_at is distinct from v_ride.departs_at then
    insert into public.notifications (recipient_id, ride_id, kind, actor_name, payload)
    select rm.user_id, p_ride_id, 'time_changed',
      pg_catalog.concat(p.first_name, ' ', pg_catalog.left(p.last_name, 1), '.'),
      pg_catalog.jsonb_build_object('old_departs_at', v_ride.departs_at, 'new_departs_at', p_departs_at)
    from public.ride_members as rm join public.profiles as p on p.id = v_uid
    where rm.ride_id = p_ride_id and rm.user_id <> v_uid;
  end if;
end;
$$;

create or replace function public.list_rides(p_direction text, p_day date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_gender public.gender; v_result jsonb;
begin
  if p_direction not in ('airport', 'campus') or p_direction is null then
    raise exception using errcode = 'P0001', message = 'invalid_route';
  end if;
  if v_uid is not null then select p.gender into v_gender from public.profiles p where p.id = v_uid; end if;
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
    group by r.id, op.short_name, dp.short_name, op.kind, dp.kind, owner.first_name, owner.last_name
    having (p_direction = 'airport' and dp.kind = 'airport')
      or (p_direction = 'campus' and dp.kind = 'campus')
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

create or replace function public.find_similar_rides(p_origin text, p_destination text, p_departs_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_gender public.gender; v_result jsonb;
begin
  if v_uid is null then raise exception using errcode = 'P0001', message = 'not_authenticated'; end if;
  select p.gender into v_gender from public.profiles p where p.id = v_uid;
  with data as (
    select r.id, r.departs_at, r.origin, op.short_name origin_short, r.destination,
      dp.short_name dest_short, r.seats, r.audience, count(rm.user_id)::int members,
      owner.first_name || ' ' || pg_catalog.left(owner.last_name,1) || '.' owner_name,
      abs(date_part('epoch', r.departs_at - p_departs_at)) time_distance,
      count(*) filter (where member.gender = 'man')::int men,
      count(*) filter (where member.gender = 'woman')::int women
    from public.rides r join public.places op on op.slug = r.origin
    join public.places dp on dp.slug = r.destination
    join public.profiles owner on owner.id = r.owner_id
    left join public.ride_members rm on rm.ride_id = r.id
    left join public.profiles member on member.id = rm.user_id
    where r.status='active' and r.departs_at > now() and r.origin=p_origin
      and r.destination=p_destination and abs(date_part('epoch',r.departs_at-p_departs_at))<=5400
      and (r.audience='anyone' or v_gender is null
        or (r.audience='men' and v_gender='man')
        or (r.audience='women' and v_gender='woman')
        or exists(select 1 from public.ride_members m where m.ride_id=r.id and m.user_id=v_uid))
    group by r.id, op.short_name, dp.short_name, owner.first_name, owner.last_name
    having count(rm.user_id)<r.seats and not bool_or(rm.user_id=v_uid)
    order by time_distance,r.id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'departs_at',d.departs_at,
    'origin',jsonb_build_object('slug',d.origin,'short_name',d.origin_short),
    'destination',jsonb_build_object('slug',d.destination,'short_name',d.dest_short),
    'seats',d.seats,'seats_left',d.seats-d.members,'owner_name',d.owner_name,
    'is_member',false,'audience',d.audience)
    || case when d.audience='anyone' then jsonb_build_object('mix',jsonb_build_object('men',d.men,'women',d.women)) else '{}'::jsonb end
    order by d.time_distance,d.id),'[]'::jsonb)
  into v_result from data d;
  return v_result;
end;
$$;

create or replace function public.get_ride(p_ride_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_gender public.gender; v_ride record;
  v_is_member boolean := false; v_is_past boolean; v_members jsonb;
  v_mix jsonb; v_can_join boolean := false; v_profile_exists boolean := false; v_result jsonb;
begin
  if v_uid is not null then
    select p.gender into v_gender from public.profiles p where p.id=v_uid;
    v_profile_exists := found;
  end if;
  select r.id,r.owner_id,r.departs_at,r.status,r.seats,r.notes,r.audience,
    r.origin,op.name origin_name,op.short_name origin_short,op.address origin_address,
    r.destination,dp.name destination_name,dp.short_name destination_short,dp.address destination_address,
    count(rm.user_id)::int member_count,
    count(*) filter(where p.gender='man')::int men,
    count(*) filter(where p.gender='woman')::int women
  into v_ride from public.rides r join public.places op on op.slug=r.origin
  join public.places dp on dp.slug=r.destination left join public.ride_members rm on rm.ride_id=r.id
  left join public.profiles p on p.id=rm.user_id
  where r.id=p_ride_id
  group by r.id,op.name,op.short_name,op.address,dp.name,dp.short_name,dp.address;
  if not found then return null; end if;
  if v_uid is not null then
    select exists(select 1 from public.ride_members rm where rm.ride_id=p_ride_id and rm.user_id=v_uid) into v_is_member;
  end if;
  v_is_past := v_ride.departs_at<=now();
  if (v_ride.status<>'active' or v_is_past) and not v_is_member then return null; end if;
  v_can_join := v_uid is not null and v_profile_exists
    and (v_gender is null or v_ride.audience='anyone'
      or (v_ride.audience='men' and v_gender='man')
      or (v_ride.audience='women' and v_gender='woman'));
  v_result := jsonb_build_object('id',v_ride.id,'departs_at',v_ride.departs_at,
    'status',v_ride.status,'is_past',v_is_past,'seats',v_ride.seats,
    'seats_left',v_ride.seats-v_ride.member_count,'audience',v_ride.audience,
    'origin',jsonb_build_object('slug',v_ride.origin,'name',v_ride.origin_name,'short_name',v_ride.origin_short,'address',v_ride.origin_address),
    'destination',jsonb_build_object('slug',v_ride.destination,'name',v_ride.destination_name,'short_name',v_ride.destination_short,'address',v_ride.destination_address));
  if v_uid is not null then
    if v_is_member then
      select coalesce(jsonb_agg(jsonb_build_object('name',p.first_name||' '||p.last_name,
        'first_name',p.first_name,'last_name',p.last_name,
        'phone',case when p.show_phone or rm.user_id=v_uid then p.phone else null end,
        'show_phone',p.show_phone,'venmo',p.venmo,
        'email',p.email,'is_owner',rm.user_id=v_ride.owner_id,'is_viewer',rm.user_id=v_uid)
        order by (rm.user_id=v_ride.owner_id) desc,rm.joined_at,rm.user_id),'[]'::jsonb)
      into v_members from public.ride_members rm join public.profiles p on p.id=rm.user_id where rm.ride_id=p_ride_id;
    else
      select coalesce(jsonb_agg(jsonb_build_object('name',p.first_name||' '||left(p.last_name,1)||'.',
        'is_owner',rm.user_id=v_ride.owner_id) order by (rm.user_id=v_ride.owner_id) desc,rm.joined_at,rm.user_id),'[]'::jsonb)
      into v_members from public.ride_members rm join public.profiles p on p.id=rm.user_id where rm.ride_id=p_ride_id;
    end if;
    v_result := v_result || jsonb_build_object('notes',v_ride.notes,'viewer_is_member',v_is_member,
      'viewer_is_owner',v_ride.owner_id=v_uid,'viewer_can_join_audience',v_can_join,'members',v_members);
    if v_ride.audience='anyone' then
      v_result := v_result || jsonb_build_object('mix',jsonb_build_object('men',v_ride.men,'women',v_ride.women));
    end if;
  end if;
  return v_result;
end;
$$;

create or replace function public.report_ride(p_ride_id uuid, p_reason text, p_details text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_report_id bigint;
  v_details text := nullif(pg_catalog.btrim(p_details), '');
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if p_reason is null or p_reason not in ('no_show', 'unsafe', 'wrong_info', 'other') then
    raise exception using errcode = 'P0001', message = 'invalid_reason';
  end if;
  if v_details is not null and pg_catalog.char_length(v_details) > 500 then
    raise exception using errcode = 'P0001', message = 'invalid_details';
  end if;

  perform 1 from public.profiles as p where p.id = v_uid for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'profile_required';
  end if;
  if public.get_ride(p_ride_id) is null then
    raise exception using errcode = 'P0001', message = 'ride_not_found';
  end if;
  if exists (
    select 1 from public.reports as r
    where r.ride_id = p_ride_id and r.reporter_id = v_uid
  ) then
    raise exception using errcode = 'P0001', message = 'already_reported';
  end if;
  if (
    select pg_catalog.count(*) from public.reports as r
    where r.reporter_id = v_uid
      and r.created_at > pg_catalog.now() - interval '24 hours'
  ) >= 5 then
    raise exception using errcode = 'P0001', message = 'report_limit';
  end if;

  insert into public.reports (ride_id, reporter_id, reason, details)
  values (p_ride_id, v_uid, p_reason, v_details)
  returning id into v_report_id;

  return v_report_id;
end;
$$;

revoke all on function public.set_gender(text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_gender(text) to authenticated;
