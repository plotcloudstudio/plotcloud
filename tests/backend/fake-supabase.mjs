// A local stand-in for a hosted Supabase project, for tests only: /auth/v1 (sign up, password sign-in, refresh, magic link, user,
// sign out) is implemented here; /rest/v1 is forwarded to a real PostgREST on a real Postgres with the PlotCloud migration and its
// Row Level Security. Tokens are HS256 JWTs with role "authenticated" and the user's id as "sub", as Supabase issues them, so the
// database sees exactly what it would see on Supabase. Not for production: no rate limits, no email sending, no password rules
// beyond length.
// Env: PORT (54321), POSTGREST (http://127.0.0.1:54330), JWT_SECRET, PGPORT (54329), PGHOST (/tmp), PGDATABASE (plotcloud),
//      CONFIRM=1 to require email confirmation on sign-up (no session until the emailed link is used).
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const PORT = +(process.env.PORT || 54321), PGRST = process.env.POSTGREST || 'http://127.0.0.1:54330', SECRET = process.env.JWT_SECRET || 'local-test-secret-at-least-32-characters-long!!';
const PG = ['-h', process.env.PGHOST || '/tmp', '-p', process.env.PGPORT || '54329', '-U', 'postgres', '-d', process.env.PGDATABASE || 'plotcloud', '-tA', '-v', 'ON_ERROR_STOP=1'];
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
export const jwt = (payload) => { const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64(payload); return `${h}.${p}.${crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`; };
const verify = (t) => { try { const [h, p, s] = String(t).split('.'); if (crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url') !== s) return null; const c = JSON.parse(Buffer.from(p, 'base64url')); return c.exp && c.exp * 1000 < Date.now() ? null : c; } catch { return null; } };
export const ANON_KEY = jwt({ role: 'anon', iss: 'supabase-local', iat: 1700000000, exp: 4102444800 });
const sql = (text, vars = {}) => { const args = [...PG]; for (const [k, v] of Object.entries(vars)) args.push('-v', `${k}=${v}`); const r = spawnSync('psql', args, { input: text, encoding: 'utf8' }); if (r.status) throw new Error(r.stderr); return r.stdout.trim(); };
const hash = (pw, salt = crypto.randomBytes(16).toString('hex')) => `${salt}:${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
const userRow = (where, vars) => { const out = sql(`select json_build_object('id', id, 'email', email, 'pw', encrypted_password, 'meta', raw_user_meta_data, 'created_at', created_at) from auth.users where ${where};`, vars); return out ? JSON.parse(out) : null; };
const pub = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, user_metadata: u.meta || {}, created_at: u.created_at });
const refresh = new Map(), confirmations = new Map(); let lastLink = null;
function session(u) {
  const now = Math.floor(Date.now() / 1000), expires_in = +(process.env.TOKEN_TTL || 3600), rt = crypto.randomBytes(24).toString('base64url'); refresh.set(rt, u.id);
  return { access_token: jwt({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, iat: now, exp: now + expires_in }), token_type: 'bearer', expires_in, expires_at: now + expires_in, refresh_token: rt, user: pub(u) };
}
const cors = (res) => { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, content-type, prefer, range, accept-profile, content-profile, x-client-info'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS'); res.setHeader('Access-Control-Expose-Headers', 'content-range'); };
const send = (res, code, body) => { cors(res); res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
const readBody = (req) => new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); });

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x'); if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }
    if (url.pathname === '/__test/last-link') return send(res, 200, { link: lastLink });
    if (url.pathname === '/__test/expire') { refresh.clear(); return send(res, 200, {}); }
    if (req.headers.apikey !== ANON_KEY) return send(res, 401, { message: 'No API key found in request' });
    if (url.pathname.startsWith('/auth/v1/')) {
      const body = req.method === 'POST' ? JSON.parse((await readBody(req)).toString() || '{}') : {}, path = url.pathname.slice(9);
      if (path === 'signup') {
        const email = String(body.email || '').trim().toLowerCase(), pw = String(body.password || '');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { code: 400, error_code: 'validation_failed', msg: 'Unable to validate email address: invalid format' });
        if (pw.length < 6) return send(res, 422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.' });
        if (userRow(`email = :'email'`, { email })) return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
        const id = crypto.randomUUID(); sql(`insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values (:'id', :'email', :'pw', :'meta'::jsonb);`, { id, email, pw: hash(pw), meta: JSON.stringify(body.data || {}) });
        const u = userRow(`id = :'id'`, { id });
        if (process.env.CONFIRM === '1') { const s = session(u); lastLink = `${body.redirect_to || 'http://localhost/'}#access_token=${s.access_token}&expires_at=${s.expires_at}&expires_in=${s.expires_in}&refresh_token=${s.refresh_token}&token_type=bearer&type=signup`; return send(res, 200, pub(u)); }
        return send(res, 200, session(u));
      }
      if (path === 'token' && url.searchParams.get('grant_type') === 'password') {
        const u = userRow(`email = :'email'`, { email: String(body.email || '').trim().toLowerCase() }); if (!u) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
        const [salt] = u.pw.split(':'); if (hash(String(body.password || ''), salt) !== u.pw) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
        return send(res, 200, session(u));
      }
      if (path === 'token' && url.searchParams.get('grant_type') === 'refresh_token') {
        const id = refresh.get(body.refresh_token); if (!id) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token: Refresh Token Not Found' });
        refresh.delete(body.refresh_token); return send(res, 200, session(userRow(`id = :'id'`, { id })));
      }
      if (path === 'otp') {
        const email = String(body.email || '').trim().toLowerCase(); let u = userRow(`email = :'email'`, { email });
        if (!u) { const id = crypto.randomUUID(); sql(`insert into auth.users (id, email, encrypted_password) values (:'id', :'email', '');`, { id, email }); u = userRow(`id = :'id'`, { id }); }
        const s = session(u), to = url.searchParams.get('redirect_to') || body.redirect_to || 'http://localhost/';
        lastLink = `${to}#access_token=${s.access_token}&expires_at=${s.expires_at}&expires_in=${s.expires_in}&refresh_token=${s.refresh_token}&token_type=bearer&type=magiclink`; return send(res, 200, {});
      }
      const claims = verify(String(req.headers.authorization || '').replace(/^Bearer /, ''));
      if (path === 'user') { if (!claims?.sub) return send(res, 401, { code: 401, msg: 'invalid JWT' }); return send(res, 200, pub(userRow(`id = :'id'`, { id: claims.sub }))); }
      if (path === 'logout') { return send(res, 204); }
      return send(res, 404, { msg: 'Not found' });
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req), h = {};
      for (const k of ['authorization', 'prefer', 'content-type', 'range', 'accept']) if (req.headers[k]) h[k] = req.headers[k];
      if (!h.authorization) h.authorization = `Bearer ${ANON_KEY}`;
      const r = await fetch(PGRST + url.pathname.slice(8) + url.search, { method: req.method, headers: h, body });
      cors(res); const out = Buffer.from(await r.arrayBuffer()), hd = { 'Content-Type': r.headers.get('content-type') || 'application/json' }; if (r.headers.get('content-range')) hd['Content-Range'] = r.headers.get('content-range');
      res.writeHead(r.status, hd); return res.end(out);
    }
    send(res, 404, { message: 'Not found' });
  } catch (e) { send(res, 500, { message: String(e.message || e) }); }
}).listen(PORT, '127.0.0.1', () => console.log(`fake supabase on http://127.0.0.1:${PORT}\nANON_KEY=${ANON_KEY}`));
