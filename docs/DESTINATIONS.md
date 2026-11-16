# Destinations beyond the airport

Status: contract for M8. Rule IDs (`R-DEST-…`) are referenced from tests, the
same way as in [SPEC.md](./SPEC.md). Changing a rule here means changing its
tests in the same PR.

## 1. Why

GT Carpool started as campus ↔ ATL only. Students also share rides to Athens,
Savannah, a concert at State Farm Arena, or home for break. We let students add
those destinations themselves, without an admin, while keeping ATL the obvious
main use.

The platform is new and has few users. Two consequences shape the design:

- **No approval queue and no voting.** A destination that needs N people to
  "unlock" would never unlock with a small user base. Posting a ride is the
  only signal of demand we need.
- **No clutter.** Most added destinations will be used once. A picker full of
  one-off names makes the app feel empty and messy, so destinations with no
  recent rides close on their own and stop being suggested.

## 2. Concepts

| Term | Meaning |
|---|---|
| Curated place | The three built-in places: `gt` (campus), `atl-domestic`, `atl-intl` (airport). Permanent, always listed first. |
| Community place | A place a student added (`places.kind = 'other'`). Name only, no address. |
| Open | A community place that has demand right now (R-DEST-5). Only open places are suggested in pickers and filters. |
| Closed | A community place with no recent demand. Still exists; its old rides still work; typing its name again reuses it. |
| Hidden | A community place an operator turned off (R-DEST-9). Never suggested, cannot be used for new rides. |

## 3. Rules

### Route shape

**R-DEST-1.** Every ride still has campus (`gt`) at exactly one end. The other
end is either an airport place or a community place. Community ↔ airport and
community ↔ community rides are rejected with `invalid_route`. Enforced in
`create_ride`.

**R-DEST-2.** Airport rides stay primary. The board's direction control is
**To ATL** · **From ATL** · **Other trips**, in that order, default To ATL.
`?dir=airport` (campus → airport), `?dir=campus` (airport → campus) and
`?dir=other` (any ride with a community place at either end). "Other trips"
contains both directions; each card's route ("Campus → Athens",
"Savannah → Campus") tells them apart.

### Adding a place

**R-DEST-3.** A signed-in student with a profile adds a place by name with
`public.add_place(p_name text) returns jsonb`
(`{"slug", "name", "created": boolean}`). Rules, in order:

1. `not_authenticated` without a user; `profile_required` without a profile.
2. Normalise: Unicode NFC, trim, collapse runs of whitespace to one space.
3. `invalid_place_name` unless the normalised name:
   - is 2–32 characters,
   - contains at least 2 letters,
   - uses only letters (any script, accents included), digits, spaces and
     `. , ' ’ & - ( ) /`,
   - does not contain `@`, `://`, `www`, or a domain-like `letter.letters`
     sequence with no space (`foo.com`; "St. Louis" is fine),
   - has at most 4 digits in total (no phone numbers, no street addresses),
   - does not start with a number of 2+ digits followed by a space
     (`"123 Main St"`).
4. Compute the key: lower-case, every run of non-letter/non-digit characters
   becomes one space, trimmed. `"Mercedes-Benz  Stadium"` and
   `"mercedes benz stadium"` share the key `mercedes benz stadium`.
5. `place_reserved` if the key equals the key of any curated place's `name` or
   `short_name`, or one of these aliases: `atl`, `airport`, `atl airport`,
   `atlanta airport`, `hartsfield`, `hartsfield jackson`,
   `hartsfield jackson airport`, `gt`, `gatech`, `georgia tech`, `campus`,
   `tech`.
6. If a community place with that key exists: `place_unavailable` if it is
   hidden, otherwise return it with `created: false`. Reusing a place is always
   allowed and never counts toward the limit.
7. `place_limit` if this user already created 3 community places in the last
   7 days.
8. Insert with a fresh opaque slug (`p-` + 10 hex chars), `name` = normalised
   name, `short_name` = `name`, `address` = `''`, `kind = 'other'`,
   `sort = 100`, `created_by` = user, `created_at = now()`. Return it with
   `created: true`.

Concurrency: two students adding the same name at once get the same place
(unique index on the key, `insert … on conflict do nothing`, then select). One
student racing several adds cannot exceed the limit (lock the caller's profile
row `for update` before counting).

**R-DEST-4.** Adding a place does not make it open. A place nobody posts a ride
to never appears anywhere, so abandoned or junk additions are invisible.

### Demand: open and closed

**R-DEST-5.** A community place is **open** when it is not hidden and at least
one ride with `status = 'active'` touches it with
`departs_at > now() - interval '30 days'` (upcoming, or departed within the last
30 days). Otherwise it is **closed**. Openness is computed on read, never
stored, so there is no job to run and no race between "closing" and posting.

Why 30 days: with few users, a destination someone used last weekend should
still be suggested for the trip back and for the next person going there. Any
shorter and almost nothing would stay open; any longer and one-off trips
linger.

**R-DEST-6.** Closing never touches rides. Rides to a closed place keep working
(view, join, leave, edit, cancel, reminders). Posting a new ride to a closed
place (typing the same name reuses it, R-DEST-3.6) opens it again.

