# PlotCloud backend on Supabase

Accounts and a cloud copy of each person's projects. The website stays local-first: everything works in the browser as before, and
once someone signs in, their projects (with saved versions, simulation results and pictures) and their Account site and defaults are
copied to their own rows here and brought back on their other devices. Row Level Security makes every row readable and writable only
by the person who owns it.

## Set it up (about ten minutes)

1. **Create a project** at [supabase.com](https://supabase.com) (the free plan is enough to start). Pick a region near your users and
   keep the database password somewhere safe.
2. **Create the tables**: Dashboard › SQL Editor › New query › paste
   [`migrations/20261025000000_cloud_projects.sql`](migrations/20261025000000_cloud_projects.sql) › Run. It can be run again safely.
3. **Sign-in settings**: Authentication › URL Configuration
   - Site URL: `https://plotcloudstudio.github.io/plotcloud/mvp/`
   - Redirect URLs: add `https://plotcloudstudio.github.io/plotcloud/mvp/` (and `http://127.0.0.1:8765/mvp/` for local testing).
   - Authentication › Providers › Email: on. "Confirm email" on means new accounts get a link before their first sign-in (the site
     says so and waits); off means they are signed in at once.
   - The built-in email sender is limited to a few messages an hour; for real users set up your own SMTP (Authentication › SMTP).
4. **Connect the site**: Project Settings › API, copy the Project URL and the `anon` `public` key into
   [`mvp/js/backend-config.js`](../mvp/js/backend-config.js), commit and push. The anon key is designed to be public; never put the
   `service_role` key in the website.
   To try a project before publishing its keys, run this once in the browser console on the site:
   `localStorage.setItem('pc-cloud-config', JSON.stringify({ url: 'https://<project>.supabase.co', key: '<anon key>' }))`, then reload.

## What is stored

| Table | One row per | Holds |
|---|---|---|
| `cloud_projects` | project | the project without its versions' models: name, working draft, simulation runs (figures, pictures, per-point fields), site, settings |
| `cloud_versions` | saved version | the version's model (written once; saved versions are never changed) |
| `cloud_accounts` | person | the Account site and simulation defaults |

The sample project is not copied. A project over 24 MB (e.g. very large imported meshes) is not copied and the Account page says so.

**How changes meet** (in `mvp/js/cloud.js`): changed on this device only → sent; on another device only → brought back; on both since
the last sync → this device's copy is kept and the other comes back as "… (from another device)", so nothing is lost; deleted on one
device → deleted on the others. Sync runs after sign-in, a few seconds after each change, when the tab comes back into view, and every
two minutes while it is open.

## Checked locally

`tests/mvp-cloud.cjs` (23 checks) runs the site against a local stand-in for a Supabase project: real PostgreSQL 16 with this
migration and its Row Level Security, real PostgREST 12, and an auth gateway that issues Supabase-style tokens
(`tests/backend/local-backend.sh start`; `tests/backend/fake-supabase.mjs`). It covers sign-up, a wrong password, two devices
sharing a project with its version, results and pictures, a change on each device, a change on both, deletion, a second person who
sees nothing of the first, an expiring token refreshed, an emailed sign-in link (same tab and new tab), signing out (projects stay in
the browser), and a site without a backend. It has not been run against a hosted Supabase project yet: do that once with your keys.

## Not done yet

- Password reset and email change pages (Supabase sends the emails; the site has no page to finish them yet).
- Deleting the login itself: "Delete account" removes the person's projects from the cloud and the browser, but removing the auth
  user needs the service key (Dashboard › Authentication › Users, or a small Edge Function later).
- Sharing projects with other people, real-time co-editing, payments and plan limits.
- Free-plan limits: 500 MB database, projects paused after a week without activity. Upgrade before real users depend on it.
