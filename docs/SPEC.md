# GT Carpool — product and technical spec

Status: v1 contract. Requirement IDs (`R-…`) are referenced from tests; a test
that covers a requirement names its ID in the test title. Changing a rule here
means changing its tests in the same PR.

## 1. Product in one paragraph

Georgia Tech students post a trip ("Campus → ATL Domestic, Fri Dec 12, 6:30 AM,
4 seats including me"). Others with a `@gatech.edu` email find it, tap Join, and
see each other's phone numbers. On the day they meet, one person orders the
Uber/Lyft, and the others Venmo their share. The app does no payments, no
booking, no chat, no maps. Research and lessons from Rice Carpool are in
`docs/research.md`.

## 2. Principles

- One primary action per screen. Few words. No emojis, no stock phrases.
- Mobile first (360 px wide up), single column, max content width 560 px.
- Every rule is enforced in Postgres. The UI only mirrors rules for nicer errors.
- Least exposure: people see the minimum about others needed to share a car.

## 3. Users and access

| ID | Rule |
|---|---|
| R-AUTH-1 | Sign-in is a 6-digit one-time code emailed to the address. No passwords, no magic links (GT's Microsoft Safe Links pre-opens links and burns them). Code expires in 10 minutes. |
| R-AUTH-2 | Only addresses whose domain is exactly `gatech.edu` or ends in `.gatech.edu` may create an account. Enforced by a Supabase Auth `before_user_created` hook and a `profiles.email` check constraint. The UI rejects other domains before sending, with: "Use your @gatech.edu email." |
| R-AUTH-3 | Emails are trimmed and lower-cased before use. `Name@GATECH.EDU ` and `name@gatech.edu` are the same account. |
| R-AUTH-4 | After sign-in, a user without a complete profile is sent to `/welcome` and cannot create or join rides until it is complete. |
| R-AUTH-5 | After sign-in/onboarding the user returns to the page they started from. `next` is accepted only if it is a same-origin path starting with a single `/` (no `//`, no scheme, no backslash); otherwise `/`. |
| R-AUTH-6 | Sign out is available from the profile page and clears the session cookie. |

Profile fields (R-PROF-1): first name (1–40 chars, trimmed), last name (1–40),
phone (required; US numbers only in v1, stored as E.164 `+1XXXXXXXXXX`; input
accepts spaces, dashes, dots, parentheses and an optional leading `+1`/`1`),
Venmo handle (optional; stored without leading `@`; 5–30 chars of
`[A-Za-z0-9_-]`). Email comes from auth and is not editable.

R-PROF-2: a user can delete their account. This removes them from all upcoming
rides using the leave rules in §5 (so ownership transfers), then deletes the
auth user; their profile and memberships cascade.

## 4. Places

R-PLACE-1: places are a curated table; users cannot add places. v1 seed:

| slug | name | short | address |
|---|---|---|---|
| `gt` | Georgia Tech | Campus | North Ave NW, Atlanta, GA 30332 |
| `atl-domestic` | ATL Domestic Terminal | ATL Domestic | 6000 N Terminal Pkwy, Atlanta, GA 30320 |
| `atl-intl` | ATL International Terminal | ATL Intl | 2600 Maynard H. Jackson Jr. Blvd, Atlanta, GA 30320 |

R-PLACE-2: a ride's origin and destination differ. Exactly one end of every
ride is `gt` in v1 (campus ↔ airport only), enforced by the create/update RPCs
via the `places.kind` column (`campus` | `airport`): one end `campus`, the other
`airport`.

## 5. Rides

A ride: owner, origin, destination, departure time, total seats, notes, status
(`active` | `cancelled`), members. The owner is always a member.

| ID | Rule |
|---|---|
| R-RIDE-1 | Seats = total people in the car including the owner, 2–6. Default 4. |
| R-RIDE-2 | Departure must be at least 15 minutes in the future and at most 120 days ahead at create and update time. |
| R-RIDE-3 | Notes optional, ≤ 280 characters after trim. Plain text; rendered as text, never HTML. Placeholder: "Flight time, where to meet, luggage". |
| R-RIDE-4 | A user may own at most 5 active upcoming rides. |
| R-RIDE-5 | Times are entered and shown in America/New_York regardless of device time zone, with the zone shown once on the form ("Atlanta time"). DST edges: a nonexistent local time (spring-forward gap) is rejected; an ambiguous one (fall-back) takes the earlier instant. |
| R-JOIN-1 | Join succeeds only if the ride is active, departs in the future, the user is not already a member, has a complete profile, and members < seats. |
| R-JOIN-2 | The seat check and insert happen in one transaction holding a row lock on the ride, so concurrent joins can never exceed seats. |
| R-LEAVE-1 | A non-owner member may leave any time before departure. |
| R-LEAVE-2 | If the owner leaves and other members remain, ownership passes to the member who joined earliest (ties by user id); the ride stays active. In one transaction. |
| R-LEAVE-3 | If the owner leaves and is the only member, the ride becomes `cancelled`. |
| R-CANCEL-1 | The owner may cancel an upcoming active ride. Cancelled rides vanish from browse, stay in members' history marked "Cancelled", and can't be joined, edited or left. |
| R-EDIT-1 | The owner may edit time, seats and notes of an upcoming active ride. Seats can't go below the current member count. Origin/destination are fixed after creation (cancel and repost instead). |
| R-PAST-1 | Once departed, a ride is read-only: no join, leave, edit or cancel. |

## 6. Who sees what (enforced in SQL)

| Viewer | Browse list & ride page |
|---|---|
| Signed out | Departure time, origin, destination, seats total, seats left. No names, no notes. CTA: "Sign in with your GT email to join". (R-VIS-1) |
| Signed in, not a member | The above plus notes and each member's first name and last initial ("Alex P."). (R-VIS-2) |
| Current member of that ride | The above plus every member's full name, phone, Venmo and email. (R-VIS-3) |

R-VIS-4: `anon` and `authenticated` roles have no direct SELECT/INSERT/UPDATE/
DELETE on any table. All reads and writes go through `security definer` RPCs
with `set search_path = ''`, each granted explicitly. A pgTAP "security
inventory" test pins the full list of grants and definer functions; any new one
fails the test until the inventory is updated on purpose.

R-VIS-5: cancelled and past rides never appear in browse. A cancelled or past
ride page is visible only to its members (others get 404).

## 7. Screens

All screens share a thin top bar: wordmark "GT Carpool" (links to `/`), and on
the right either "Sign in" or the user's initials (links to `/me`).

1. **`/` Rides.** Segmented control "To the airport" / "To campus" (default: to
   the airport; remembered in the URL as `?dir=airport|campus`). Optional date
   chip row: "Any day" + next 14 days (`?day=YYYY-MM-DD`). List of cards grouped
   by day header ("Fri, Dec 12"). Card: time ("6:30 AM"), route ("Campus →
   ATL Domestic"), seats left ("2 seats left" / "Full", full rides shown last in
   the day and greyed), and for signed-in users the owner's "Alex P.". Empty
   state: "No rides yet. Post one and others can join." Primary button
   (sticky on mobile): "Post a ride".
2. **`/rides/new` Post a ride.** From / To (two selects, swap button; default
   Campus → ATL Domestic), date, time, seats stepper (2–6, "including you"),
   notes. Before submit, if there are active rides on the same route within ±90
   minutes, show them above the button: "Already going around then — join
   instead?" with their cards (R-DUP-1). Submit → ride page.
3. **`/rides/[id]` Ride.** Time and date large, route with addresses, seats
   ("2 of 4 seats left"), notes, members list per §6, one primary button:
   Join / Leave / (owner) Edit + Cancel ride in a secondary menu. Members see
   contact rows: name, tap-to-text phone (`sms:`), tap-to-call, Venmo link
   (`https://venmo.com/u/<handle>`), plus "Copy all numbers". A line "Split N
   ways" under seats for members. Join and Leave show a confirm sheet; Join's
   says "You'll text each other and order one Uber/Lyft on the day."
4. **`/rides/[id]/edit`** owner only.
5. **`/me`** Upcoming rides (owned and joined), Past rides, Profile edit, Sign
   out, Delete account (confirm by typing DELETE).
6. **`/signin`** Email field → "Send code" → 6-digit code field (numeric,
   `autocomplete="one-time-code"`) → in. "Use a different email" and "Resend
   code" (disabled 30 s).
7. **`/welcome`** First name, last name, phone, Venmo (optional). One button.

## 8. Notifications (email, M5)

R-NOTIF-1: events written to a `notifications` outbox table in the same
transaction as the change: someone joined your ride (to owner), someone left
(to owner), you are now the owner (to new owner), ride cancelled (to all other
members), time changed (to all other members). A server route drains the
outbox (claim with `for update skip locked`, mark sent/failed, max 5 attempts).
Drained right after each action and by a scheduled backstop. Plain-text email,
one sentence + link. Local/CI uses Mailpit; production uses Resend SMTP.

## 9. Design

Apple/Notion feel. White background `#FFFFFF`, surface `#F7F7F5`, text
`#191919`, muted `#6B6B6B`, hairline borders `#E9E9E7`, primary buttons near
black `#191919` with white text, one accent GT gold `#B3A369` used only for the
seats-left indicator and focus ring. System font stack (`-apple-system,
BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", Roboto, sans-serif`),
tabular numbers for times. 12 px card radius, 10 px button radius, 44 px
minimum touch targets. No entrance animations on first paint (they hurt LCP);
subtle 150 ms transitions on press only. Respects `prefers-reduced-motion`.
Light theme only in v1.

## 10. Quality bars (CI-enforced unless noted)

- Typecheck (strict), ESLint, Prettier check.
- Vitest unit tests for every pure helper (email domain, phone, Venmo, time zone
  conversion incl. DST, `next` sanitizer, display-name projection, contact list).
- pgTAP tests for every `R-` rule above that lives in SQL, including the
  security inventory (R-VIS-4).
- A concurrency test (Node + `pg`, two connections) proving R-JOIN-2: N parallel
  joins on a ride with 1 seat left → exactly one success.
- Playwright e2e on local Supabase, reading OTP codes from Mailpit, in a desktop
  and a 390×844 mobile project, browser time zone forced to
  `America/Los_Angeles` to prove R-RIDE-5. Journeys: non-GT email rejected; sign
  in + onboarding + return-to; post ride; second user browses, sees limited
  info, joins, sees contacts; full ride can't be joined; owner leaves →
  transfer; cancel; edit; delete account.
- axe-core: zero serious/critical violations on every screen.
- Lighthouse mobile ≥ 0.95 performance and 1.0 accessibility on `/` (manual
  gate at milestone ends, not CI).

## 11. Stack

Next.js (App Router, TypeScript, Server Components + Server Actions), Tailwind
CSS, Supabase (Postgres, Auth email OTP, RPCs), `@supabase/ssr` cookies,
Vitest, pgTAP via `supabase test db`, Playwright, GitHub Actions. Hosting:
Vercel + Supabase cloud (needs the owner's accounts, M6). Node 22+.

## 12. Out of scope for v1

Payments, in-app chat, maps/ETAs, drivers with own cars, rides outside campus ↔
airport, ratings, admin UI, push notifications, dark mode.
