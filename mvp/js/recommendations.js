// Executable recommendations and "adopt and run Plan B" (replan item 09, plan §7, AC18–AC19).
// One rule is connected: a daylight result below the project's own daylight target proposes resizing one identified window,
// within its host wall. The daylight engine (emb/daylight.html, via studio-convert.js) reads window width and head height,
// so the patch changes a real solver input. No improvement is promised before the rerun; only the expected direction is shown.
// The transaction: check the basis is current → derive plan B from the fixed A revision → apply the patch to a copy of A's model
// → save B's version and revision → create a run group for the affected studies already in A's study package. A is untouched.
// Running the group uses the existing browser batch (batch.js): the page must stay open; a hosted queue is not connected.
import * as C from './project-contract.js';
import * as P from './parameters.js';
import { hashOf } from './contract-hash.js';

export const RULE = 'plotcloud-rule-daylight-window@2026-10-30.1';
export const WINDOW_STUDIES = ['daylight', 'vent', 'views', 'privacy'];   // engines that read window geometry
const clone = (x) => JSON.parse(JSON.stringify(x));
const now = () => new Date().toISOString();
const r3 = (v) => Math.round(v * 1000) / 1000;
const overlap = (g, W) => Math.max(0, Math.min(g.x + g.w, W.x + W.w) - Math.max(g.x, W.x)) * Math.max(0, Math.min(g.y + g.d, W.y + W.d) - Math.max(g.y, W.y));
export function hostWall(model, win) { return model.components.filter((c) => c.type === 'wall').map((w) => [w, overlap(win.g, w.g)]).filter(([, a]) => a > 0).sort((a, b) => b[1] - a[1])[0]?.[0] || null; }

// ---- patches: a whitelist with preconditions and geometric constraints
export function applyPatch(model, patch) {
  if (patch.op !== 'window.resize') throw Error(`Patch operation ${patch.op} is not supported.`);
  const m = clone(model), win = m.components.find((c) => c.id === patch.id && c.type === 'window');
  if (!win) throw Error('The window this change was based on is no longer in the model.');
  if (JSON.stringify(win.g) !== JSON.stringify(patch.from)) throw Error('The window has changed since this suggestion was made.');
  const wall = hostWall(m, win); if (!wall) throw Error('The window has no host wall.');
  const t = patch.to, alongX = wall.g.w >= wall.g.d, lo = alongX ? wall.g.x : wall.g.y, hi = lo + (alongX ? wall.g.w : wall.g.d), a = alongX ? t.x : t.y, len = alongX ? t.w : t.d;
  if (!(len >= 0.3) || a < lo + 0.1 - 1e-9 || a + len > hi - 0.1 + 1e-9) throw Error('The resized window would leave its host wall.');
  if (!(t.h >= 0.3) || t.z < wall.g.z || t.z + t.h > wall.g.z + wall.g.h - 0.1 + 1e-9) throw Error('The resized window would exceed the wall height.');
  const others = openingsOn(m, wall).filter((c) => c.id !== win.id), span = (g) => (alongX ? [g.x, g.x + g.w] : [g.y, g.y + g.d]);
  for (const o of others) { const [p0, p1] = span(o.g), vz = Math.min(t.z + t.h, o.g.z + o.g.h) - Math.max(t.z, o.g.z); if (Math.min(a + len, p1) - Math.max(a, p0) > -0.1 + 1e-9 && vz > 0) throw Error(`The resized window would overlap “${o.name || o.id}”.`); }
  win.g = { ...t };
  return m;
}
// windows and doors whose host is this wall
export const openingsOn = (model, wall) => model.components.filter((c) => (c.type === 'window' || c.type === 'door' || /door/i.test(c.name || '')) && c.g && hostWall(model, c)?.id === wall.id);
export function undoPatch(patch) { return { ...patch, from: patch.to, to: patch.from }; }

