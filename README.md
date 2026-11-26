# Haidilao Food Sampling Survey

A React, Vite, and TypeScript frontend for the five products in the supplied food sampling PDF. Guests use `/` and staff sign in at `/admin`. Supabase stores submissions and applies staff permissions in the database.

## Connect Supabase

1. Open your Supabase project's SQL Editor and run [the migration](supabase/migrations/20261126000100_tasting_survey.sql) once. If you manage Supabase through its CLI, apply the migration through your normal deployment workflow instead.
2. Create a staff account in **Authentication → Users**. Copy the account's UUID and run the following in SQL Editor with the actual UUID.

   ```sql
   insert into public.tasting_admins (user_id)
   values ('00000000-0000-0000-0000-000000000000')
   on conflict do nothing;
   ```

   Add one row per staff member. Delete the corresponding allowlist row to revoke access. Guests do not need Supabase accounts. On a project dedicated to this survey, you can disable public signups in Supabase Auth.
3. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from your Supabase project. A legacy anon key also works. Use a publishable or anon key in the frontend.

## Run locally

```sh
npm ci
npm run dev
```

## Deploy

Set the two Vite variables in the static host's build environment. Set the project root to this directory, the build command to `npm run build`, and the output directory to `dist`. Configure the host to serve `index.html` for `/admin` and use HTTPS. Type `/admin` after the site domain in your browser to open staff sign-in.

Staff can filter by purchase intent or review status, open individual submissions, mark them reviewed, export filtered responses to CSV, and pause or reopen survey collection. Dashboard timestamps use Manila time. CSV timestamps use UTC.

Guest submissions are public and unauthenticated. The migration validates submissions and deduplicates retries by submission ID. It does not enforce one response per person.

Brand background: [Haidilao's official site](https://www.haidilao.com/about/) and its [product tasting and development article](https://www.haidilao.com/article/8353).

Hot pot photo source: [Pandaily’s Haidilao coverage](https://archive.pandaily.com/haidilao-to-reopen-stores-closed-for-cost-reductions/).
