// The SimuSite backend: a Supabase project (accounts, and a cloud copy of each signed-in person's projects).
// Public project configuration supplied by the owner. Publishable and legacy anon keys are supported.
// Apply both account and membership migrations in SQL Editor (see supabase/README.md).
// This key is meant to be public: Row Level Security lets each signed-in person reach only their own rows.
// Never put the service_role key here. Left empty, the site works as before, with everything in the browser only.
export const SUPABASE_URL = 'https://cgxszynizkbiblfiaowf.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_QoFbrCcwwUbFcj1xNbHFaQ_8VOnx_43';
// Card subscriptions through Stripe (supabase/functions/stripe-billing). Turn on only after the Stripe keys are in the
// function's secrets and a test-card run has passed; until then the pricing page offers e-transfer only.
export const CARD_CHECKOUT = false;
