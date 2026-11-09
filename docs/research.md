# Research: Rice Carpool (carpool.riceapps.org)

Studied on 2026-11-08 from the live site, its public GraphQL API, and the
open-source repos under github.com/rice-apps.

## What it is

Rice students post a trip ("Rice → IAH, Nov 21 9:30 AM, 3 seats including me").
Others browse, join, and then text each other and order one Uber/Lyft on the day.
The app does no payments, no booking and no chat. Its confirmation dialog says it
plainly: "You will still need to contact your fellow riders and order an Uber or
Lyft on the day of."

## Versions

| Repo | Stack | Status |
|---|---|---|
| rice-apps/carpool, carpool-angular, carpool-expressjs | Angular/Express | 2015–2019, dead |
| rice-apps/Carpool-V2 | React + GraphQL + Mongo | 2020 |
| rice-apps/Carpool-V3 | React (CRA, MUI) + Apollo/GraphQL + Mongo, Rice CAS SSO | **live at carpool.riceapps.org** |
| rice-apps/carpool4 | Next.js + Go (Connect RPC) + Supabase, Google sign-in restricted to `hd=rice.edu` | rewrite in progress (Nov 2026), many RPCs still `TODO(student)` |

## Live product (V3)

Screens: landing ("Find and coordinate rides with other students – all in one
place", one button "Start Riding") → Find Rides (departure, destination, date
filters; "Matching rides", then "All open rides" cards: date/time, from, to,
"N seats left") → Ride summary (route with addresses, date/time, seats left,
host, riders, notes, Join Ride) → Create ride (from, to, date+time in CST, notes
placeholder "e.g. flight time, Rice meetup location, etc.", "# of seats (include
yourself)") → Your rides (upcoming/past) → Profile (name, college, phone, Venmo).

Places (curated, not free text): Rice, Hobby (HOU), IAH, Galleria, Target,
H-E-B, and catch-alls "Houston / Austin / Dallas / San Antonio [specify address
in notes]". In practice the open rides are almost all Rice → IAH.

Data model: `Ride { departureDate, departureLocation, arrivalLocation, owner,
riders[], notes, spots (default 3, includes owner) }`, `User { netid, firstName,
lastName, college, phone, venmo }`, `Location { title, address }`.

Rules in V3 code:
- Ride full when `riders.length == spots`; join rejected with "Sorry, this ride is already full."
- Join/leave emails the owner ("X joined your ride").
- Leaving: if you were the last rider the ride is deleted; if the owner leaves,
  ownership passes to the next rider (done by the client, not the server).
- Phone is required at onboarding (digits only); Venmo optional.
- Search only shows rides after "now"; date filter matches the calendar day.

carpool4 (the rewrite) tightens this: owner is an occupant and counts toward
capacity; departure must be in the future; locations must differ; notes ≤ 500;
capacity can't drop below occupants; cancelled rides are kept with a status;
guests see trip facts (time, places, seats) but no people; contacts (email,
phone) are visible only to people who share a ride.

## Lessons

1. **Privacy bug in the live app.** V3's GraphQL API answers anonymous queries
   for any ride's owner/riders with netid and phone number (checked: phone is
   returned without a token). The ride page also shows full names to anyone.
   We must enforce visibility in the database, not the client.
2. **Race on the last seat.** V3 checks "is full" and then `$addToSet` in two
   steps, so two people can take the last seat. Join must lock the ride row.
3. **Ownership transfer in the client** can leave orphaned rides if the tab
   closes mid-sequence. Do it in one server transaction.
4. **Too many places** dilute the list. Almost all real demand is campus ↔ airport.
5. **What made it good:** one primary action per screen, a short list of
   cards, seats-left front and centre, no chat, no payments.

## Georgia Tech specifics

- Email is `@gatech.edu` (students, staff). Some departments have subdomains
  (`cc.gatech.edu`, `ece.gatech.edu`, ...). Mail is Microsoft 365
  (`gatech-edu.mail.protection.outlook.com`), so "Sign in with Google, hd=gatech.edu"
  does not work, and Microsoft Entra sign-in into GT's tenant would need GT IT
  admin consent. The robust option is a one-time code sent to the GT address.
- Microsoft Defender Safe Links pre-fetches links in incoming mail, which
  consumes single-use magic links. So we send a 6-digit code, not a link.
- Airport: Hartsfield–Jackson (ATL) has two terminals ~10 min apart by road:
  Domestic (6000 N Terminal Pkwy) and International (2600 Maynard H. Jackson Jr.
  Blvd). Riders must agree which one, so they are separate places.
- Time zone: America/New_York for every displayed and entered time.
