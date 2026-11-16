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
      and (op.kind <> 'other' or not op.hidden)
      and (dp.kind <> 'other' or not dp.hidden)
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

revoke all on function public.find_similar_rides(text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.find_similar_rides(text, text, timestamptz)
  to authenticated;
