-- A few sample rides so the board isn't empty. All are full so nobody can join a fake ride.
-- Demo accounts use @carpool-demo.gatech.edu, which the notification drain
-- never emails (lib/demo.ts). Idempotent: re-running replaces the demo data.
-- Remove with scripts/demo/remove.sql.
begin;

delete from auth.users where email like '%@carpool-demo.gatech.edu';

create temporary table demo_people (n int, first text, last text, gender public.gender) on commit drop;
insert into demo_people values
  (1, 'Maya', 'Chen', 'woman'), (2, 'Priya', 'Patel', 'woman'),
  (3, 'Sofia', 'Ramirez', 'woman'), (4, 'Hannah', 'Kim', 'woman'),
  (5, 'Aisha', 'Bello', 'woman'), (6, 'Emily', 'Nguyen', 'woman'),
  (7, 'Grace', 'Okafor', 'woman'), (8, 'Jake', 'Morris', 'man'),
  (9, 'Daniel', 'Park', 'man');

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000',
  ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'authenticated', 'authenticated', 'demo' || n || '@carpool-demo.gatech.edu', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from demo_people;

insert into public.profiles (id, email, first_name, last_name, phone, gender)
select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'demo' || n || '@carpool-demo.gatech.edu', first, last,
  '+1404555' || lpad((100 + n)::text, 4, '0'), gender
from demo_people;

-- day offset, local time, origin, destination, seats, audience, notes, member numbers (first = owner)
create temporary table demo_rides (k int, d int, t time, o text, dst text, seats int,
  aud public.ride_audience, notes text, members int[]) on commit drop;
insert into demo_rides values
  (1, 2, '07:15', 'gt', 'atl-domestic', 4, 'anyone', 'Delta flight, one checked bag each.', '{8,1,9,2}'),
  (2, 6, '04:45', 'gt', 'atl-intl', 3, 'anyone', 'Early flight to Seoul. Meeting at the Student Center.', '{4,6,2}'),
  (3, 9, '18:40', 'atl-domestic', 'gt', 4, 'women', 'Landing on Southwest around 6.', '{3,5,7,1}');

insert into public.rides (id, owner_id, origin, destination, departs_at, seats, notes, audience)
select ('00000000-0000-4000-9000-' || lpad(k::text, 12, '0'))::uuid,
  ('00000000-0000-4000-8000-' || lpad(members[1]::text, 12, '0'))::uuid,
  o, dst,
  (((now() at time zone 'America/New_York')::date + d) + t) at time zone 'America/New_York',
  seats, notes, aud
from demo_rides;

insert into public.ride_members (ride_id, user_id, joined_at)
select ('00000000-0000-4000-9000-' || lpad(r.k::text, 12, '0'))::uuid,
  ('00000000-0000-4000-8000-' || lpad(m.n::text, 12, '0'))::uuid,
  now() + (m.ord || ' seconds')::interval
from demo_rides r, unnest(r.members) with ordinality as m(n, ord);

commit;