// ---- the rule: daylight factor below the project's target
export function recommend(p, run, model) {
  if (!run || run.simId !== 'daylight') return { status: 'no-basis', text: 'Run Daylight on a saved version first.' };
  const target = P.resolve(p, { path: 'target.daylight.meanDF' });
  if (target.status !== 'ok') return { status: 'needs-target', text: 'Set the project daylight target (mean daylight factor) to get a recommendation. PlotCloud does not assume one.' };
  const df = run.results?.df, field = run.results?.field;
  if (!C.revision(p, run.planRevisionId) || C.revision(p, run.planRevisionId).legacy) return { status: 'no-basis', text: 'This daylight result was saved before its conditions were recorded. Rerun Daylight to get a suggestion.' };
  if (!Number.isFinite(df)) return { status: 'no-basis', text: 'This daylight result has no average daylight factor.' };
  if (df >= target.value) return { status: 'meets', text: `Average daylight factor ${df.toFixed(1)} % meets the project target of ${target.value} %. No change proposed.` };
  if (!field?.pts?.length) return { status: 'no-basis', text: 'The per-point daylight field of this result was removed to save space. Rerun Daylight to locate low-daylight areas.' };
  const low = []; for (let i = 0; i < field.pts.length; i += 3) if (field.pts[i + 2] < target.value) low.push([field.pts[i], field.pts[i + 1]]);
  const cx = low.reduce((s, q) => s + q[0], 0) / low.length, cy = low.reduce((s, q) => s + q[1], 0) / low.length;
  const wins = model.components.filter((c) => c.type === 'window' && hostWall(model, c)).map((c) => ({ c, d: Math.hypot(c.g.x + c.g.w / 2 - cx, c.g.y + c.g.d / 2 - cy) })).sort((a, b) => a.d - b.d);
  if (!wins.length) return { status: 'no-basis', text: 'No window with a host wall was found near the low-daylight area.' };
  // first window that can actually grow: wider by up to 0.8 m inside its wall (0.1 m margins), else a taller head
  for (const { c } of wins) {
    const wall = hostWall(model, c), g = c.g, alongX = wall.g.w >= wall.g.d, lo = (alongX ? wall.g.x : wall.g.y) + 0.1, hi = (alongX ? wall.g.x + wall.g.w : wall.g.y + wall.g.d) - 0.1;
    let a0 = lo, a1 = hi; const a = alongX ? g.x : g.y, len = alongX ? g.w : g.d;
    for (const o of openingsOn(model, wall)) { if (o.id === c.id) continue; const s0 = alongX ? o.g.x : o.g.y, s1 = s0 + (alongX ? o.g.w : o.g.d); if (s1 <= a) a0 = Math.max(a0, s1 + 0.1); else if (s0 >= a + len) a1 = Math.min(a1, s0 - 0.1); }
    const grow = Math.min(0.8, a1 - a0 - len);
    let to = null;
    if (grow >= 0.2) { const na = Math.max(a0, Math.min(a - grow / 2, a1 - len - grow)); to = alongX ? { ...g, x: r3(na), w: r3(len + grow) } : { ...g, y: r3(na), d: r3(len + grow) }; }
    else { const room = wall.g.z + wall.g.h - 0.1 - (g.z + g.h); if (room >= 0.2) to = { ...g, h: r3(g.h + Math.min(0.4, room)) }; }
    if (!to) continue;
    const base = C.revision(p, run.planRevisionId);
    const studies = [...new Set(p.runs.filter((r) => r.versionId === run.versionId && WINDOW_STUDIES.includes(r.simId)).map((r) => r.simId))];
    const patch = { op: 'window.resize', id: c.id, name: c.name, from: clone(g), to };
    const rec = { rule: RULE, title: `Enlarge “${c.name}” (${grow >= 0.2 ? 'wider by ' + r3(grow) + ' m' : 'taller head'})`, patch,
      evidence: { runId: run.id, metric: 'df', value: df, target: target.value, targetSource: target.label, targetRecordId: target.recordId, lowPoints: low.length, ofPoints: field.pts.length / 3, lowCentroid: [r3(cx), r3(cy)] },
      basis: { revisionId: run.planRevisionId, versionId: run.versionId, physicalHash: base?.physicalHash || null, modelHash: base?.modelHash || null },
      expected: 'Higher daylight factor near this window is expected. More solar gain and glare are possible; neither is evaluated by this rule.',
      studies, undo: undoPatch(patch) };
    rec.id = 'rec-' + hashOf({ rule: RULE, patch, basis: rec.basis }).slice(0, 16);   // the same suggestion on the same basis has one id
    return { status: 'ok', recommendation: rec };
  }
  return { status: 'no-basis', text: 'The windows near the low-daylight area cannot grow inside their walls.' };
}

