begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('70000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'alex@gatech.edu', '', pg_catalog.now()),
  ('70000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'casey@gatech.edu', '', pg_catalog.now()),
  ('70000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'jordan@gatech.edu', '', pg_catalog.now()),
  ('70000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'taylor@gatech.edu', '', pg_catalog.now()),
  ('70000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'riley@gatech.edu', '', pg_catalog.now()),
  ('70000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'morgan@gatech.edu', '', pg_catalog.now());

insert into public.profiles (id, email, first_name, last_name, phone)
values
  ('70000000-0000-4000-8000-000000000001', 'alex@gatech.edu', 'Alex', 'Owner', '+14045550123'),
  ('70000000-0000-4000-8000-000000000002', 'casey@gatech.edu', 'Casey', 'Member', '+14045550124'),
  ('70000000-0000-4000-8000-000000000003', 'jordan@gatech.edu', 'Jordan', 'Other', '+14045550125'),
  ('70000000-0000-4000-8000-000000000004', 'taylor@gatech.edu', 'Taylor', 'Delete', '+14045550126'),
  ('70000000-0000-4000-8000-000000000005', 'riley@gatech.edu', 'Riley', 'Successor', '+14045550127'),
  ('70000000-0000-4000-8000-000000000006', 'morgan@gatech.edu', 'Morgan', 'Alone', '+14045550128');
update public.profiles set gender = 'man' where gender is null;

insert into public.rides (id, owner_id, origin, destination, departs_at, seats)
values
  ('77000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 4),
  ('77000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 4),
  ('77000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 4),
  ('77000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 4),
  ('77000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000001', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 4),
  ('77000000-0000-4000-8000-000000000006', '70000000-0000-4000-8000-000000000006', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 4),
  ('77000000-0000-4000-8000-000000000007', '70000000-0000-4000-8000-000000000004', 'gt', 'atl-domestic', pg_catalog.now() + interval '1 day', 4);

insert into public.ride_members (ride_id, user_id, joined_at)
values
  ('77000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', pg_catalog.now()),
  ('77000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001', pg_catalog.now()),
  ('77000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000002', pg_catalog.now() + interval '1 minute'),
  ('77000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000001', pg_catalog.now()),
  ('77000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000002', pg_catalog.now() + interval '1 minute'),
  ('77000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000003', pg_catalog.now() + interval '2 minutes'),
  ('77000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000001', pg_catalog.now()),
  ('77000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000002', pg_catalog.now() + interval '1 minute'),
  ('77000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000003', pg_catalog.now() + interval '2 minutes'),
  ('77000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000001', pg_catalog.now()),
  ('77000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000002', pg_catalog.now() + interval '1 minute'),
  ('77000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000003', pg_catalog.now() + interval '2 minutes'),
  ('77000000-0000-4000-8000-000000000006', '70000000-0000-4000-8000-000000000006', pg_catalog.now()),
  ('77000000-0000-4000-8000-000000000007', '70000000-0000-4000-8000-000000000004', pg_catalog.now()),
  ('77000000-0000-4000-8000-000000000007', '70000000-0000-4000-8000-000000000005', pg_catalog.now() + interval '1 minute');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select public.join_ride('77000000-0000-4000-8000-000000000001');
select public.leave_ride('77000000-0000-4000-8000-000000000002');
select set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select public.leave_ride('77000000-0000-4000-8000-000000000003');
select public.cancel_ride('77000000-0000-4000-8000-000000000004');
select public.update_ride(
  '77000000-0000-4000-8000-000000000005',
  pg_catalog.now() + interval '2 days',
  4,
  '',
  'anyone'
);
select public.update_ride(
  '77000000-0000-4000-8000-000000000005',
  pg_catalog.now() + interval '2 days',
  5,
  'seat-only change',
  'anyone'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000006","role":"authenticated"}',
  true
);
select public.leave_ride('77000000-0000-4000-8000-000000000006');
select set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);
select public.delete_my_account();
reset role;

select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where ride_id = '77000000-0000-4000-8000-000000000001'
     and recipient_id = '70000000-0000-4000-8000-000000000001'
     and kind = 'member_joined'
     and actor_name = 'Casey M.'
     and payload = '{}'::jsonb),
  1,
  'R-NOTIF-1 join creates one owner notification with the member display name'
);
select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where ride_id = '77000000-0000-4000-8000-000000000001'
     and recipient_id = '70000000-0000-4000-8000-000000000002'),
  0,
  'R-NOTIF-1 join never notifies the actor'
);
select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where ride_id = '77000000-0000-4000-8000-000000000002'
     and recipient_id = '70000000-0000-4000-8000-000000000001'
     and kind = 'member_left'
     and actor_name = 'Casey M.'),
  1,
  'R-NOTIF-1 non-owner leave notifies the owner with the actor name'
);
select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where ride_id = '77000000-0000-4000-8000-000000000002'
     and recipient_id = '70000000-0000-4000-8000-000000000002'),
  0,
  'R-NOTIF-1 non-owner leave never notifies the actor'
);
select ok(
  exists (
    select 1
    from public.notifications
    where ride_id = '77000000-0000-4000-8000-000000000003'
      and recipient_id = '70000000-0000-4000-8000-000000000002'
      and kind = 'ownership_transferred'
      and actor_name = 'Alex O.'
  )
  and (select owner_id from public.rides where id = '77000000-0000-4000-8000-000000000003')
    = '70000000-0000-4000-8000-000000000002'::uuid,
  'R-NOTIF-1 owner leave notifies the earliest successor of ownership transfer'
);
select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where ride_id = '77000000-0000-4000-8000-000000000003'
     and recipient_id = '70000000-0000-4000-8000-000000000001'),
  0,
  'R-NOTIF-1 ownership transfer never notifies the leaving owner'
);
select is(
  (select pg_catalog.array_agg(recipient_id order by recipient_id)
   from public.notifications
   where ride_id = '77000000-0000-4000-8000-000000000004'
     and kind = 'ride_cancelled'
     and actor_name = 'Alex O.'),
  array[
    '70000000-0000-4000-8000-000000000002'::uuid,
    '70000000-0000-4000-8000-000000000003'::uuid
  ],
  'R-NOTIF-1 cancellation notifies every other member'
);
select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where ride_id = '77000000-0000-4000-8000-000000000004'
     and recipient_id = '70000000-0000-4000-8000-000000000001'),
  0,
  'R-NOTIF-1 cancellation never notifies the actor'
);
select is(
  (select pg_catalog.array_agg(recipient_id order by recipient_id)
   from public.notifications
   where ride_id = '77000000-0000-4000-8000-000000000005'
     and kind = 'time_changed'
     and actor_name = 'Alex O.'),
  array[
    '70000000-0000-4000-8000-000000000002'::uuid,
    '70000000-0000-4000-8000-000000000003'::uuid
  ],
  'R-NOTIF-1 departure-time changes notify every other member'
);
select is(
  (select payload
   from public.notifications
   where ride_id = '77000000-0000-4000-8000-000000000005'
     and recipient_id = '70000000-0000-4000-8000-000000000002'),
  pg_catalog.jsonb_build_object(
    'old_departs_at',
    pg_catalog.now() + interval '1 day',
    'new_departs_at',
    pg_catalog.now() + interval '2 days'
  ),
  'R-NOTIF-1 time-change payload contains the old and new departure instants'
);
select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where ride_id = '77000000-0000-4000-8000-000000000005'
     and recipient_id = '70000000-0000-4000-8000-000000000001'),
  0,
  'R-NOTIF-1 time changes never notify the actor'
);
select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where ride_id = '77000000-0000-4000-8000-000000000005'
     and kind = 'time_changed'),
  2,
  'R-NOTIF-1 seats and notes changes alone create no notifications'
);
select is(
  (select status::text from public.rides where id = '77000000-0000-4000-8000-000000000006'),
  'cancelled',
  'R-NOTIF-1 an owner leaving alone still cancels the ride'
);
select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where ride_id = '77000000-0000-4000-8000-000000000006'),
  0,
  'R-NOTIF-1 an owner leaving alone creates no notification'
);
select ok(
  exists (
    select 1
    from public.notifications
    where ride_id = '77000000-0000-4000-8000-000000000007'
      and recipient_id = '70000000-0000-4000-8000-000000000005'
      and kind = 'ownership_transferred'
      and actor_name = 'Taylor D.'
  )
  and (select owner_id from public.rides where id = '77000000-0000-4000-8000-000000000007')
    = '70000000-0000-4000-8000-000000000005'::uuid,
  'R-NOTIF-1 deleting an owner writes the ownership-transfer event before profile cascade'
);
select is(
  (select pg_catalog.count(*)::integer
   from public.notifications
   where ride_id = '77000000-0000-4000-8000-000000000007'
     and recipient_id = '70000000-0000-4000-8000-000000000004'),
  0,
  'R-NOTIF-1 account deletion never notifies the deleted actor'
);
select ok(
  not exists (
    select 1 from auth.users
    where id = '70000000-0000-4000-8000-000000000004'
  ),
  'R-NOTIF-1 account deletion still removes the owner profile'
);

