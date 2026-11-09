# GT Carpool

Split the Uber to the airport with other Georgia Tech students. Post a trip or
join one; `@gatech.edu` email required.

- Spec: [docs/SPEC.md](docs/SPEC.md)
- Plan: [docs/PLAN.md](docs/PLAN.md)
- Research (Rice Carpool teardown): [docs/research.md](docs/research.md)
- Deployment: [docs/DEPLOY.md](docs/DEPLOY.md)

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
successful mutation. The scheduled Vercel cron is a daily backstop.

### Database tests

Run `npm run db:reset` to recreate the local schema, `npm run test:db` for
pgTAP tests, and `npm run test:db:race` for concurrent RPC tests. Generate local
schema types with `npm run db:types`.
