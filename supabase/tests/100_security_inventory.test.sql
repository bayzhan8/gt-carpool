begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select is(
  (select pg_catalog.array_agg(p.oid::regprocedure order by p.oid::regprocedure::text)
   from pg_catalog.pg_proc as p
   join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
   where n.nspname in ('public', 'app')
     and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')),
  array[
    'public.get_ride(uuid)'::regprocedure,
    'public.list_rides(text,date)'::regprocedure
  ]::regprocedure[],
  'R-VIS-4 anon can execute only the public browse RPCs'
);
select is(
  (select pg_catalog.array_agg(p.oid::regprocedure order by p.oid::regprocedure::text)
   from pg_catalog.pg_proc as p
   join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
   where n.nspname in ('public', 'app')
     and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  array[
    'public.cancel_ride(uuid)'::regprocedure,
    'public.create_ride(text,text,timestamptz,integer,text)'::regprocedure,
    'public.delete_my_account()'::regprocedure,
    'public.find_similar_rides(text,text,timestamptz)'::regprocedure,
    'public.get_my_profile()'::regprocedure,
    'public.get_ride(uuid)'::regprocedure,
    'public.join_ride(uuid)'::regprocedure,
    'public.leave_ride(uuid)'::regprocedure,
    'public.list_rides(text,date)'::regprocedure,
    'public.my_rides()'::regprocedure,
    'public.update_ride(uuid,timestamptz,integer,text)'::regprocedure,
    'public.upsert_my_profile(text,text,text,text)'::regprocedure
  ]::regprocedure[],
  'R-VIS-4 authenticated can execute only the listed RPCs'
);
select is(
  (select pg_catalog.array_agg(p.oid::regprocedure order by p.oid::regprocedure::text)
   from pg_catalog.pg_proc as p
   join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
   where n.nspname in ('public', 'app')
     and p.prosecdef),
  array[
    'app.leave_ride_as(uuid,uuid)'::regprocedure,
    'public.cancel_ride(uuid)'::regprocedure,
    'public.create_ride(text,text,timestamptz,integer,text)'::regprocedure,
    'public.delete_my_account()'::regprocedure,
    'public.find_similar_rides(text,text,timestamptz)'::regprocedure,
    'public.get_my_profile()'::regprocedure,
    'public.get_ride(uuid)'::regprocedure,
    'public.hook_before_user_created(jsonb)'::regprocedure,
    'public.join_ride(uuid)'::regprocedure,
    'public.leave_ride(uuid)'::regprocedure,
    'public.list_rides(text,date)'::regprocedure,
    'public.my_rides()'::regprocedure,
    'public.update_ride(uuid,timestamptz,integer,text)'::regprocedure,
    'public.upsert_my_profile(text,text,text,text)'::regprocedure
  ]::regprocedure[],
  'R-VIS-4 exact security definer function inventory'
);
select is(
  (select pg_catalog.count(*)::integer
   from pg_catalog.pg_proc as p
   join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
   where n.nspname in ('public', 'app')
     and p.prosecdef
     and (p.proconfig is null or not p.proconfig @> array['search_path=""'])),
  0,
  'R-VIS-4 every security definer function pins an empty search path'
);
select ok(
  pg_catalog.has_function_privilege(
    'supabase_auth_admin',
    'public.hook_before_user_created(jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'R-AUTH-2 auth admin can execute the before-user-created hook'
);
select is(
  (select pg_catalog.count(*)::integer
   from pg_catalog.pg_class as c
   join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p', 'S')
     and exists (
       select 1
       from pg_catalog.aclexplode(
         coalesce(
           c.relacl,
           pg_catalog.acldefault(
             case when c.relkind = 'S' then 'S'::"char" else 'r'::"char" end,
             c.relowner
           )
         )
       ) as acl
       where acl.grantee in ('anon'::regrole::oid, 'authenticated'::regrole::oid)
     )),
  0,
  'R-VIS-4 anon and authenticated have zero public table and sequence grants'
);
select is(
  (select pg_catalog.count(*)::integer
   from pg_catalog.pg_class as c
   join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p', 'S')
     and exists (
       select 1
       from pg_catalog.aclexplode(
         coalesce(
           c.relacl,
           pg_catalog.acldefault(
             case when c.relkind = 'S' then 'S'::"char" else 'r'::"char" end,
             c.relowner
           )
         )
       ) as acl
       where acl.grantee = 0
     )),
  0,
  'R-VIS-4 public has zero public table and sequence grants'
);
select is(
  (select pg_catalog.count(*)::integer
   from pg_catalog.pg_class as c
   join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and c.relrowsecurity),
  4,
  'R-VIS-4 row-level security is enabled on all four tables'
);
select is(
  (select pg_catalog.count(*)::integer
   from pg_catalog.pg_policies as p
   where p.schemaname = 'public'
     and p.tablename in ('places', 'profiles', 'rides', 'ride_members')),
  0,
  'R-VIS-4 all four tables have no RLS policies'
);
select ok(
  not pg_catalog.has_schema_privilege('anon', 'app', 'USAGE'),
  'R-VIS-4 anon lacks usage on internal app schema'
);
select ok(
  not pg_catalog.has_schema_privilege('authenticated', 'app', 'USAGE'),
  'R-VIS-4 authenticated lacks usage on internal app schema'
);

select * from finish();

rollback;
