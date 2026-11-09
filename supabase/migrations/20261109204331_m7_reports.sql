do $m7$
declare
  v_signature regprocedure;
  v_definition text;
  v_signatures regprocedure[] := array[
    'public.upsert_my_profile(text,text,text,text,text)'::regprocedure,
    'public.create_ride(text,text,timestamptz,integer,text,text)'::regprocedure,
    'public.update_ride(uuid,timestamptz,integer,text,text)'::regprocedure,
    'public.join_ride(uuid)'::regprocedure,
    'public.list_rides(text,date)'::regprocedure,
    'public.find_similar_rides(text,text,timestamptz)'::regprocedure,
    'public.get_ride(uuid)'::regprocedure,
    'public.my_rides()'::regprocedure
  ];
begin
  foreach v_signature in array v_signatures loop
    v_definition := pg_catalog.pg_get_functiondef(v_signature);

    if v_signature = 'public.upsert_my_profile(text,text,text,text,text)'::regprocedure then
      v_definition := pg_catalog.replace(
        v_definition,
        $old$p_gender not in ('brother', 'sister')$old$,
        $new$p_gender not in ('brother', 'sister', 'unspecified')$new$
      );
      if pg_catalog.strpos(v_definition, $old$p_gender not in ('brother', 'sister')$old$) > 0 then
        raise exception 'M7 could not update gender validation';
      end if;
    elsif v_signature = 'public.create_ride(text,text,timestamptz,integer,text,text)'::regprocedure then
      v_definition := pg_catalog.replace(
        v_definition,
        $old$or (p_audience <> 'anyone'
      and p_audience <> case when v_gender = 'brother' then 'brothers' else 'sisters' end)$old$,
        $new$or (p_audience <> 'anyone'
      and (v_gender = 'unspecified'
        or p_audience <> case when v_gender = 'brother' then 'brothers' else 'sisters' end))$new$
      );
      if pg_catalog.strpos(
        v_definition,
        $old$or (p_audience <> 'anyone'
      and p_audience <> case when v_gender = 'brother' then 'brothers' else 'sisters' end)$old$
      ) > 0 then
        raise exception 'M7 could not update create_ride audience validation';
      end if;
    elsif v_signature = 'public.update_ride(uuid,timestamptz,integer,text,text)'::regprocedure then
      v_definition := pg_catalog.replace(
        v_definition,
        $old$or (p_audience <> 'anyone'
      and (v_gender is null
        or p_audience <> case when v_gender = 'brother' then 'brothers' else 'sisters' end))$old$,
        $new$or (p_audience <> 'anyone'
      and (v_gender is null or v_gender = 'unspecified'
        or p_audience <> case when v_gender = 'brother' then 'brothers' else 'sisters' end))$new$
      );
      if pg_catalog.strpos(
        v_definition,
        $old$or (p_audience <> 'anyone'
      and (v_gender is null
        or p_audience <> case when v_gender = 'brother' then 'brothers' else 'sisters' end))$old$
      ) > 0 then
        raise exception 'M7 could not update update_ride audience validation';
      end if;
    end if;

    v_definition := pg_catalog.replace(v_definition, $old$'brothers'$old$, $new$'men'$new$);
    v_definition := pg_catalog.replace(v_definition, $old$'sisters'$old$, $new$'women'$new$);
    v_definition := pg_catalog.replace(v_definition, $old$'brother'$old$, $new$'man'$new$);
    v_definition := pg_catalog.replace(v_definition, $old$'sister'$old$, $new$'woman'$new$);

    execute v_definition;
  end loop;
end;
$m7$;

create table public.reports (
  id bigint generated always as identity primary key,
  ride_id uuid not null references public.rides (id) on delete cascade,
  reporter_id uuid references public.profiles (id) on delete set null,
  reason text not null check (reason in ('no_show', 'unsafe', 'wrong_info', 'other')),
  details text check (details is null or pg_catalog.char_length(details) <= 500),
  created_at timestamptz not null default pg_catalog.now(),
  unique (ride_id, reporter_id)
);

create index reports_reporter_created_at_idx
  on public.reports (reporter_id, created_at);

alter table public.reports enable row level security;
revoke all on public.reports from public, anon, authenticated;
revoke all on sequence public.reports_id_seq from public, anon, authenticated;

create function public.report_ride(p_ride_id uuid, p_reason text, p_details text)
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

  perform 1 from public.profiles as p
  where p.id = v_uid and p.gender is not null
  for update;
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

revoke all on function public.report_ride(uuid,text,text) from public, anon, authenticated;
grant execute on function public.report_ride(uuid,text,text) to authenticated;
