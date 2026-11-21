import * as Cloud from './cloud.js';
import { sampleModel } from './data.js';
import {checkTestingAccess,allowsTestingStudy,mountTestingAccess} from './simulation-test-access.js?v=private-testing-20261027-1';
// Manual beta entitlements. Only hashes and expiry dates are public; never trust a local plan/paid flag.
export const BETA = Object.freeze({ name: 'SimuSite', email: 'plotcloudstudio@gmail.com', amount: 16.99, currency: 'CAD', period: 'month' });
// What is free (2026-11-15, as Pricing, Log in and the Terms say): Sun hours and Daylight on any project; every study on the
// example projects (Fallingwater, the hospital, the courtyard sample), to try before paying; every Resources tool. The other
// studies on a person's own projects need monthly access
export const FREE_STUDIES = Object.freeze(["sunhours", "daylight"]);
export const TRY_NOTE = 'Every study runs free on the example projects (Fallingwater, the hospital, the courtyard sample).';
// An example is free only while its building is the one it shipped with (2026-11-17). Its fingerprint: the 25 cm squares the walls'
// centre lines cross, level by level (the Workspace joins wall pieces that run on in a line when it opens a model, so the list of
// walls changes but these squares do not), and a hash of the levels, masses, imported pieces and sample blocks. Furniture and floor slabs are
// left out (moving furniture to try a study is fine; the Workspace adds a slab under rooms that have none). Drawing or importing your own building into an example, or duplicating it, makes it
// your own project. The fingerprint is set when the example is made or reopened.
const r2 = (v) => Math.round((+v || 0) * 100) / 100, CELL = 0.25;
export function fabricSig(model) {
  const s = (model && model.studio) || {}, rows = [], cells = new Set();
  for (const l of s.levels || []) rows.push(['L', l.id, r2(l.z)]);
  for (const m of s.masses || []) rows.push(['M', r2(m.x), r2(m.y), r2(m.w), r2(m.d), r2(m.h)]);
  for (const i of s.imports || []) rows.push(['I', i.id, i.tris || 0]);
  if (!(model && model.studio)) for (const c of (model && model.components) || []) if (c.g) rows.push(['C', c.type || '', r2(c.g.x), r2(c.g.y), r2(c.g.w), r2(c.g.d), r2(c.g.h)]);   // the sample's blocks; a plan model's blocks are derived from it
  for (const w of s.walls || []) { const a = w.a || [0, 0], b = w.b || [0, 0], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 0.1));
    for (let k = 0; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n; cells.add(`${w.lv}|${Math.floor(x / CELL)}|${Math.floor(y / CELL)}`); } }
  const txt = rows.map((r) => r.join(',')).sort().join(';');
  let h = 0x811c9dc5; for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return { v: 2, other: rows.length + ':' + h.toString(16), cells: [...cells].sort().join(' ') };
}
// the same building: the same levels and pieces, and walls on the same squares, give or take what the Workspace's tidying
// moves (a joined wall can shift by a centimetre or two): at most 6 squares more (a wall of about 1.5 m) and 5 % fewer
function sameFabric(want, got) {
  if (!want || want.v !== 2 || want.other !== got.other) return false;
  const W = new Set(want.cells ? want.cells.split(' ') : []), G = new Set(got.cells ? got.cells.split(' ') : []);
  let more = 0, fewer = 0; for (const c of G) if (!W.has(c)) more++; for (const c of W) if (!G.has(c)) fewer++;
  return more <= 6 && fewer <= Math.max(6, W.size * 0.05);
}
let sampleSigs = null;
const expectedSigs = (p) => p.trySig ? [p.trySig] : p.sample ? (sampleSigs ||= ['A', 'B'].map((v) => fabricSig(sampleModel(v)))) : [];
// model: the model a run uses (a saved version in a batch); by default the project's working draft
export const isTryProject = (p, model) => { if (!p || p.copyOf || !(p.caseStudy || p.sample)) return false; const got = fabricSig(model || p.draft); return expectedSigs(p).some((w) => sameFabric(w, got)); };
// served from this computer (development and the browser tests): every study open, unless pc-dev-gate is 1 to try the gate
const devOpen = () => { try { return typeof location !== 'undefined' && /^(127\.0\.0\.1|localhost)$/.test(location.hostname) && localStorage.getItem('pc-dev-gate') !== '1'; } catch { return false; } };
const KEY = 'pc-beta-access-code-v1';
let serverChecked=0,serverUser='',serverInflight=null,leaseDeadline=0;
let verified = { active: false, reason: 'code-required' }, lastCode = '', checked = 0, inflight = null, generation = 0;
// every Resources tool is free (2026-11-01): resource:<tool> needs no beta access
export const isFreeStudy = id => FREE_STUDIES.includes(id) || String(id).startsWith('resource:');
const readCode = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export const normalizeCode = value => String(value || '').replace(/\s+/g, '').toUpperCase();
export function status() { return { ...verified, active: verified.active && (verified.source==='account' ? performance.now()<leaseDeadline : Date.parse(verified.expiresAt)>Date.now()) }; }
export const canUse = (id, p, model) => isFreeStudy(id) || (isTryProject(p, model) && !String(id).startsWith('resource:')) || status().active || allowsTestingStudy(id) || devOpen();
export const paidNote = (name) => `${name} on your own projects needs monthly access. Sun hours and Daylight are free on every project, and every study runs free on the example projects.`;
export async function hashCode(value) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizeCode(value))); return [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, '0')).join(''); }
export function matchingGrant(ledger, digest, now = Date.now()) {
  if (ledger?.schema !== 1 || !Array.isArray(ledger.grants)) return null;
  return ledger.grants.find(g => g.codeHash === digest && g.plan === 'beta-monthly' && !g.revokedAt && Number.isFinite(Date.parse(g.startsAt)) && Date.parse(g.startsAt) <= now && Number.isFinite(Date.parse(g.expiresAt)) && now < Date.parse(g.expiresAt)) || null;
}
export async function checkAccess({ force = false, code = readCode() } = {}) {
  await checkTestingAccess({force});
  if(Cloud.configured()){
    const uid=Cloud.user()?.id;
    if(!uid){generation++;verified={active:false,reason:'login-required',source:'account'};serverUser='';leaseDeadline=0;return status();}
    if(serverUser===uid&&!force&&serverInflight)return serverInflight;
    if(serverUser===uid&&!force&&performance.now()-serverChecked<15000)return status();
    if(serverUser!==uid){serverChecked=0;leaseDeadline=0;verified={active:false,source:'account',reason:'verifying'};}
    serverUser=uid;const epoch=++generation;
    const task=(async()=>{try{const grant=await Cloud.rpc('pc_access_status');if(epoch!==generation)return{active:false,reason:'superseded'};const permanent=grant.accessType==='permanent'&&grant.expiresAt===null,remaining=permanent?30000:Date.parse(grant.expiresAt)-Date.parse(grant.serverNow);leaseDeadline=performance.now()+Math.min(30000,Math.max(0,remaining||0));verified={...grant,source:'account',accountId:uid,active:grant.active===true&&remaining>0};}catch{if(epoch!==generation)return{active:false,reason:'superseded'};leaseDeadline=0;verified={active:false,reason:'verification-unavailable',source:'account'};}serverChecked=performance.now();return status();})();serverInflight=task;try{return await task;}finally{if(serverInflight===task)serverInflight=null;}
  }
  code = normalizeCode(code);
  if (!/^PCBET-[A-F0-9]{48}$/.test(code)) { generation++; verified = { active: false, reason: code ? 'invalid-code' : 'code-required' }; lastCode = code; return status(); }
  if (!force && inflight && lastCode === code) return inflight;
  if (!force && lastCode === code && Date.now() - checked < 15000) return status();
  if (lastCode !== code) { verified = { active: false, reason: 'verifying' }; checked = 0; }
  lastCode = code; const epoch = ++generation;
  const operation = (async () => {
    try {
      const url = new URL('../beta-access-ledger.json', import.meta.url); url.searchParams.set('v', String(Date.now()));
      const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw Error('Access could not be verified. Check your connection and try again.');
      const grant = matchingGrant(await response.json(), await hashCode(code));
      if (epoch !== generation) return {active:false,reason:'superseded'};
      verified = grant ? { active: true, expiresAt: grant.expiresAt, startsAt: grant.startsAt, reference: grant.reference, reason: '' } : { active: false, reason: 'invalid-or-expired' };
    } catch { if (epoch !== generation) return {active:false,reason:'superseded'}; verified = { active: false, reason: 'verification-unavailable' }; }
    checked = Date.now(); return status();
  })();
  inflight = operation;
  try { return await operation; } finally { if (inflight === operation) inflight = null; }
}
export async function activateCode(value) {
  const code = normalizeCode(value), result = await checkAccess({ force: true, code });
  if (!result.active) throw Error(result.reason === 'verification-unavailable' ? 'Access could not be verified. Check your connection and try again.' : 'This code is invalid, not yet active, expired or revoked. Check the code in your confirmation email.');
  localStorage.setItem(KEY, code); dispatchEvent(new CustomEvent('pc-beta-access')); return result;
}
export function clearCode() { generation++; localStorage.removeItem(KEY); verified = { active: false, reason: 'code-required' }; checked = 0; dispatchEvent(new CustomEvent('pc-beta-access')); }
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const accessDate = value => new Date(value).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' });
export function requestURL(subject = 'SimuSite monthly access') {
  const body = `Hello SimuSite,\n\nMy registered SimuSite email: [enter the email used to log in].\n\nI would like one month of access at CAD 16.99, plus applicable taxes. Before I send an e-transfer, please confirm the total, required seller details, included access, exact access dates, activation timing and refund terms.\n\nMy registration / access email is: ${Cloud.user()?.email || ''}\n`;
  return 'mailto:' + BETA.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
}
export function mountActivation(host, { onSuccess = () => location.reload() } = {}) {
  if(Cloud.configured()){host.innerHTML=Cloud.user()?`<p>Registered email: <b>${esc(Cloud.user().email)}</b></p><p class="note">After verifying your payment, SimuSite grants access directly to this account. No activation code is needed. Reload after confirmation.</p><a class="btn" href="#/account">View account access</a>`:'<p>Use your confirmed registration email for the order. Access is granted to that account after payment verification.</p><a class="btn accent" href="#/login?signup=1">Register or log in</a>';return;}
  host.innerHTML = `<form class="beta-code-form" style="display:grid;gap:14px"><label class="f">Activation code<input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" required placeholder="PCBET-…"></label><button class="btn accent" type="submit">Activate monthly access</button><p class="note" role="status" aria-live="polite"></p></form>`;
  const form = host.querySelector('form'), message = form.querySelector('[role="status"]'), button = form.querySelector('button');
  form.onsubmit = async e => { e.preventDefault(); button.disabled = true; message.textContent = 'Verifying your code…'; try { const grant = await activateCode(new FormData(form).get('code')); message.textContent = 'Access active until ' + accessDate(grant.expiresAt); onSuccess(grant); } catch (error) { message.textContent = error.message; } finally { button.disabled = false; } };
}
export function renderGate(host, name = 'This tool') {
  host.innerHTML = `<div class="wrap resource-page"><a class="text-link" href="#/simulations">← Simulations</a><br><span class="eyebrow">Membership access</span><h1 class="display md" style="margin-top:18px">${esc(name)} requires<br>active access.</h1><p class="lede" style="margin-top:18px">Sun hours and Daylight are free on every project, and every study runs free on the example projects. The other studies on your own projects need monthly access.</p><div class="grid g2" style="margin-top:30px"><section class="card"><h2>Already received your code?</h2><p class="note">Enter the code sent after your e-transfer was verified. A payment email or a local account plan does not activate access.</p><div id="betaActivate"></div></section><section class="card"><h2>One month. Repeated use.</h2><p>CAD 16.99 for one calendar month, plus applicable taxes. No per-run charge for the included browser tools. No automatic renewal.</p><a class="btn accent" style="margin-top:20px" href="${esc(requestURL())}">Request payment details</a><p class="note" style="margin-top:14px">E-transfer recipient: ${BETA.email}. Wait for written order details before sending. Simulation results depend on the model, inputs and method. Review the stated limitations.</p><a href="#/pricing">View pricing and payment steps →</a></section></div><p class="note" style="margin-top:24px"><a href="#/simulations/sunhours">Open free Sun hours</a> · <a href="#/simulations/daylight">Open free Daylight</a> · <a href="#/legal/refunds">Refund policy</a></p></div>`;
  if(Cloud.configured()){
    const lead=host.querySelector('.lede');lead.textContent='Sun hours and Daylight are free on every project, and every study runs free on the example projects. The other studies on your own projects need an active account membership.';
    host.querySelector('h2').textContent='Your registered account';
    host.querySelector('#betaActivate').previousElementSibling.textContent='Access is linked to your confirmed registration email and expires automatically after the granted period.';
  }
  mountActivation(host.querySelector('#betaActivate'));
  const access=host.querySelector('#betaActivate');
  const retry=document.createElement('button'),message=document.createElement('p');
  retry.type='button';retry.className='btn';retry.id='betaRecheck';retry.textContent='Check access again';
  message.className='note';message.id='betaAccessStatus';message.setAttribute('role','status');
  const describe=()=>status().reason==='verification-unavailable'?'Access verification is temporarily unavailable. This does not mean your membership has expired. Check your connection and try again.':'No active resource access was found. If access was just granted, check again.';
  message.textContent=describe();access.after(retry,message);
  retry.onclick=async()=>{retry.disabled=true;message.textContent='Checking your access…';try{const result=await checkAccess({force:true});if(result.active)location.reload();else message.textContent=describe();}catch{message.textContent='Access could not be checked. Please try again.';}finally{retry.disabled=false;}};
  const testing=document.createElement('section');testing.className='card';testing.style.marginTop='24px';host.querySelector('.wrap').append(testing);mountTestingAccess(testing);
}
if (typeof window !== 'undefined') {
  window.PlotCloudBetaAccess = Object.freeze({ allows: canUse, status });
  addEventListener('pc-cloud',()=>{serverChecked=0;if(Cloud.user()?.id!==verified.accountId)leaseDeadline=0;if(Cloud.configured())checkAccess({force:true});});
  setInterval(()=>{if(Cloud.configured()&&document.visibilityState==='visible')checkAccess({force:true});},15000);
  addEventListener('storage', e => { if (e.key === KEY || e.key === null) { generation++; inflight = null; checked = 0; verified = { active: false, reason: 'code-required' }; dispatchEvent(new CustomEvent('pc-beta-access')); } });
}
