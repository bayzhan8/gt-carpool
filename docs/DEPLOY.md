# Deploy GT Carpool

1. Create accounts on [Supabase](https://supabase.com/pricing) (Free),
   [Vercel](https://vercel.com/pricing) (Hobby), and
   [Resend](https://resend.com/pricing) (Free). Add a custom domain if you have
   one; it is optional.
2. Create a Supabase personal access token in Account Settings → Access Tokens,
   a Vercel token in Account Settings → Tokens, and a Resend API key in API
   Keys. Keep all three in your shell or password manager; never commit them.
   If your Supabase token can access several organizations, also set
   `SUPABASE_ORG_ID`.
3. From the repository root, run the deployment command:

   ```sh
   export SUPABASE_ACCESS_TOKEN="..."
   export VERCEL_TOKEN="..."
   export RESEND_API_KEY="..."
   # Optional:
   export DOMAIN="rides.example.edu"
   npx tsx scripts/deploy.ts
   ```

   Use `npx tsx scripts/deploy.ts --dry-run` first to print the plan without
   making network requests. The script creates or reuses the `gt-carpool`
   projects, applies database migrations and auth configuration, configures
   production environment variables, deploys, and runs smoke checks. When it
   creates a Supabase project it prints the generated database password once;
   save it securely for future migration pushes. On later runs against an
   existing project, set the saved `SUPABASE_DB_PASSWORD` in your shell so the
   migration push can connect.
   For local Supabase CLI commands before deployment, set
   `SUPABASE_PROJECT_REF=abcdefghijklmnopqrst`; the CLI resolves the production
   remote block while loading config even for local commands. The deploy script
   supplies the actual project ref automatically.
4. If you set `DOMAIN`, add the exact DNS records printed by Resend and Vercel
   at your registrar. The script waits up to ten minutes for the Resend sending
   domain to verify. Without `DOMAIN`, mail uses `onboarding@resend.dev`;
   Resend only delivers to the account owner's address until a domain is
   verified.
5. Verify sign-in with a real `@gatech.edu` address. Confirm the one-time code
   arrives, finish onboarding, and check that rides and notifications work.
6. To roll back the web deployment, run `vercel rollback`. Database migrations
   are forward-only: fix a schema issue with a new migration, not by reverting
   an already-applied migration.
7. Rotate credentials in the provider dashboard when needed, then update the
   corresponding shell/Vercel values and redeploy. Rotate the Supabase database
   password through Supabase and save the new value securely.

## Free-tier notes

- Supabase Free projects may pause after seven days of inactivity; resume the
  project in the Supabase dashboard if that happens.
- Vercel Hobby cron jobs run daily. Notification outbox delivery primarily
  happens through Next.js `after()` after an app mutation; the cron is a
  backstop.