create temporary table first_claim (data jsonb);
insert into first_claim select public.claim_notifications(1);
select is(
  (select pg_catalog.jsonb_array_length(data) from first_claim),
  1,
  'R-NOTIF-1 claim returns an array containing the requested batch'
);
select is(
  (select data -> 0 ->> 'recipient_email' from first_claim),
  'alex@gatech.edu',
  'R-NOTIF-1 claim returns the recipient email'
);
select is(
  (select data -> 0 ->> 'recipient_first_name' from first_claim),
  'Alex',
  'R-NOTIF-1 claim returns the recipient first name'
);
select is(
  (select data -> 0 -> 'ride' ->> 'origin_short_name' from first_claim),
  'Campus',
  'R-NOTIF-1 claim returns the ride places'
);
select is(
  (select attempts from public.notifications
   where id = ((select data -> 0 ->> 'id' from first_claim))::bigint),
  1,
  'R-NOTIF-1 claim marks the row sending and increments attempts'
);
select public.complete_notification(
  ((select data -> 0 ->> 'id' from first_claim))::bigint,
  true,
  null
);
select ok(
  exists (
    select 1
    from public.notifications
    where id = ((select data -> 0 ->> 'id' from first_claim))::bigint
      and status = 'sent'
      and sent_at is not null
      and claimed_at is null
  ),
  'R-NOTIF-1 successful completion marks a notification sent'
);

