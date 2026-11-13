# Database design (M1)

Implements SPEC §3–§6 in Postgres. All rules live here; the UI only mirrors them.

## Tables (schema `public`)

```
type place_kind  = enum ('campus','airport')
type ride_status = enum ('active','cancelled')

places(slug text pk, name text, short_name text, address text, kind place_kind, sort int)
  seed (in the migration, not seed.sql — production needs it):
  ('gt','Georgia Tech','Campus','North Ave NW, Atlanta, GA 30332','campus',1)
  ('atl-domestic','ATL Domestic Terminal','ATL Domestic','6000 N Terminal Pkwy, Atlanta, GA 30320','airport',2)
  ('atl-intl','ATL International Terminal','ATL Intl','2600 Maynard H. Jackson Jr. Blvd, Atlanta, GA 30320','airport',3)

profiles(
  id uuid pk references auth.users(id) on delete cascade,
  email text not null unique  check (email = lower(email) and email ~ '^[^@[:space:]]+@([a-z0-9-]+\.)*gatech\.edu$'),
  first_name text not null    check (first_name = btrim(first_name) and char_length(first_name) between 1 and 40),
  last_name  text not null    (same check),
  phone text not null         check (phone ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'),
  venmo text null             check (venmo ~ '^[A-Za-z0-9_-]{5,30}$'),
  created_at, updated_at timestamptz not null default now())
  -- A profile row exists only once onboarding is complete (R-AUTH-4: "complete profile" == row exists).

rides(
  id uuid pk default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  origin text not null references places(slug),
  destination text not null references places(slug),
  departs_at timestamptz not null,
  seats smallint not null check (seats between 2 and 6),
  notes text not null default '' check (char_length(notes) <= 280),
  status ride_status not null default 'active',
  created_at, updated_at,
  check (origin <> destination))
  index (status, departs_at); index (owner_id)

ride_members(
  ride_id uuid references rides(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz not null default clock_timestamp(),
  primary key (ride_id, user_id))
  index (user_id)
```

Invariant (maintained by RPCs, asserted in pgTAP): the owner is always a member;
member count ≤ seats.

## Privileges (R-VIS-4)

- RLS enabled on all four tables with **no policies**.
- `revoke all on all tables in schema public from anon, authenticated, public`
  and the matching `alter default privileges` (for role postgres, schema public)
  so tables created later are also closed. Same for sequences.
- `alter default privileges ... revoke execute on functions from public` and an
  explicit `revoke execute ... from public, anon, authenticated` on every
  function, then grant only the RPCs listed below.
- Internal helpers live in schema `app` (not exposed by PostgREST; `usage`
  revoked from anon/authenticated).
- Every function: `security definer`, `set search_path = ''`, fully-qualified
  names inside.

## Auth hook (R-AUTH-2)

`public.hook_before_user_created(event jsonb) returns jsonb`: email =
`lower(btrim(event->'user'->>'email'))`; if it matches the profiles regex →
`'{}'::jsonb`; else `{"error":{"http_code":403,"message":"Use your @gatech.edu email."}}`.
Execute granted only to `supabase_auth_admin`. config.toml:
`[auth.hook.before_user_created] enabled = true, uri = "pg-functions://postgres/public/hook_before_user_created"`.
(Production: same hook must be enabled in the dashboard — M6 checklist.)

## Errors

RPCs raise `raise exception using errcode = 'P0001', message = '<key>'` with
exactly these keys (the UI maps keys to copy):

`not_authenticated, profile_required, invalid_profile, email_not_allowed,
ride_not_found, ride_not_active, ride_departed, ride_full, already_member,
not_member, not_owner, invalid_route, invalid_time, invalid_seats,
invalid_notes, too_many_rides, seats_below_members`

## RPCs (schema public)

Viewer = `auth.uid()` (null when signed out). "Upcoming" = `departs_at > now()`.
Display name = `first_name || ' ' || left(last_name, 1) || '.'`.

