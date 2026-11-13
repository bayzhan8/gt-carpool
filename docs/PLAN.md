# Execution plan

Each milestone is one PR to `main`, merged only with CI green. Each PR states
which `R-` IDs it implements and which tests cover them.

| # | Milestone | Done when |
|---|---|---|
| M0 | Scaffold: Next.js + Tailwind + Supabase local + Vitest + Playwright + pgTAP + CI workflow, design tokens, empty pages | `npm run lint typecheck test`, `supabase test db`, and a smoke e2e pass in CI |
| M1 | Database: places seed, profiles, rides, ride_members, RPCs for every §5 rule, §6 projections, auth domain hook, security inventory | pgTAP covers every SQL `R-` rule; concurrency test passes |
| M2 | Auth: `/signin` OTP flow, `/welcome`, return-to, sign out, middleware | e2e: non-GT rejected, sign-in, onboarding, return-to |
| M3 | Rides UI: browse, post (with duplicate hint), ride page, join/leave/cancel/edit, `/me` | e2e journeys in §10 pass desktop + mobile, axe clean |
| M4 | Polish: copy pass, empty/error states, Lighthouse, account deletion | Lighthouse bars met, delete-account e2e |
| M5 | Email notifications via outbox | pgTAP for outbox writes, e2e reads Mailpit |
| M6 | Deploy: Supabase cloud project, Resend SMTP, Vercel, domain | live URL, sign-in works with a real GT address |

Working agreements: migrations are never edited after merge; every PR adds or
updates tests for the rules it touches; no secrets in the repo.
