# GT Carpool

**Live: https://gtcarpool.vercel.app**

Split the Uber or Lyft between Georgia Tech and the Atlanta airport (ATL).

## How it works

1. **Sign in** with your `@gatech.edu` email. You get a 6-digit code; there's no password.
2. **Find a ride** going your way (campus → ATL Domestic/International, or back), or **post your own**.
3. **Join**, and everyone in the ride sees each other's contact info.
4. **Text your group**, meet up, and one person orders the ride. Split the fare however you like (Venmo, Zelle, cash).

You get an email when someone joins or leaves, and a reminder the day before you leave.
Rides can be open to anyone, women only, or men only. GT Carpool never books
rides or handles money. It just connects students.

## Docs

- Spec: [docs/SPEC.md](docs/SPEC.md)
- Plan: [docs/PLAN.md](docs/PLAN.md)
- Deployment: [docs/DEPLOY.md](docs/DEPLOY.md)

Built with Next.js, Supabase (Postgres + auth) and Vercel.

## Develop

Prerequisites: Node.js 22 and Docker.

```sh
npm ci
npm run db:start
cp .env.example .env.local
npx supabase status -o env
npm run dev
```

Copy `API_URL` and `PUBLISHABLE_KEY` from `supabase status -o env` into the
matching `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` entries in `.env.local`.

Run the checks with `npm run lint`, `npm run typecheck`,
`npm run format:check`, and `npm test`. Run the database tests with
`npm run test:db`, the concurrent database tests with `npm run test:db:race`,
and the desktop/mobile browser tests with `npm run test:e2e`.

Ride notification emails are drained primarily with Next.js `after()` after a
successful mutation. A Supabase `pg_cron` job queues day-before reminders every
10 minutes and pings the drain endpoint; the daily Vercel cron is a backstop.

### Database tests

Run `npm run db:reset` to recreate the local schema, `npm run test:db` for
pgTAP tests, and `npm run test:db:race` for concurrent RPC tests. Generate local
schema types with `npm run db:types`.