| Function | Grant | Behaviour |
|---|---|---|
| `get_my_profile() → jsonb` | authenticated | own profile `{id,email,first_name,last_name,phone,venmo}` or null |
| `upsert_my_profile(p_first_name text, p_last_name text, p_phone text, p_venmo text) → jsonb` | authenticated | names btrim'd; venmo: btrim, strip one leading `@`, empty → null; email copied from `auth.users` (lower). Check-constraint violations → `invalid_profile`; non-GT auth email → `email_not_allowed`. Phone must already be E.164 (TS normalizes). Returns the profile. |
| `create_ride(p_origin text, p_destination text, p_departs_at timestamptz, p_seats int, p_notes text) → uuid` | authenticated | auth → profile → route (both exist, one `campus` + one `airport`, else `invalid_route`) → time (`now()+15min ≤ t ≤ now()+120 days`, else `invalid_time`) → seats 2–6 (`invalid_seats`) → notes btrim ≤ 280 (`invalid_notes`) → `pg_advisory_xact_lock(hashtextextended(uid::text,0))` then count owned active upcoming rides ≥ 5 → `too_many_rides`. Insert ride + owner membership. |
| `update_ride(p_ride_id uuid, p_departs_at timestamptz, p_seats int, p_notes text) → void` | authenticated | `select … for update`; missing → `ride_not_found`; not owner → `not_owner`; cancelled → `ride_not_active`; departed → `ride_departed`; then same time/seats/notes validation; seats < member count → `seats_below_members`. |
| `cancel_ride(p_ride_id uuid) → void` | authenticated | lock; not_found / not_owner / not_active / departed; set `cancelled`. |
| `join_ride(p_ride_id uuid) → void` | authenticated | auth → profile → `for update` lock → not_found (also for cancelled? no: cancelled → `ride_not_active`) → departed → already_member → count ≥ seats → `ride_full` → insert. (R-JOIN-1/2) |
| `leave_ride(p_ride_id uuid) → void` | authenticated | lock → not_found → not_active → departed → not_member. Non-owner: delete membership. Owner with others: `owner_id` := earliest other member by `(joined_at, user_id)`, delete own membership. Owner alone: status `cancelled`, keep membership (history). Body lives in `app.leave_ride_as(uid, ride_id)` reused by delete. (R-LEAVE-1..3) |
| `list_rides(p_direction text, p_day date default null) → jsonb` (array) | anon, authenticated | `p_direction` 'airport' = destination kind airport, 'campus' = destination kind campus, else `invalid_route`. Active + upcoming only; `p_day` filters on `(departs_at at time zone 'America/New_York')::date`. Order: local date, full-last, departs_at, id. Limit 200. Item: `{id, departs_at, origin:{slug,short_name}, destination:{slug,short_name}, seats, seats_left}`; signed-in viewers also get `owner_name` (display name) and `is_member`. |
| `find_similar_rides(p_origin text, p_destination text, p_departs_at timestamptz) → jsonb` | authenticated | Same item shape; active, upcoming, same route, `abs(departs_at - p) ≤ 90 min`, not full, viewer not a member; order by distance in time. (R-DUP-1) |
| `get_ride(p_ride_id uuid) → jsonb` | anon, authenticated | null if missing, or if (cancelled or departed) and viewer not a member (R-VIS-5). Base: `{id, departs_at, status, is_past, seats, seats_left, origin:{slug,name,short_name,address}, destination:{…}}`. Signed in (R-VIS-2): + `notes`, `viewer_is_member`, `viewer_is_owner`, `members:[{name (display), is_owner}]` ordered owner first then joined_at. Member (R-VIS-3): members items instead `{name (full "First Last"), first_name, last_name, phone, venmo, email, is_owner, is_viewer}`. Signed-out (R-VIS-1): none of notes/members/viewer flags keys present at all. |
| `my_rides() → jsonb` | authenticated | rides where viewer is a member, any status: item shape of list_rides plus `status, is_past, is_owner`; order `departs_at desc`. |
| `delete_my_account() → void` | authenticated | for each active upcoming ride the viewer is a member of: `app.leave_ride_as`; then `delete from auth.users where id = uid` (cascades). (R-PROF-2) |

## Tests

pgTAP files under `supabase/tests/`, one per area, each assertion description
starting with the R- ID it proves. Impersonate with
`set local role authenticated; select set_config('request.jwt.claims', json_build_object('sub', uid, 'role','authenticated')::text, true);`
and `set local role anon` for signed-out. Fixtures insert `auth.users` rows +
profiles directly as postgres; past rides are inserted directly (bypassing RPCs).

Must cover at minimum: every error key above from each RPC that can raise it;
owner-is-member and member ≤ seats after every operation; transfer picks
earliest joiner (with a tie on joined_at broken by user_id); owner-alone leave
cancels; cancelled/past rides absent from list and 404 to non-members but
visible to members; exact key sets per viewer type for get_ride and list_rides
(signed-out JSON has no `notes`/`members`/`owner_name`); non-member signed-in
never sees phone/email/venmo anywhere; DST: `p_day` filter uses Atlanta date (a
ride at 2026-12-12 04:30 UTC is on Dec 11 local); hook accepts/rejects the
same vectors as `tests/unit/email.test.ts`; delete_my_account transfers owned
upcoming rides and removes auth user; security inventory (exact set of
functions executable by anon, by authenticated; exact set of security definer
functions; every definer has `search_path=""`; zero table/sequence grants to
anon/authenticated in public; anon/authenticated lack usage on schema app).

Concurrency (R-JOIN-2, R-RIDE-4): `tests/db/*.test.ts` run by Vitest with a
separate config (`vitest.db.config.ts`, script `test:db:race`) using `pg` and
`DB_URL` from `supabase status -o env`: 8 parallel connections join a ride with
1 seat left → exactly 1 success, 7 `ride_full`, member count == seats. 6
parallel create_ride calls from a user with 3 owned → exactly 2 succeed.
Fixtures created and removed per test with unique ids.

GoTrue-level hook test (Playwright API test, no browser UI, desktop project
only): `signInWithOtp('someone@gmail.com')` returns an error and no Mailpit
mail arrives; `signInWithOtp('x@gatech.edu.evil.com')` errors;
`signInWithOtp('<unique>@cc.gatech.edu')` succeeds.
