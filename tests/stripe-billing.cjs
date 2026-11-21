// Stripe billing function (2026-11-20), without network: Stripe, Supabase Auth and the database are stand-ins. Checks: the
// webhook rejects a missing, wrong or old signature; a checkout completion fetches the subscription and writes its paid period
// with the person's id; subscription updates and paid invoices are written; other events are ignored; a database failure answers
// 500 so Stripe retries; checkout needs a signed-in, confirmed person, creates one Stripe customer and reuses it; the portal opens
// for a customer and refuses someone without one; nothing works until the keys are set.
const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto');
(async () => {
  const code = fs.readFileSync('supabase/functions/stripe-billing/index.ts', 'utf8');
  const { createBillingHandler, verifyStripeSignature, periodEnd } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  const SECRET = 'whsec_test', NOW = 1_800_000_000, ENV = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_PRICE_ID: 'price_M', SITE_URL: 'https://simusites.com/mvp/', SUPABASE_URL: 'https://db.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'svc' };
  const sign = (body, t = NOW, secret = SECRET) => `t=${t},v1=` + crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  const calls = [], db = { customers: new Map(), applied: [] }; let dbFail = false;
  const USERS = { tokA: { id: 'uA', email: 'a@x.test', email_confirmed_at: '2026-01-01' }, tokB: { id: 'uB', email: 'b@x.test', email_confirmed_at: null } };
  const SUB = { id: 'sub_1', customer: 'cus_1', status: 'active', cancel_at_period_end: false, metadata: { user_id: 'uA' }, items: { data: [{ current_period_end: NOW + 30 * 86400 }] } };
  const fetchImpl = async (url, o = {}) => { const u = new URL(url); calls.push([o.method || 'GET', u.host + u.pathname, o.body ? String(o.body) : '']);
    const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s });
    if (u.host === 'db.test' && u.pathname === '/auth/v1/user') { const t = (o.headers.Authorization || '').slice(7); return USERS[t] ? J(USERS[t]) : J({ msg: 'bad' }, 401); }
    if (u.host === 'db.test') { assert.equal(o.headers.Authorization, 'Bearer svc', 'the database is called with the service key'); if (dbFail) return J({ message: 'down' }, 500); const a = JSON.parse(o.body), fn = u.pathname.split('/').pop();
      if (fn === 'pc_stripe_customer') return J(db.customers.get(a.p_user_id) || null); if (fn === 'pc_stripe_link') { db.customers.set(a.p_user_id, a.p_customer); return new Response(null, { status: 204 }); }
      if (fn === 'pc_stripe_apply') { db.applied.push(a); return J({ ok: true }); } }
    if (u.host === 'api.stripe.com') { assert.equal(o.headers.Authorization, 'Bearer sk_test_x');
      if (u.pathname === '/v1/subscriptions/sub_1') return J(SUB); if (u.pathname === '/v1/customers') return J({ id: 'cus_new' });
      if (u.pathname === '/v1/checkout/sessions') return J({ url: 'https://checkout.stripe.com/c/pay/x' }); if (u.pathname === '/v1/billing_portal/sessions') return J({ url: 'https://billing.stripe.com/p/x' }); }
    return J({ error: { message: 'unexpected ' + url } }, 404); };
  const h = createBillingHandler({ env: (k) => ENV[k], fetchImpl, now: () => NOW });
  const hook = (ev, sig) => { const body = JSON.stringify(ev); return h(new Request('https://fn.test/stripe-billing/webhook', { method: 'POST', headers: { 'Stripe-Signature': sig === undefined ? sign(body) : sig }, body })); };
  const post = (route, tok) => h(new Request('https://fn.test/stripe-billing/' + route, { method: 'POST', headers: { Origin: 'https://simusites.com', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) } }));

  // signatures
  const ev1 = { id: 'evt_1', type: 'checkout.session.completed', livemode: false, data: { object: { mode: 'subscription', subscription: 'sub_1', client_reference_id: 'uA' } } };
  assert.equal((await hook(ev1, '')).status, 400); assert.equal((await hook(ev1, sign('x'))).status, 400); assert.equal((await hook(ev1, sign(JSON.stringify(ev1), NOW - 600))).status, 400);
  assert.equal((await hook(ev1, sign(JSON.stringify(ev1), NOW, 'whsec_other'))).status, 400); assert.equal(db.applied.length, 0, 'nothing written for a bad signature');
  assert.equal(await verifyStripeSignature('p', `t=${NOW},v1=00,v1=` + crypto.createHmac('sha256', SECRET).update(`${NOW}.p`).digest('hex'), SECRET, NOW), true, 'any of several v1 signatures');
  console.log('PASS the webhook refuses a missing, wrong, old or other-secret signature; nothing is written');

  // events
  assert.equal((await hook(ev1)).status, 200); let a = db.applied.at(-1);
  assert.deepEqual([a.p_event_id, a.p_user_id, a.p_customer, a.p_subscription, a.p_status, a.p_period_end], ['evt_1', 'uA', 'cus_1', 'sub_1', 'active', new Date((NOW + 30 * 86400) * 1000).toISOString()]);
  assert.equal((await hook({ id: 'evt_2', type: 'customer.subscription.deleted', data: { object: { ...SUB, status: 'canceled', cancel_at_period_end: true, current_period_end: NOW + 86400 } } })).status, 200);
  a = db.applied.at(-1); assert.equal(a.p_status, 'canceled'); assert.equal(a.p_cancel_at_period_end, true); assert.equal(a.p_period_end, new Date((NOW + 86400) * 1000).toISOString(), 'the older API field is read too');
  assert.equal((await hook({ id: 'evt_3', type: 'invoice.paid', data: { object: { parent: { subscription_details: { subscription: 'sub_1' } } } } })).status, 200); assert.equal(db.applied.at(-1).p_event_id, 'evt_3', 'a paid invoice (2025 API shape) renews');
  const n = db.applied.length; const ign = await (await hook({ id: 'evt_4', type: 'charge.refunded', data: { object: {} } })).json(); assert.equal(ign.ignored, 'charge.refunded'); assert.equal(db.applied.length, n);
  dbFail = true; assert.equal((await hook({ id: 'evt_5', type: 'customer.subscription.updated', data: { object: SUB } })).status, 500, 'a database failure answers 500 so Stripe retries'); dbFail = false;
  console.log('PASS checkout completion, cancellation and a paid invoice are written with the person, customer, status and paid period; other events are ignored; a failure is retried');

  // checkout and portal
  assert.equal((await post('checkout')).status, 401); assert.equal((await post('checkout', 'nobody')).status, 401); assert.equal((await post('checkout', 'tokB')).status, 403, 'an unconfirmed email cannot pay');
  let r = await post('checkout', 'tokA'); assert.equal(r.status, 200); assert.equal((await r.json()).url, 'https://checkout.stripe.com/c/pay/x'); assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://simusites.com');
  const ck = calls.filter((c) => c[1] === 'api.stripe.com/v1/checkout/sessions').at(-1)[2]; const q = new URLSearchParams(ck);
  assert.equal(q.get('mode'), 'subscription'); assert.equal(q.get('customer'), 'cus_new'); assert.equal(q.get('client_reference_id'), 'uA'); assert.equal(q.get('line_items[0][price]'), 'price_M'); assert.equal(q.get('subscription_data[metadata][user_id]'), 'uA');
  assert.equal(q.get('success_url'), 'https://simusites.com/mvp/#/pricing?paid=1');
  await post('checkout', 'tokA'); assert.equal(calls.filter((c) => c[1] === 'api.stripe.com/v1/customers').length, 1, 'one Stripe customer per person, reused');
  r = await post('portal', 'tokA'); assert.equal((await r.json()).url, 'https://billing.stripe.com/p/x');
  USERS.tokC = { id: 'uC', email: 'c@x.test', email_confirmed_at: '2026-01-01' }; assert.equal((await post('portal', 'tokC')).status, 404, 'no portal without a card subscription');
  console.log('PASS checkout needs a signed-in, confirmed person, opens a monthly subscription for them and reuses their Stripe customer; the portal opens only for a customer');

  const off = createBillingHandler({ env: (k) => (k === 'STRIPE_SECRET_KEY' ? '' : ENV[k]), fetchImpl, now: () => NOW });
  assert.equal((await off(new Request('https://fn.test/stripe-billing/checkout', { method: 'POST' }))).status, 503); assert.equal((await h(new Request('https://fn.test/stripe-billing/checkout'))).status, 405);
  assert.equal(periodEnd({}), null);
  console.log('PASS without the keys every route says card payments are not set up; GET is refused');
})().catch((e) => { console.error(e); process.exit(1); });