**R-DEST-7.** `public.list_open_places() returns jsonb`: open community places
only, as `[{"slug", "name", "upcoming": int, "riders": int}]`, where
`upcoming` = active rides departing in the future and `riders` = distinct
members of active rides departing within the 30-day window or later. Ordered by
`upcoming desc, riders desc, name`, at most 50. Granted to `anon` and
`authenticated` (the signed-out board shows the Other trips filter too).

### Listing

**R-DEST-8.** `list_rides(p_direction, p_day)` accepts `airport`, `campus` and
`other`:

- `airport`: origin kind `campus`, destination kind `airport`.
- `campus`: origin kind `airport`, destination kind `campus`. (Before this
  change it was "destination is campus", which would have pulled community
  trips into From ATL.)
- `other`: origin or destination kind `other`, and that place is not hidden.

All existing visibility, audience and ordering rules apply unchanged.
`find_similar_rides` works unchanged for community routes (same origin and
destination, ±90 minutes).

### Safety and operations

**R-DEST-9.** `places.hidden boolean not null default false`. An operator hides
a bad name with
`update public.places set hidden = true where slug = '<slug>';`
Hidden places are not returned by `list_open_places`, rides touching them are
not returned by `list_rides('other', …)`, `add_place` refuses the name, and
`create_ride` rejects them with `place_unavailable`. Existing rides on a
hidden place stay reachable by direct link for their members; cancel them by
hand if needed. Students report bad names through the existing ride report.

**R-DEST-10.** Community places have no address. Ride pages show only the name
for that end; the calendar file's `LOCATION` includes both ends of the route,
using each end's address or its name when the address is empty.
`places.created_by` references `profiles(id) on delete set null`, so deleting
an account keeps the place and its other riders' rides.
Clients never read `public.places` directly (no table grants); everything goes
through RPCs.

## 4. Screens

### Board (`/`)

- Direction control: **To ATL** · **From ATL** · **Other trips**, three equal
  segments that fit at 320 px.
- Subtitle per tab: "Find or share a ride to the airport.", "Find or share a
  ride back to campus.", "Trips beyond the airport, to or from campus."
- Other trips adds a chip row above the day chips: **All places** plus one chip
  per open place (`?place=<slug>`, client-side filter, R-DEST-7 order). Hidden
  when there are no open places.
- Other trips empty state: "No other trips yet. Heading somewhere else? Post a
  ride and add your destination."
- The board loads all three lists and the open places on the server, so tab
  and chip switches stay instant.

### Post a ride (`/rides/new`)

- From and To keep the current select-with-swap layout. Both selects list:
  Campus, ATL Domestic, ATL International, then (if any) an "Other places"
  group of open community places (top 8 from R-DEST-7, plus the currently
  selected place if it is not among them), then **Somewhere else…**.
- Picking a non-campus place on one side sets the other side to Campus, as
  today. Picking Campus when the other side is Campus sets the other side to
  ATL Domestic, as today.
- Picking **Somewhere else…** opens the Add place sheet (same bottom-sheet /
  centred-card pattern as the gender sheet). Cancel restores the previous
  selection.
- `/rides/new?dir=other` pre-selects Campus → the top open place, or, when
  none is open, Campus → ATL Domestic with the Add place sheet opened once.

### Add place sheet

- Title: "Where are you headed?" (To side) or "Where are you coming from?"
  (From side).
- One text field, label "Place", placeholder "Athens, Savannah, State Farm
  Arena…", `maxlength=32`, `autocomplete="off"`.
- As you type, matching open places (key contains the typed key) appear as
  tappable rows: "Athens · 2 upcoming rides". Tapping one selects it without a
  server call.
- Footnote: "Use a city or venue, not a home address. Places with no rides for
  30 days drop off this list."
- Buttons: **Use this place** (calls `add_place`) and **Cancel**. On success
  the place is selected and added to both selects.
- Error copy (in `lib/errors.ts`):
  - `invalid_place_name`: "Use a city or venue name, 2–32 characters."
  - `place_reserved`: "That one's already in the list."
  - `place_unavailable`: "That place isn't available. Try another name."
  - `place_limit`: "You've added 3 new places this week. Pick one from the list."
  - `invalid_route` (updated): "One end of every ride is campus."

### Elsewhere

- Ride page: the address line under a community place is omitted.
- Home "How it works" step 1: "Campus ⇄ ATL Domestic or International, or
  anywhere else you're headed."
- SPEC.md §12: "rides outside campus ↔ airport" becomes "rides that don't
  start or end at campus".

## 5. Rollout

1. Migration `…_place_kind_other.sql`: `alter type public.place_kind add value
   'other';` alone (a new enum value cannot be used in the transaction that
   adds it).
2. Migration `…_destinations.sql`: columns, indexes, `add_place`,
   `list_open_places`, updated `create_ride` and `list_rides`, grants.
3. Apply both to production (separately, in order), then deploy the app. The
   old app keeps working against the new database: no community places exist
   yet, so `campus` returns the same rides.

## 6. Not doing (yet)

Addresses or maps for community places, editing or merging place names,
community ↔ airport rides, promoting popular places to curated, per-place
pages, notifying people when a destination they used opens again.
