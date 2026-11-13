alter table public.profiles
  add column show_phone boolean not null default true;

alter table public.rides
  alter column owner_id drop not null,
  drop constraint rides_owner_id_fkey;

alter table public.rides
  add constraint rides_owner_id_fkey
    foreign key (owner_id) references public.profiles (id) on delete set null;

create or replace function public.get_my_profile()
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
    'venmo', v_profile.venmo,
    'gender', v_profile.gender,
    'show_phone', v_profile.show_phone
  );
end;
$$;

drop function public.upsert_my_profile(text, text, text, text, text);

create function public.upsert_my_profile(
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

  insert into public.profiles (
    id, email, first_name, last_name, phone, venmo, gender, show_phone
  )
  values (
    v_uid, v_email, v_first_name, v_last_name, p_phone, v_venmo, v_gender, v_show_phone
  )
  on conflict (id) do update
  set email = excluded.email, first_name = excluded.first_name,
      last_name = excluded.last_name, phone = excluded.phone,
      venmo = excluded.venmo, gender = excluded.gender,
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

create or replace function public.get_ride(p_ride_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_gender public.gender; v_ride record;
  v_is_member boolean := false; v_is_past boolean; v_members jsonb;
  v_mix jsonb; v_can_join boolean := false; v_result jsonb;
begin
  if v_uid is not null then select p.gender into v_gender from public.profiles p where p.id=v_uid; end if;
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
  v_can_join := v_uid is not null and v_gender is not null and
    (v_ride.audience='anyone' or (v_ride.audience='men' and v_gender='man')
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

revoke all on function public.upsert_my_profile(text, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.upsert_my_profile(text, text, text, text, text, boolean)
  to authenticated;