create temporary table retry_claim (data jsonb);
insert into retry_claim select public.claim_notifications(1);
select public.complete_notification(
  ((select data -> 0 ->> 'id' from retry_claim))::bigint,
  false,
  pg_catalog.repeat('x', 550)
);
select ok(
  exists (
    select 1
    from public.notifications
    where id = ((select data -> 0 ->> 'id' from retry_claim))::bigint
      and status = 'pending'
      and next_attempt_at between pg_catalog.now() + interval '119 seconds'
        and pg_catalog.now() + interval '121 seconds'
      and pg_catalog.char_length(last_error) = 500
      and claimed_at is null
  ),
  'R-NOTIF-1 failed delivery is retried after two minutes with error truncated to 500 chars'
);
do $$
declare
  v_id bigint := (
    select (data -> 0 ->> 'id')::bigint from retry_claim
  );
  v_attempt integer;
begin
  for v_attempt in 2..5 loop
    update public.notifications
    set next_attempt_at = pg_catalog.now()
    where id = v_id;

    perform public.claim_notifications(1);
    perform public.complete_notification(v_id, false, 'delivery failed');
  end loop;
end;
$$;
select ok(
  exists (
    select 1
    from public.notifications
    where id = ((select data -> 0 ->> 'id' from retry_claim))::bigint
      and status = 'failed'
      and attempts = 5
      and last_error = 'delivery failed'
  ),
  'R-NOTIF-1 a notification is marked failed after its fifth unsuccessful attempt'
);

update public.notifications set status = 'sent';
insert into public.notifications (
  recipient_id,
  ride_id,
  kind,
  actor_name,
  status,
  attempts,
  claimed_at
)
values (
  '70000000-0000-4000-8000-000000000001',
  '77000000-0000-4000-8000-000000000001',
  'member_joined',
  'Stale',
  'sending',
  2,
  pg_catalog.now() - interval '11 minutes'
);
create temporary table stale_claim (data jsonb);
insert into stale_claim select public.claim_notifications(1);
select is(
  (select data -> 0 ->> 'id' from stale_claim),
  (select id::text from public.notifications where actor_name = 'Stale'),
  'R-NOTIF-1 claim reclaims stale sending rows'
);
select ok(
  exists (
    select 1
    from public.notifications
    where actor_name = 'Stale'
      and status = 'sending'
      and attempts = 3
      and claimed_at >= pg_catalog.now() - interval '1 minute'
  ),
  'R-NOTIF-1 reclaim refreshes claim time and increments attempts'
);

select * from finish();

rollback;
