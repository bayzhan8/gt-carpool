begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('dd000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@gatech.edu', '', now()),
  ('dd000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'reporter@gatech.edu', '', now()),
  ('dd000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'incomplete@gatech.edu', '', now()),
  ('dd000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'unset@gatech.edu', '', now());

insert into public.profiles (id, email, first_name, last_name, phone, gender)
values
  ('dd000000-0000-4000-8000-000000000001', 'owner@gatech.edu', 'Ride', 'Owner', '+14045550131', 'man'),
  ('dd000000-0000-4000-8000-000000000002', 'reporter@gatech.edu', 'Ride', 'Reporter', '+14045550132', 'unspecified'),
  ('dd000000-0000-4000-8000-000000000004', 'unset@gatech.edu', 'Unset', 'Gender', '+14045550134', null);

insert into public.rides (id, owner_id, origin, destination, departs_at, seats, status)
select
  ('dd100000-0000-4000-8000-' || pg_catalog.lpad(n::text, 12, '0'))::uuid,
  'dd000000-0000-4000-8000-000000000001',
  'gt', 'atl-domestic', now() + interval '2 days', 4, 'active'
from pg_catalog.generate_series(1, 6) as rides(n);

insert into public.rides (id, owner_id, origin, destination, departs_at, seats, status)
values
  ('dd100000-0000-4000-8000-000000000007', 'dd000000-0000-4000-8000-000000000001',
   'gt', 'atl-domestic', now() - interval '1 day', 4, 'cancelled');

set local role authenticated;
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  $$select public.report_ride('dd100000-0000-4000-8000-000000000001','unsafe','')$$,
  'P0001', 'not_authenticated',
  'R-REPORT-1 reporting requires authentication'
);

select set_config('request.jwt.claims',
  '{"sub":"dd000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok(
  $$select public.report_ride('dd100000-0000-4000-8000-000000000001','unsafe','')$$,
  'P0001', 'profile_required',
  'R-REPORT-1 reporting requires a complete profile'
);

select set_config('request.jwt.claims',
  '{"sub":"dd000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok(
  $$select public.report_ride('dd100000-0000-4000-8000-000000000001','invalid','')$$,
  'P0001', 'invalid_reason',
  'R-REPORT-1 invalid reason is rejected'
);
select throws_ok(
  $$select public.report_ride('dd100000-0000-4000-8000-000000000001','unsafe',pg_catalog.repeat('x',501))$$,
  'P0001', 'invalid_details',
  'R-REPORT-1 details longer than 500 characters are rejected'
);
select throws_ok(
  $$select public.report_ride('dd100000-0000-4000-8000-000000000007','unsafe','')$$,
  'P0001', 'ride_not_found',
  'R-REPORT-1 viewers cannot report a ride they cannot see'
);
select ok(
  public.report_ride('dd100000-0000-4000-8000-000000000001','unsafe','  ') > 0,
  'R-REPORT-1 valid report returns its identity'
);
select throws_ok(
  $$select public.report_ride('dd100000-0000-4000-8000-000000000001','other','again')$$,
  'P0001', 'already_reported',
  'R-REPORT-1 one report per ride and reporter'
);
select public.report_ride('dd100000-0000-4000-8000-000000000002','no_show',' details ');
select public.report_ride('dd100000-0000-4000-8000-000000000003','wrong_info','');
select public.report_ride('dd100000-0000-4000-8000-000000000004','other','');
select public.report_ride('dd100000-0000-4000-8000-000000000005','unsafe','');
select throws_ok(
  $$select public.report_ride('dd100000-0000-4000-8000-000000000006','unsafe','')$$,
  'P0001', 'report_limit',
  'R-REPORT-1 reporter is limited to five reports per rolling 24 hours'
);
select set_config('request.jwt.claims',
  '{"sub":"dd000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select ok(
  public.report_ride('dd100000-0000-4000-8000-000000000001','unsafe','') > 0,
  'R-REPORT-1 a profile row with null gender can report a ride'
);

reset role;
select is(
  (select details from public.reports
   where ride_id = 'dd100000-0000-4000-8000-000000000001'
     and reporter_id = 'dd000000-0000-4000-8000-000000000002'),
  null::text,
  'R-REPORT-1 blank details are stored as null'
);
select is(
  (select details from public.reports
   where ride_id = 'dd100000-0000-4000-8000-000000000002'),
  'details',
  'R-REPORT-1 report details are trimmed'
);
delete from auth.users where id = 'dd000000-0000-4000-8000-000000000002';
select is(
  (select reporter_id from public.reports
   where ride_id = 'dd100000-0000-4000-8000-000000000001'
     and reporter_id is null),
  null::uuid,
  'R-REPORT-1 reporter deletion preserves report and nulls reporter_id'
);
delete from public.rides where id = 'dd100000-0000-4000-8000-000000000001';
select is(
  (select pg_catalog.count(*)::integer from public.reports
   where ride_id = 'dd100000-0000-4000-8000-000000000001'),
  0,
  'R-REPORT-1 ride deletion cascades its reports'
);

select * from finish();
rollback;
