create or replace function app.enforce_gatech_auth_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null
    and pg_catalog.lower(pg_catalog.btrim(new.email))
      !~ '^[^@[:space:]]+@([a-z0-9-]+\.)*gatech\.edu$'
  then
    raise exception using errcode = '23514', message = 'email_not_allowed';
  end if;

  if new.email_change is not null
    and new.email_change <> ''
    and pg_catalog.lower(pg_catalog.btrim(new.email_change))
      !~ '^[^@[:space:]]+@([a-z0-9-]+\.)*gatech\.edu$'
  then
    raise exception using errcode = '23514', message = 'email_not_allowed';
  end if;

  return new;
end;
$$;

revoke all on function app.enforce_gatech_auth_email()
  from public, anon, authenticated;

create trigger enforce_gatech_auth_email
before insert or update of email, email_change on auth.users
for each row
execute function app.enforce_gatech_auth_email();

create or replace function public.upsert_my_profile(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_venmo text,
  p_gender text
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
  v_gender public.gender;
  v_current_gender public.gender;
  v_profile public.profiles%rowtype;
  v_profile_exists boolean;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;
  if p_gender not in ('man', 'woman', 'unspecified') or p_gender is null then
    raise exception using errcode = 'P0001', message = 'invalid_gender';
  end if;
  v_gender := p_gender::public.gender;

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

  if v_profile_exists and v_current_gender is distinct from v_gender and exists (
    select 1 from public.ride_members as rm
    join public.rides as r on r.id = rm.ride_id
    where rm.user_id = v_uid and r.status = 'active'
      and r.departs_at > pg_catalog.now() and r.audience <> 'anyone'
  ) then
    raise exception using errcode = 'P0001', message = 'gender_locked';
  end if;

  insert into public.profiles (id, email, first_name, last_name, phone, venmo, gender)
  values (v_uid, v_email, v_first_name, v_last_name, p_phone, v_venmo, v_gender)
  on conflict (id) do update
  set email = excluded.email, first_name = excluded.first_name,
      last_name = excluded.last_name, phone = excluded.phone,
      venmo = excluded.venmo, gender = excluded.gender,
      updated_at = pg_catalog.now()
  returning * into v_profile;

  return pg_catalog.jsonb_build_object(
    'id', v_profile.id, 'email', v_profile.email,
    'first_name', v_profile.first_name, 'last_name', v_profile.last_name,
    'phone', v_profile.phone, 'venmo', v_profile.venmo,
    'gender', v_profile.gender
  );
exception when check_violation then
  raise exception using errcode = 'P0001', message = 'invalid_profile';
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
  where p.id = v_uid and p.gender is not null
  for share;
  if not found then raise exception using errcode = 'P0001', message = 'profile_required'; end if;
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
    or (p_audience <> 'anyone'
      and (v_gender is null or v_gender = 'unspecified'
        or p_audience <> case when v_gender = 'man' then 'men' else 'women' end))
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

create or replace function public.claim_notifications(p_limit integer default 20)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with candidates as materialized (
    select n.id, n.kind, n.ride_id, r.status as ride_status, r.departs_at
    from public.notifications as n
    join public.rides as r on r.id = n.ride_id
    where (
      n.status = 'pending'
      and n.next_attempt_at <= pg_catalog.now()
    ) or (
      n.status = 'sending'
      and n.claimed_at < pg_catalog.now() - interval '10 minutes'
    )
    order by n.id
    limit p_limit
    for update of n skip locked
  ),
  completed_stale as (
    update public.notifications as n
    set status = 'sent',
        claimed_at = null,
        sent_at = pg_catalog.now(),
        last_error = null
    from candidates as c
    where n.id = c.id
      and (
        c.departs_at <= pg_catalog.now()
        or (c.ride_status = 'cancelled' and c.kind <> 'ride_cancelled')
      )
    returning n.id
  ),
  claimed as (
    update public.notifications as n
    set status = 'sending',
        attempts = n.attempts + 1,
        claimed_at = pg_catalog.now()
    from candidates as c
    where n.id = c.id
      and not (
        c.departs_at <= pg_catalog.now()
        or (c.ride_status = 'cancelled' and c.kind <> 'ride_cancelled')
      )
    returning
      n.id,
      n.kind,
      n.actor_name,
      n.payload,
      n.attempts,
      n.recipient_id,
      n.ride_id
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', claimed.id,
        'kind', claimed.kind,
        'actor_name', claimed.actor_name,
        'payload', claimed.payload,
        'attempts', claimed.attempts,
        'recipient_email', recipient.email,
        'recipient_first_name', recipient.first_name,
        'ride', pg_catalog.jsonb_build_object(
          'id', ride.id,
          'departs_at', ride.departs_at,
          'origin_short_name', origin.short_name,
          'destination_short_name', destination.short_name
        )
      )
      order by claimed.id
    ),
    '[]'::jsonb
  )
  from claimed
  join public.profiles as recipient on recipient.id = claimed.recipient_id
  join public.rides as ride on ride.id = claimed.ride_id
  join public.places as origin on origin.slug = ride.origin
  join public.places as destination on destination.slug = ride.destination
$$;
