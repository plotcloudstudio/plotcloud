// The PlotCloud backend: a Supabase project (accounts, and a cloud copy of each signed-in person's projects).
// Fill in the project's URL and its anon (public) key from Supabase › Project Settings › API, after running
// supabase/migrations/20261025000000_cloud_projects.sql in its SQL Editor (see supabase/README.md).
// The anon key is meant to be public: Row Level Security lets each signed-in person reach only their own rows.
// Never put the service_role key here. Left empty, the site works as before, with everything in the browser only.
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
