create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.ride_members
  add column if not exists reminded_at timestamptz;

create or replace function app.reset_ride_reminders_after_departure_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ride_members
  set reminded_at = null
  where ride_id = new.id;

  return new;
end;
$$;

create or replace function app.notify_group_of_late_join()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride public.rides%rowtype;
  v_actor_name text;
begin
  select r.*
  into v_ride
  from public.rides as r
  where r.id = new.ride_id;

  if found
    and v_ride.status = 'active'
    and v_ride.departs_at <= pg_catalog.now() + interval '24 hours'
  then
    select pg_catalog.concat(
      p.first_name,
      ' ',
      pg_catalog.left(p.last_name, 1),
      '.'
    )
    into v_actor_name
    from public.profiles as p
    where p.id = new.user_id;

    insert into public.notifications (
      recipient_id,
      ride_id,
      kind,
      actor_name
    )
    select
      rm.user_id,
      new.ride_id,
      'member_joined',
      v_actor_name
    from public.ride_members as rm
    where rm.ride_id = new.ride_id
      and rm.user_id <> new.user_id
      and rm.user_id <> v_ride.owner_id;
  end if;

  return new;
end;
$$;

create trigger rides_reset_reminders_after_departure_change
after update of departs_at on public.rides
for each row
when (old.departs_at is distinct from new.departs_at)
execute function app.reset_ride_reminders_after_departure_change();

create trigger ride_members_notify_group_of_late_join
after insert on public.ride_members
for each row
execute function app.notify_group_of_late_join();

create or replace function public.enqueue_ride_reminders()
returns integer
language sql
security definer
set search_path = ''
as $$
  with candidates as materialized (
    select rm.ride_id, rm.user_id
    from public.ride_members as rm
    join public.rides as r on r.id = rm.ride_id
    where r.status = 'active'
      and r.departs_at > pg_catalog.now() + interval '30 minutes'
      and r.departs_at <= pg_catalog.now() + interval '24 hours'
      and rm.reminded_at is null
      and (
        select pg_catalog.count(*)
        from public.ride_members as members
        where members.ride_id = r.id
      ) >= 2
    for update of rm skip locked
  ),
  marked as (
    update public.ride_members as rm
    set reminded_at = pg_catalog.now()
    from candidates
    where rm.ride_id = candidates.ride_id
      and rm.user_id = candidates.user_id
    returning rm.ride_id, rm.user_id
  ),
  inserted as (
    insert into public.notifications (
      recipient_id,
      ride_id,
      kind,
      actor_name
    )
    select
      marked.user_id,
      marked.ride_id,
      'ride_reminder',
      ''
    from marked
    returning id
  )
  select pg_catalog.count(*)::integer
  from inserted;
$$;

create or replace function public.verify_drain_token(p_token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    p_token <> ''
    and exists (
      select 1
      from vault.decrypted_secrets as s
      where s.name = 'notifications_drain_token'
        and s.decrypted_secret = p_token
    ),
    false
  );
$$;

create or replace function public.run_ride_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_token text;
begin
  perform public.enqueue_ride_reminders();

  select
    pg_catalog.max(s.decrypted_secret) filter (
      where s.name = 'notifications_drain_url'
    ),
    pg_catalog.max(s.decrypted_secret) filter (
      where s.name = 'notifications_drain_token'
    )
  into v_url, v_token
  from vault.decrypted_secrets as s
  where s.name in ('notifications_drain_url', 'notifications_drain_token');

  if v_url is not null
    and v_url <> ''
    and v_token is not null
    and v_token <> ''
    and exists (
      select 1
      from public.notifications as n
      where n.status = 'pending'
        and n.next_attempt_at <= pg_catalog.now()
    )
  then
    perform net.http_get(
      url := v_url,
      headers := pg_catalog.jsonb_build_object(
        'Authorization',
        'Bearer ' || v_token
      ),
      timeout_milliseconds := 30000
    );
  end if;
end;
$$;

revoke all on function app.reset_ride_reminders_after_departure_change()
  from public, anon, authenticated, service_role;
revoke all on function app.notify_group_of_late_join()
  from public, anon, authenticated, service_role;
revoke all on function public.enqueue_ride_reminders()
  from public, anon, authenticated, service_role;
revoke all on function public.verify_drain_token(text)
  from public, anon, authenticated;
revoke all on function public.run_ride_reminders()
  from public, anon, authenticated, service_role;

grant execute on function public.verify_drain_token(text) to service_role;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select j.jobid
    from cron.job as j
    where j.jobname = 'ride-reminders'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'ride-reminders',
  '*/10 * * * *',
  'select public.run_ride_reminders()'
);
