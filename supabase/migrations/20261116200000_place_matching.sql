create extension if not exists pg_trgm with schema extensions;

drop function public.add_place(text);

create function public.add_place(
  p_name text,
  p_confirm_new boolean default false
)
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
  v_suggestions jsonb;
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

  if not coalesce(p_confirm_new, false) then
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'slug', s.slug,
          'name', s.name,
          'upcoming', s.upcoming
        )
        order by s.score desc, s.name
      ),
      '[]'::jsonb
    )
    into v_suggestions
    from (
      select
        p.slug,
        p.name,
        pg_catalog.count(distinct r.id)::integer as upcoming,
        greatest(
          extensions.similarity(p.name_key, v_key),
          extensions.strict_word_similarity(p.name_key, v_key),
          extensions.strict_word_similarity(v_key, p.name_key)
        ) as score
      from public.places as p
      left join public.rides as r
        on (r.origin = p.slug or r.destination = p.slug)
       and r.status = 'active'
       and r.departs_at > pg_catalog.now()
      where p.kind = 'other'
        and not p.hidden
        and p.name_key <> v_key
        and (
          extensions.similarity(p.name_key, v_key) >= 0.4
          or extensions.strict_word_similarity(p.name_key, v_key) >= 0.6
          or extensions.strict_word_similarity(v_key, p.name_key) >= 0.6
        )
      group by p.slug, p.name, p.name_key
      order by score desc, p.name
      limit 3
    ) as s;

    if pg_catalog.jsonb_array_length(v_suggestions) > 0 then
      return pg_catalog.jsonb_build_object('suggestions', v_suggestions);
    end if;
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

revoke all on function public.add_place(text, boolean) from public, anon, authenticated;
grant execute on function public.add_place(text, boolean) to authenticated;