// ---- adopt: one transaction, idempotent by recommendation id. Returns the adoption (existing or new).
export function adopt(S, p, rec, { name } = {}) {
  p.recommendations = p.recommendations || [];
  const had = p.recommendations.find((r) => r.id === rec.id);
  if (had?.adoption) return { ...had.adoption, repeated: true };
  const base = C.revision(p, rec.basis.revisionId), v = base && S.version(p, base.versionId);
  if (!base || !v) throw Error('The plan revision this suggestion was based on is gone.');
  if (C.modelHash(v.model) !== rec.basis.modelHash) throw Error('The base model differs from the suggestion basis.');
  if (C.freezeInputs(p).physicalHash !== rec.basis.physicalHash) throw Error('Project conditions changed after this result. Rerun Daylight to refresh the suggestion.');
  const model = applyPatch(v.model, rec.patch);   // throws before anything changes
  const plan = C.derivePlan(p, base.id, { name });
  p.draft = model;
  const nv = S.saveVersion(p, `Plan ${plan.name}: ${rec.title}`), rev = C.freezePlan(p, nv.id);
  const group = { id: 'rg-' + rec.id.slice(4), planRevisionId: rev.id, baseRevisionId: base.id, recommendationId: rec.id, versionId: nv.id, created: now(), state: 'queued', execution: 'browser-batch (page must stay open)',
    tasks: (rec.studies.length ? rec.studies : ['daylight']).map((simId) => ({ simId, status: 'queued', runId: null, why: '' })), log: [{ at: now(), event: 'created' }] };
  p.runGroups.push(group);
  const adoption = { planId: plan.id, planName: plan.name, revisionId: rev.id, versionId: nv.id, runGroupId: group.id, at: now() };
  p.recommendations.push({ ...rec, adoption, status: 'adopted' });
  S.save();
  return adoption;
}
// Batch progress → run group state. Success only from saved solver results.
export function updateGroup(S, p, groupId, items) {
  const g = p.runGroups.find((x) => x.id === groupId); if (!g) return null;
  for (const t of g.tasks) { const it = items.find((x) => x.simId === t.simId && x.versionId === g.versionId); if (!it) continue; if (it.status !== t.status) g.log.push({ at: now(), event: t.simId + ' ' + it.status, why: it.why || undefined }); Object.assign(t, { status: it.status, runId: it.runId || t.runId, why: it.why || '' }); }
  const st = g.tasks.map((t) => t.status);
  g.state = st.every((s) => s === 'done') ? 'succeeded' : st.some((s) => s === 'running' || s === 'queued') ? (st.some((s) => s !== 'queued') ? 'running' : 'queued') : st.some((s) => s === 'done') ? 'partial' : st.every((s) => s === 'cancelled') ? 'cancelled' : 'failed';
  S.save(); return g;
}
export function cancelGroup(S, p, groupId) { const g = p.runGroups.find((x) => x.id === groupId); if (!g) return; for (const t of g.tasks) if (t.status === 'queued' || t.status === 'running') { t.status = 'cancelled'; } g.state = g.tasks.some((t) => t.status === 'done') ? 'partial' : 'cancelled'; g.log.push({ at: now(), event: 'cancelled by user (browser runs stop when the page closes)' }); S.save(); return g; }
// Tasks to (re)start after a refresh: anything not done.
export const pendingTasks = (g) => g.tasks.filter((t) => t.status !== 'done');
// A change asked for in feedback, expressed as the same whitelisted patch on plan B's latest saved version (→ Plan C).
export function feedbackRecommendation(S, p, { versionId, windowId, width, height, feedbackIds = [] }) {
  const v = S.version(p, versionId); if (!v) throw Error('Choose the saved version the feedback refers to.');
  const win = v.model.components.find((c) => c.id === windowId && c.type === 'window'); if (!win) throw Error('Choose a window of that version.');
  const wall = hostWall(v.model, win); if (!wall) throw Error('That window has no host wall.');
  const alongX = wall.g.w >= wall.g.d, g = win.g, len = alongX ? g.w : g.d, nl = Number.isFinite(width) ? width : len, a = (alongX ? g.x : g.y) + len / 2 - nl / 2;
  const to = { ...g, ...(alongX ? { x: r3(a), w: r3(nl) } : { y: r3(a), d: r3(nl) }), ...(Number.isFinite(height) ? { h: r3(height) } : {}) };
  const patch = { op: 'window.resize', id: win.id, name: win.name, from: clone(g), to };
  applyPatch(v.model, patch);   // validate now: an illegal request stays a task
  const rev = [...p.planRevisions].reverse().find((r) => r.versionId === versionId && !r.legacy) || C.freezePlan(p, versionId);
  const studies = [...new Set(p.runs.filter((r) => r.versionId === versionId && WINDOW_STUDIES.includes(r.simId)).map((r) => r.simId))];
  const rec = { rule: 'feedback-window-resize', title: `Resize “${win.name}” as requested in feedback`, patch, feedbackIds, basis: { revisionId: rev.id, versionId, physicalHash: C.freezeInputs(p).physicalHash, modelHash: C.modelHash(v.model) }, expected: 'Requested by feedback; the rerun shows the effect.', studies, undo: undoPatch(patch) };
  rec.id = 'rec-' + hashOf({ rule: rec.rule, patch, basis: rec.basis }).slice(0, 16);
  return rec;
}
