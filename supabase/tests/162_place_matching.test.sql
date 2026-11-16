begin;

create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('16200000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'match-owner@gatech.edu', '', pg_catalog.now()),
  ('16200000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'match-limit@gatech.edu', '', pg_catalog.now()),
  ('16200000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'match-hidden@gatech.edu', '', pg_catalog.now()),
  ('16200000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'match-confirm@gatech.edu', '', pg_catalog.now());

insert into public.profiles (id, email, first_name, last_name, phone, gender)
values
  ('16200000-0000-4000-8000-000000000001', 'match-owner@gatech.edu', 'Match', 'Owner', '+14045550161', null),
  ('16200000-0000-4000-8000-000000000002', 'match-limit@gatech.edu', 'Match', 'Limit', '+14045550162', null),
  ('16200000-0000-4000-8000-000000000003', 'match-hidden@gatech.edu', 'Match', 'Hidden', '+14045550163', null),
  ('16200000-0000-4000-8000-000000000004', 'match-confirm@gatech.edu', 'Match', 'Confirm', '+14045550164', null);

select set_config(
  'request.jwt.claims',
  '{"sub":"16200000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

update public.places set hidden = true where kind = 'other';
update public.places
set name = 'Fixture ' || pg_catalog.right(slug, 12),
    short_name = 'Fixture ' || pg_catalog.right(slug, 12),
    name_key = app.place_key('Fixture ' || pg_catalog.right(slug, 12))
where kind = 'other'
  and name_key = any(array[
    app.place_key('Atlanta'),
    app.place_key('Decatur'),
    app.place_key('Macon'),
    app.place_key('Georgia Aquarium'),
    app.place_key('Hidden Savanah'),
    app.place_key('Closed Savanah'),
    app.place_key('Savanah'),
    app.place_key('Blue Heron Park'),
    app.place_key('North Point Mall'),
    app.place_key('Oak Grove Center'),
    app.place_key('Pine Lake'),
    app.place_key('Named Argument Place'),
    app.place_key('Athen')
  ]);

insert into public.places (slug, name, short_name, address, kind, sort, hidden, name_key)
values
  ('p-athens162', 'Athens', 'Athens', '', 'other', 100, false, app.place_key('Athens')),
  ('p-savannah162', 'Savannah', 'Savannah', '', 'other', 100, false, app.place_key('Savannah')),
  ('p-sav-ga162', 'Savannah Georgia', 'Savannah Georgia', '', 'other', 100, false, app.place_key('Savannah Georgia')),
  ('p-sav-river162', 'Savannah River', 'Savannah River', '', 'other', 100, false, app.place_key('Savannah River')),
  ('p-sav-center162', 'Savannah Center', 'Savannah Center', '', 'other', 100, false, app.place_key('Savannah Center')),
  ('p-sav-place162', 'Savannah Place', 'Savannah Place', '', 'other', 100, false, app.place_key('Savannah Place')),
  ('p-mercedes162', 'Mercedes-Benz Stadium', 'Mercedes-Benz Stadium', '', 'other', 100, false, app.place_key('Mercedes-Benz Stadium')),
  ('p-six-flags162', 'Six Flags Over Georgia', 'Six Flags Over Georgia', '', 'other', 100, false, app.place_key('Six Flags Over Georgia')),
  ('p-stone162', 'Stone Mountain', 'Stone Mountain', '', 'other', 100, false, app.place_key('Stone Mountain')),
  ('p-duluth162', 'Duluth', 'Duluth', '', 'other', 100, false, app.place_key('Duluth')),
  ('p-marietta162', 'Marietta', 'Marietta', '', 'other', 100, false, app.place_key('Marietta')),
  ('p-georgia-state162', 'Georgia State', 'Georgia State', '', 'other', 100, false, app.place_key('Georgia State'))
on conflict (name_key) do update
set name = excluded.name,
    short_name = excluded.short_name,
    hidden = excluded.hidden;

select ok(
  exists (
    select 1 from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm' and n.nspname = 'extensions'
  ),
  'R-DEST-11 pg_trgm is installed in extensions'
);
select ok(
  not pg_catalog.has_function_privilege(
    'anon', 'public.add_place(text,boolean)', 'EXECUTE'
  ),
  'R-DEST-12 anon cannot execute the matching RPC'
);

update public.places set hidden = true where kind = 'other';
update public.places set hidden = false where name_key = app.place_key('Athens');
select is(
  public.add_place('Athen')->'suggestions'->0->>'name',
  'Athens',
  'R-DEST-11 Athen suggests Athens'
);
select is(
  public.add_place('Athens GA')->'suggestions'->0->>'name',
  'Athens',
  'R-DEST-11 Athens GA suggests Athens'
);
select is(
  public.add_place('Athens Georgia')->'suggestions'->0->>'name',
  'Athens',
  'R-DEST-11 Athens Georgia suggests Athens'
);
select is(
  public.add_place('Atlanta')->>'created',
  'true',
  'R-DEST-11 Atlanta is created when only Athens exists'
);
delete from public.places where name_key = app.place_key('Atlanta');
select is(
  public.add_place('Athens')->>'created',
  'false',
  'R-DEST-12 exact key matches are reused immediately'
);
select ok(
  not (public.add_place('Athens') ? 'suggestions'),
  'R-DEST-12 exact key matches have no suggestions'
);

update public.places set hidden = true where kind = 'other';
update public.places set hidden = false where name_key = app.place_key('Savannah');
select is(
  public.add_place('Savanah')->'suggestions'->0->>'name',
  'Savannah',
  'R-DEST-11 Savanah suggests Savannah'
);
update public.places set hidden = true where kind = 'other';
update public.places set hidden = false where name_key = app.place_key('Mercedes-Benz Stadium');
select is(
  public.add_place('Mercedes Benz')->'suggestions'->0->>'name',
  'Mercedes-Benz Stadium',
  'R-DEST-11 Mercedes Benz suggests Mercedes-Benz Stadium'
);
select is(
  public.add_place('MB Stadium')->'suggestions'->0->>'name',
  'Mercedes-Benz Stadium',
  'R-DEST-11 MB Stadium suggests Mercedes-Benz Stadium'
);
update public.places set hidden = true where kind = 'other';
update public.places set hidden = false where name_key = app.place_key('Six Flags Over Georgia');
select is(
  public.add_place('Six Flags')->'suggestions'->0->>'name',
  'Six Flags Over Georgia',
  'R-DEST-11 Six Flags suggests Six Flags Over Georgia'
);
update public.places set hidden = true where kind = 'other';
update public.places set hidden = false where name_key = app.place_key('Stone Mountain');
select is(
  public.add_place('Stone Mtn')->'suggestions'->0->>'name',
  'Stone Mountain',
  'R-DEST-11 Stone Mtn suggests Stone Mountain'
);

update public.places set hidden = true where kind = 'other';
update public.places set hidden = false where name_key = app.place_key('Duluth');
select is(
  public.add_place('Decatur')->>'created',
  'true',
  'R-DEST-11 Decatur is created when Duluth exists'
);
delete from public.places where name_key = app.place_key('Decatur');
update public.places set hidden = true where kind = 'other';
update public.places set hidden = false where name_key = app.place_key('Marietta');
select is(
  public.add_place('Macon')->>'created',
  'true',
  'R-DEST-11 Macon is created when Marietta exists'
);
delete from public.places where name_key = app.place_key('Macon');
update public.places set hidden = true where kind = 'other';
update public.places set hidden = false where name_key = app.place_key('Georgia State');
select is(
  public.add_place('Georgia Aquarium')->>'created',
  'true',
  'R-DEST-11 Georgia Aquarium is created when Georgia State exists'
);
delete from public.places where name_key = app.place_key('Georgia Aquarium');

update public.places set hidden = true where kind = 'other';
insert into public.places (slug, name, short_name, address, kind, sort, hidden, name_key)
values ('p-hidden-sav162', 'Hidden Savannah', 'Hidden Savannah', '', 'other', 100, true, app.place_key('Hidden Savannah'))
on conflict (name_key) do update set hidden = true;
select set_config(
  'request.jwt.claims',
  '{"sub":"16200000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
select is(
  public.add_place('Hidden Savanah')->>'created',
  'true',
  'R-DEST-11 hidden places are never suggested'
);

update public.places set hidden = true where kind = 'other';
insert into public.places (slug, name, short_name, address, kind, sort, hidden, name_key)
values ('p-closed-sav162', 'Closed Savannah', 'Closed Savannah', '', 'other', 100, false, app.place_key('Closed Savannah'))
on conflict (name_key) do update set hidden = false;
insert into public.rides (id, owner_id, origin, destination, departs_at, seats, status)
select
  '16200000-0000-4000-8000-000000000009',
  '16200000-0000-4000-8000-000000000001',
  'gt', p.slug, pg_catalog.now() - interval '31 days', 4, 'active'
from public.places as p
where p.name_key = app.place_key('Closed Savannah');
select is(
  public.add_place('Closed Savanah')->'suggestions'->0->>'name',
  'Closed Savannah',
  'R-DEST-11 closed places can be suggested'
);
select is(
  (public.add_place('Closed Savanah')->'suggestions'->0->>'upcoming')::integer,
  0,
  'R-DEST-12 closed-place suggestions have zero upcoming rides'
);

update public.places set hidden = true where kind = 'other';
update public.places
set hidden = false
where name_key in (
  app.place_key('Savannah'),
  app.place_key('Savannah Georgia'),
  app.place_key('Savannah River'),
  app.place_key('Savannah Center'),
  app.place_key('Savannah Place')
);
select is(
  pg_catalog.jsonb_array_length(public.add_place('Savanah')->'suggestions'),
  3,
  'R-DEST-12 returns at most three suggestions'
);
with response as (
  select public.add_place('Savanah')->'suggestions' as suggestions
), actual as (
  select pg_catalog.array_agg(item->>'name' order by ordinal) as names
  from response,
    pg_catalog.jsonb_array_elements(response.suggestions)
      with ordinality as suggestions(item, ordinal)
), expected as (
  select pg_catalog.array_agg(name order by score desc, name) as names
  from (
    select p.name,
      greatest(
        extensions.similarity(p.name_key, app.place_key('Savanah')),
        extensions.strict_word_similarity(p.name_key, app.place_key('Savanah')),
        extensions.strict_word_similarity(app.place_key('Savanah'), p.name_key)
      ) as score
    from public.places p
    where p.kind = 'other'
      and not p.hidden
      and p.name_key <> app.place_key('Savanah')
      and (
        extensions.similarity(p.name_key, app.place_key('Savanah')) >= 0.4
        or extensions.strict_word_similarity(p.name_key, app.place_key('Savanah')) >= 0.6
        or extensions.strict_word_similarity(app.place_key('Savanah'), p.name_key) >= 0.6
      )
    order by score desc, p.name
    limit 3
  ) as candidates
)
select is(
  (select names from actual),
  (select names from expected),
  'R-DEST-12 suggestions order by score descending, then name'
);
select is(
  (select pg_catalog.count(*)::integer from public.places where name_key = app.place_key('Savanah')),
  0,
  'R-DEST-12 suggestions do not create a place'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"16200000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);
update public.places set hidden = true where kind = 'other';
update public.places set hidden = false where name_key = app.place_key('Athens');
select is(
  public.add_place('Athen', true)->>'created',
  'true',
  'R-DEST-12 confirm_new creates despite similar places'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"16200000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
update public.places set hidden = true where kind = 'other';
update public.places set hidden = false where name_key = app.place_key('Savannah');
select is(public.add_place('Blue Heron Park')->>'created', 'true', 'R-DEST-12 first real create counts toward the limit');
select is(public.add_place('North Point Mall')->>'created', 'true', 'R-DEST-12 second real create counts toward the limit');
select is(public.add_place('Oak Grove Center')->>'created', 'true', 'R-DEST-12 third real create counts toward the limit');
select ok(
  public.add_place('Savanah') ? 'suggestions',
  'R-DEST-12 suggestion responses do not count toward place_limit'
);
select throws_ok(
  $$select public.add_place('Pine Lake')$$,
  'P0001', 'place_limit',
  'R-DEST-12 place_limit applies after three real creates'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"16200000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
update public.places set hidden = true where kind = 'other';
select is(
  public.add_place(p_name => 'Named Argument Place')->>'created',
  'true',
  'R-DEST-12 the old named p_name-only call uses the default'
);

select * from finish();
rollback;
