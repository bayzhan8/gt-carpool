create type public.notification_kind as enum (
  'member_joined',
  'member_left',
  'ownership_transferred',
  'ride_cancelled',
  'time_changed'
);

create type public.notification_status as enum (
  'pending',
  'sending',
  'sent',
  'failed'
);

create table public.notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  ride_id uuid not null references public.rides (id) on delete cascade,
  kind public.notification_kind not null,
  actor_name text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.notification_status not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default pg_catalog.now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default pg_catalog.now()
);

create index notifications_status_next_attempt_at_idx
  on public.notifications (status, next_attempt_at);

alter table public.notifications enable row level security;
revoke all on table public.notifications from public, anon, authenticated;
revoke all on sequence public.notifications_id_seq from public, anon, authenticated;

create or replace function app.leave_ride_as(p_uid uuid, p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride public.rides%rowtype;
  v_successor uuid;
  v_actor_name text;
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

  select pg_catalog.concat(p.first_name, ' ', pg_catalog.left(p.last_name, 1), '.')
  into v_actor_name
  from public.profiles as p
  where p.id = p_uid;

  if v_ride.owner_id = p_uid then
    select rm.user_id
    into v_successor
    from public.ride_members as rm
    where rm.ride_id = p_ride_id
      and rm.user_id <> p_uid
    order by rm.joined_at, rm.user_id
    limit 1;

    if found then
      insert into public.notifications (
        recipient_id,
        ride_id,
        kind,
        actor_name
      )
      values (
        v_successor,
        p_ride_id,
        'ownership_transferred',
        v_actor_name
      );

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
    insert into public.notifications (
      recipient_id,
      ride_id,
      kind,
      actor_name
    )
    values (
      v_ride.owner_id,
      p_ride_id,
      'member_left',
      v_actor_name
    );

    delete from public.ride_members
    where ride_id = p_ride_id
      and user_id = p_uid;
  end if;
end;
$$;

create or replace function public.update_ride(
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

  if p_departs_at is distinct from v_ride.departs_at then
    insert into public.notifications (
      recipient_id,
      ride_id,
      kind,
      actor_name,
      payload
    )
    select
      rm.user_id,
      p_ride_id,
      'time_changed',
      pg_catalog.concat(p.first_name, ' ', pg_catalog.left(p.last_name, 1), '.'),
      pg_catalog.jsonb_build_object(
        'old_departs_at',
        v_ride.departs_at,
        'new_departs_at',
        p_departs_at
      )
    from public.ride_members as rm
    join public.profiles as p on p.id = v_uid
    where rm.ride_id = p_ride_id
      and rm.user_id <> v_uid;
  end if;
end;
$$;

create or replace function public.cancel_ride(p_ride_id uuid)
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

  insert into public.notifications (
    recipient_id,
    ride_id,
    kind,
    actor_name
  )
  select
    rm.user_id,
    p_ride_id,
    'ride_cancelled',
    pg_catalog.concat(p.first_name, ' ', pg_catalog.left(p.last_name, 1), '.')
  from public.ride_members as rm
  join public.profiles as p on p.id = v_uid
  where rm.ride_id = p_ride_id
    and rm.user_id <> v_uid;
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

  insert into public.notifications (
    recipient_id,
    ride_id,
    kind,
    actor_name
  )
  select
    v_ride.owner_id,
    p_ride_id,
    'member_joined',
    pg_catalog.concat(p.first_name, ' ', pg_catalog.left(p.last_name, 1), '.')
  from public.profiles as p
  where p.id = v_uid;
end;
$$;

create or replace function public.claim_notifications(p_limit integer default 20)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with candidates as materialized (
    select n.id
    from public.notifications as n
    where (
      n.status = 'pending'
      and n.next_attempt_at <= pg_catalog.now()
    ) or (
      n.status = 'sending'
      and n.claimed_at < pg_catalog.now() - interval '10 minutes'
    )
    order by n.id
    limit p_limit
    for update skip locked
  ),
  claimed as (
    update public.notifications as n
    set status = 'sending',
        attempts = n.attempts + 1,
        claimed_at = pg_catalog.now()
    where n.id in (select c.id from candidates as c)
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

create or replace function public.complete_notification(
  p_id bigint,
  p_ok boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications as n
  set status = case
        when p_ok then 'sent'::public.notification_status
        when n.attempts >= 5 then 'failed'::public.notification_status
        else 'pending'::public.notification_status
      end,
      next_attempt_at = case
        when not p_ok and n.attempts < 5
          then pg_catalog.now()
            + pg_catalog.power(2::numeric, n.attempts)::integer * interval '1 minute'
        else n.next_attempt_at
      end,
      claimed_at = null,
      sent_at = case when p_ok then pg_catalog.now() else null end,
      last_error = case when p_ok then null else pg_catalog.left(p_error, 500) end
  where n.id = p_id;
end;
$$;

revoke all on function public.claim_notifications(integer)
  from public, anon, authenticated;
revoke all on function public.complete_notification(bigint, boolean, text)
  from public, anon, authenticated;
grant execute on function public.claim_notifications(integer) to service_role;
grant execute on function public.complete_notification(bigint, boolean, text)
  to service_role;
