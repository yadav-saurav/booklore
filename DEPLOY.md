# Deploying BOOKLORE

BOOKLORE is a standard Next.js app plus any Postgres 14+ database. The database is provider-agnostic: only `DATABASE_URL` changes. On first connection the app creates its tables automatically, and `npm run db:prepare` loads the sample catalog when the database is empty. It never overwrites existing data.

| Combination | App host | Database | Notes |
|---|---|---|---|
| **A** | Vercel (Hobby) | Neon | Recommended. Both have free tiers; auto-deploys from GitHub. |
| **B** | Vercel (Hobby) | Supabase | Use Supabase's *transaction pooler* URL. |
| **C** | Render | Render Postgres | One-click Blueprint (`render.yaml`). Free web services sleep when idle. |
| **D** | Render / Railway / Fly / any Node host | Neon or Supabase | `npm run build && npm start`. |

> Free-tier limits and terms change. Check each provider's current pricing page.

---

## A. Vercel + Neon
1. **Create the database.** Go to [neon.tech](https://neon.tech), create a project, then copy the **pooled** connection string. It ends with `?sslmode=require`.
2. **Create the Vercel project.** Go to [vercel.com/new](https://vercel.com/new), import the GitHub repository and keep the Next.js defaults.
3. **Add the database URL.** Under Settings → Environment Variables, add `DATABASE_URL` with the Neon string for Production, Preview and Development.
4. **Deploy.** Vercel runs the `vercel-build` script automatically. It creates the tables, seeds the catalog on the first deploy only, then builds the app.

Alternative: in Vercel, go to Storage → Create Database → Neon. That sets `DATABASE_URL` for you.

## B. Vercel + Supabase
1. **Create the database.** Go to [supabase.com](https://supabase.com), create a project, then open **Connect → Transaction pooler** and copy the URI (port `6543`). Replace `[YOUR-PASSWORD]` with your database password.
2. **Deploy.** Follow steps 2–4 of A, using the Supabase URI as `DATABASE_URL`.

The app disables prepared statements (`prepare: false`), so it works through Supabase's and Neon's PgBouncer poolers.

## C. Render (app + database)
1. Go to [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint**, then select the repository.
2. Render reads `render.yaml`, creates a free Postgres database and a free web service, and wires `DATABASE_URL` between them.
3. The build runs `npm run db:prepare` (tables plus first-time seed) and then `npm run build`. The start command is `npm start`.

To use Neon or Supabase with Render instead, delete the `databases:` block in `render.yaml` and set `DATABASE_URL` manually.

## Seeding and resetting
```bash
DATABASE_URL="postgres://…" npm run db:prepare   # seed only if empty (safe)
DATABASE_URL="postgres://…" npm run db:seed      # WIPE everything and reseed sample data
```

## Local development
```bash
npm install
npm run db:seed    # embedded PGlite in ./data/pglite, no Postgres install needed
npm run dev
```
- Stop `npm run dev` before running `npm run db:seed`: PGlite allows one process at a time.
- To develop against a real Postgres instead, put `DATABASE_URL` in `.env.local`.
- Behind an HTTPS proxy, run Node with `NODE_USE_ENV_PROXY=1` so the Open Library and Google Books calls go through it.

## Environment variables
See `.env.example`. Only `DATABASE_URL` is required in production. `GOOGLE_BOOKS_API_KEY` is optional and raises the free Google Books quota.
