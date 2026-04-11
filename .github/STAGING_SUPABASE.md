# Staging Supabase (replica-style workflow)

Supabase does **not** provide a single “duplicate my production project” button. The standard approach is a **second project** (e.g. `strat101-staging`) that mirrors **schema** (and optionally **sanitized data**), wired to the **`staging`** Git branch via **Vercel Preview** environment variables.

## 1. Create the staging project

1. [Supabase Dashboard](https://supabase.com/dashboard) → **New project**.
2. Choose a **strong database password** and a **region** close to your users (ideally same region as production for similar behaviour).
3. Wait until the project is **healthy**.

Note the **Project URL** and **anon (public) key** under **Settings → API**.

## 2. Apply the same schema as production

This repo already has a migration under `supabase/migrations/` (e.g. `*_remote_schema.sql`).

**Option A — Supabase CLI (recommended if you use it for prod)**

```bash
# Install CLI if needed: https://supabase.com/docs/guides/cli
cd /path/to/Strat101-Modular

# Log in and link the CLI to the NEW staging project (not production)
supabase link --project-ref <STAGING_PROJECT_REF>

# Push local migrations to staging
supabase db push
```

`<STAGING_PROJECT_REF>` is the short id in the staging project URL (`https://<ref>.supabase.co`).

**Option B — SQL Editor**

1. Staging project → **SQL Editor**.
2. Run the contents of `supabase/migrations/20260411131219_remote_schema.sql` (or your latest migration file), **or** use **Database → Migrations** if you prefer the dashboard workflow.

If anything fails (extensions, permissions), fix errors in staging first; production is unchanged.

## 3. Storage (attachments)

Production likely uses a bucket (e.g. `attachments` — see `App.tsx` / storage usage).

1. Staging → **Storage** → **New bucket** with the **same name** and public/private settings as production.
2. Reapply **RLS policies** on `storage.objects` to match production (copy from prod SQL or from your migration history if included).

Staging files will be **separate** from production; that is what you want.

## 4. Auth users (important)

`auth.users` and passwords are **not** fully copied by schema migrations alone.

- **Simplest:** Register **test users** on the staging app (same usernames/emails as prod if you like, but they are **different** accounts in the new project).
- **Advanced:** Use Supabase **Auth Admin API** or dashboard to invite users; avoid copying `auth` schema from prod unless you know the implications (secrets, tokens, compliance).

`tenant_users` rows that reference emails must exist and line up with how your **Login** flow resolves `username → email → signInWithPassword`.

## 5. Optional: copy a subset of data from production

Only if you need realistic rows (and you accept **PII / compliance** risk):

- Use **SQL export** for specific tables in production SQL Editor, or
- `pg_dump` / **logical backup** with a **data-only** dump for selected tables,

then import into staging (respect **foreign keys** — order tables correctly). Many teams use a **small anonymized seed** instead of a full copy.

**Never** point staging at production credentials in the frontend.

## 6. Link Vercel `staging` to the staging Supabase

1. Vercel → your project → **Settings → Environment Variables**.
2. Add or override for **Preview** (and optionally restrict to branch `staging` if your plan supports it):
   - `VITE_SUPABASE_URL` = `https://<staging-ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = staging **anon** key
3. Ensure **Production** environment still has **production** URL + anon key only.
4. **Redeploy** the latest deployment on branch `staging` (or push an empty commit) so the new variables apply.

After this, the **staging** preview URL uses the **staging database**; **production** stays on the live project.

## 7. Ongoing workflow

| Change              | Where to apply |
| ------------------- | -------------- |
| Schema / RLS        | Prefer **migrations** in this repo; `supabase db push` to staging first, validate, then production when ready. |
| App code            | Merge to `staging` → preview; then `main` → production. |

## 8. Supabase “Branching” (optional)

Supabase offers **database branching** on some plans; it is separate from Git branches. If you enable it, read the current docs for limits and pricing. A **second project** remains the clearest mental model for “staging DB + staging frontend.”
