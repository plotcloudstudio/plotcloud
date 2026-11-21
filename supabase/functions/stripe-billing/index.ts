// Stripe billing for PlotCloud monthly access (2026-11-20). One function, three routes:
//   POST /checkout  (signed-in person) → a Stripe Checkout page for the monthly subscription
//   POST /portal    (signed-in person) → the Stripe Customer Portal (cancel, change card, invoices)
//   POST /webhook   (Stripe, signature checked) → the subscription's state written with pc_stripe_apply
// Secrets come from the function's environment, never from the browser: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID,
// SITE_URL; SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are set by Supabase. Card numbers never reach PlotCloud.
// Plain JavaScript (no type annotations) so the Node test can load it as it is.
const JSONH = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const TOLERANCE_S = 300;
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
function safeEqual(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

// Stripe-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "t.payload">[,v1=…]
export async function verifyStripeSignature(payload, header, secret, nowS = Math.floor(Date.now() / 1000)) {
  if (!secret || typeof header !== 'string' || header.length > 2000) return false;
  const parts = header.split(','), t = parts.find((p) => p.startsWith('t='))?.slice(2), sigs = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || !/^\d+$/.test(t) || !sigs.length || Math.abs(nowS - Number(t)) > TOLERANCE_S) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const want = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(t + '.' + payload)));
  return sigs.some((s) => safeEqual(s, want));
}
const form = (obj, pre = '', out = new URLSearchParams()) => { for (const [k, v] of Object.entries(obj)) { if (v == null) continue; const key = pre ? `${pre}[${k}]` : k; if (typeof v === 'object') form(v, key, out); else out.append(key, String(v)); } return out; };
// the end of the period paid for: on the subscription (older API versions) or on its item (2025 and later)
export const periodEnd = (sub) => { const s = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end; return Number.isFinite(s) ? new Date(s * 1000).toISOString() : null; };

export function createBillingHandler({ env = (k) => (typeof Deno !== 'undefined' ? Deno.env.get(k) : undefined), fetchImpl = fetch, now = () => Math.floor(Date.now() / 1000) } = {}) {
  const site = () => String(env('SITE_URL') || '').replace(/\/+$/, '');
  const cors = (req) => { const s = site(), allow = s ? new URL(s).origin : ''; return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', Vary: 'Origin' }; };
  const json = (req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...JSONH, ...(req ? cors(req) : {}) } });
  const stripe = async (method, path, params) => {
    const r = await fetchImpl('https://api.stripe.com/v1/' + path + (method === 'GET' && params ? '?' + form(params) : ''), { method, headers: { Authorization: 'Bearer ' + env('STRIPE_SECRET_KEY'), 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' }, body: method === 'GET' ? undefined : form(params || {}) });
    const b = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(b?.error?.message || 'Stripe HTTP ' + r.status), { stripe: true }); return b; };
  const rpc = async (name, args) => {
    const r = await fetchImpl(String(env('SUPABASE_URL')).replace(/\/+$/, '') + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: 'Bearer ' + env('SUPABASE_SERVICE_ROLE_KEY'), 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    const t = await r.text(); if (!r.ok) throw new Error('Database ' + r.status + ': ' + t.slice(0, 200)); return t ? JSON.parse(t) : null; };
  // the signed-in person, from their own Supabase token (a confirmed email is required to pay)
  const person = async (req) => {
    const auth = req.headers.get('Authorization') || ''; if (!/^Bearer [A-Za-z0-9._-]+$/.test(auth)) return null;
    const r = await fetchImpl(String(env('SUPABASE_URL')).replace(/\/+$/, '') + '/auth/v1/user', { headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: auth } });
    if (!r.ok) return null; const u = await r.json().catch(() => null); return u && u.id ? u : null; };
  const customerOf = async (u) => {
    let c = await rpc('pc_stripe_customer', { p_user_id: u.id }); if (c) return c;
    c = (await stripe('POST', 'customers', { email: u.email, metadata: { user_id: u.id } })).id; await rpc('pc_stripe_link', { p_user_id: u.id, p_customer: c }); return c; };
  const apply = (ev, sub, userId) => rpc('pc_stripe_apply', { p_event_id: ev.id, p_type: ev.type, p_user_id: userId || sub?.metadata?.user_id || null, p_customer: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id, p_subscription: sub.id, p_status: sub.status, p_period_end: periodEnd(sub), p_cancel_at_period_end: !!sub.cancel_at_period_end });

  return async (req) => {
    const path = new URL(req.url).pathname.replace(/\/+$/, ''), route = path.slice(path.lastIndexOf('/') + 1);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    if (req.method !== 'POST') return json(req, { error: 'Use POST.' }, 405);
    if (!env('STRIPE_SECRET_KEY') || !site()) return json(req, { error: 'Card payments are not set up yet. Use e-transfer, or try again later.' }, 503);
    try {
      if (route === 'webhook') {
        const payload = await req.text();
        if (payload.length > 512 * 1024 || !(await verifyStripeSignature(payload, req.headers.get('Stripe-Signature'), env('STRIPE_WEBHOOK_SECRET'), now()))) return json(null, { error: 'Invalid signature.' }, 400);
        const ev = JSON.parse(payload), o = ev?.data?.object || {};
        if (ev.livemode === false && env('STRIPE_LIVE_ONLY') === '1') return json(null, { ignored: 'test event' });
        if (ev.type === 'checkout.session.completed' && o.mode === 'subscription' && o.subscription) {
          const sub = await stripe('GET', 'subscriptions/' + o.subscription); await apply(ev, sub, o.client_reference_id || o.metadata?.user_id);
        } else if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(ev.type)) {
          await apply(ev, o);
        } else if (['invoice.paid', 'invoice.payment_failed'].includes(ev.type)) {
          const sid = o.subscription || o.parent?.subscription_details?.subscription; if (sid) await apply(ev, await stripe('GET', 'subscriptions/' + sid));
        } else return json(null, { ignored: ev.type });
        return json(null, { ok: true });
      }
      const u = await person(req); if (!u) return json(req, { error: 'Sign in to pay by card.' }, 401);
      if (route === 'checkout') {
        if (!u.email_confirmed_at && !u.confirmed_at) return json(req, { error: 'Confirm your registration email first, then subscribe.' }, 403);
        const s = await stripe('POST', 'checkout/sessions', { mode: 'subscription', customer: await customerOf(u), client_reference_id: u.id,
          line_items: { 0: { price: env('STRIPE_PRICE_ID'), quantity: 1 } }, subscription_data: { metadata: { user_id: u.id } }, metadata: { user_id: u.id },
          success_url: site() + '/#/pricing?paid=1', cancel_url: site() + '/#/pricing?paid=0', allow_promotion_codes: 'false', billing_address_collection: 'auto' });
        return json(req, { url: s.url });
      }
      if (route === 'portal') {
        const c = await rpc('pc_stripe_customer', { p_user_id: u.id }); if (!c) return json(req, { error: 'No card subscription on this account.' }, 404);
        const s = await stripe('POST', 'billing_portal/sessions', { customer: c, return_url: site() + '/#/pricing' }); return json(req, { url: s.url });
      }
      return json(req, { error: 'Unknown billing route.' }, 404);
    } catch (e) {
      // Stripe retries a webhook that fails: a database or Stripe error answers 500 so the event comes again
      return json(route === 'webhook' ? null : req, { error: e && e.stripe ? 'The payment service did not accept the request. Try again later.' : 'Billing is unavailable. Try again later.' }, 500);
    }
  };
}
if (typeof Deno !== 'undefined') Deno.serve(createBillingHandler());
