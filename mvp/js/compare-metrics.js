// A/B comparison rules (replan item 10, plan §8.1–8.3, AC21–AC23). Pure functions over saved runs.
//   absolute difference = B − A; relative = (B − A) / |A| × 100 %; A = 0 → relative undefined; missing values are never zero;
//   a percentage metric's absolute difference is in percentage points (50 % → 60 % = +10 pp, relative +20 %).
// "Better" comes only from a stated target; without one, only the change is shown.
const finite = (x) => typeof x === 'number' && Number.isFinite(x);
export function delta(a, b, { unit = '' } = {}) {
  const pct = unit === '%';
  if (!finite(a) || !finite(b)) return { status: 'missing', a: finite(a) ? a : null, b: finite(b) ? b : null, note: !finite(a) && !finite(b) ? 'missing in A and B' : !finite(a) ? 'missing in A' : 'missing in B' };
  const abs = b - a, rel = a === 0 ? null : (abs / Math.abs(a)) * 100;
  return { status: 'ok', a, b, abs, absUnit: pct ? 'pp' : unit, rel, relNote: a === 0 ? 'undefined (A is zero)' : null };
}
// target { min?, max?, source } — a range or a one-sided limit. Returns per-plan state and the direction of change.
export function judge(d, target) {
  if (!target || (!finite(target.min) && !finite(target.max))) return { verdict: 'no-target', text: 'No target set: change only' };
  if (d.status !== 'ok') return { verdict: 'unknown', text: 'Cannot judge: ' + d.note };
  const meets = (v) => (!finite(target.min) || v >= target.min) && (!finite(target.max) || v <= target.max);
  const gap = (v) => (meets(v) ? 0 : finite(target.min) && v < target.min ? target.min - v : v - target.max);
  const ga = gap(d.a), gb = gap(d.b);
  const verdict = gb < ga ? 'better' : gb > ga ? 'worse' : meets(d.b) ? 'meets-both' : 'unchanged';
  return { verdict, aMeets: meets(d.a), bMeets: meets(d.b), text: { better: 'Closer to target', worse: 'Further from target', 'meets-both': 'Meets target in A and B', unchanged: 'No change against target' }[verdict], source: target.source || 'not recorded' };
}
const SPATIAL = ['grid', 'gridSize', 'resolution', 'step', 'level', 'room', 'plane', 'sensorHeight'];
// Is this a design comparison (same conditions), a scenario comparison (conditions changed) or not comparable?
export function comparability(A, B) {
  const diffs = [], add = (key, a, b, kind) => diffs.push({ key, a, b, kind });
  if (!A || !B) return { kind: 'not-comparable', diffs: [{ key: 'run', kind: 'blocking', a: !!A, b: !!B }], text: 'A run is missing.' };
  if (A.simId !== B.simId) add('study', A.simId, B.simId, 'blocking');
  const ra = A.recipe || {}, rb = B.recipe || {};
  if ((ra.engine || 'unrecorded') !== (rb.engine || 'unrecorded') || (ra.version || 'unrecorded') !== (rb.version || 'unrecorded')) add('method', `${ra.engine}/${ra.version}`, `${rb.engine}/${rb.version}`, 'blocking');
  const ia = A.inputs?.values, ib = B.inputs?.values;
  if (!ia || !ib) add('inputs', !!ia, !!ib, 'unrecorded');
  else for (const k of new Set([...Object.keys(ia), ...Object.keys(ib)])) if (JSON.stringify(ia[k]) !== JSON.stringify(ib[k])) add(k, ia[k], ib[k], k === 'weather.epw' ? 'weather' : 'condition');
  for (const k of SPATIAL) { const a = A.settings?.[k], b = B.settings?.[k]; if (a !== undefined && b !== undefined && JSON.stringify(a) !== JSON.stringify(b)) add('settings.' + k, a, b, 'grid'); }
  const fa = A.results?.field, fb = B.results?.field; if (fa && fb && fa.step !== fb.step) add('field.step', fa.step, fb.step, 'grid');
  if (A.results?.mediaDropped || B.results?.mediaDropped) add('field', 'kept', 'dropped', 'note');
  const blocking = diffs.some((d) => d.kind === 'blocking'), scenario = diffs.some((d) => ['weather', 'condition', 'grid'].includes(d.kind));
  const kind = blocking ? 'not-comparable' : scenario ? 'scenario' : diffs.some((d) => d.kind === 'unrecorded') ? 'unverified' : 'design';
  return { kind, diffs, text: { 'not-comparable': 'Not directly comparable: different study or method.', scenario: 'Scenario comparison: conditions differ as listed; differences are not only design changes.', unverified: 'Conditions of a legacy run were not recorded; comparability cannot be confirmed.', design: 'Same recorded conditions and method: a design comparison.' }[kind] };
}
// Point-by-point difference only where both fields share the grid and points (plan §8.2); otherwise no difference map.
export function fieldDiff(fa, fb) {
  if (!fa?.pts || !fb?.pts) return { status: 'not-comparable', reason: 'A result field is missing (pictures and fields of older results may have been removed).' };
  if (fa.unit !== fb.unit) return { status: 'not-comparable', reason: `Units differ (${fa.unit} vs ${fb.unit}).` };
  const key = (x, y) => x.toFixed(3) + ',' + y.toFixed(3), B = new Map();
  for (let i = 0; i < fb.pts.length; i += 3) B.set(key(fb.pts[i], fb.pts[i + 1]), fb.pts[i + 2]);
  const out = []; let onlyA = 0;
  for (let i = 0; i < fa.pts.length; i += 3) { const k = key(fa.pts[i], fa.pts[i + 1]); if (!B.has(k)) { onlyA++; continue; } const a = fa.pts[i + 2], b = B.get(k); if (finite(a) && finite(b)) out.push([fa.pts[i], fa.pts[i + 1], b - a]); B.delete(k); }
  const onlyB = B.size, matched = out.length;
  if (!matched) return { status: 'not-comparable', reason: 'No sensor points coincide; the grids differ. Rerun both on a common grid.' };
  const d = out.map((x) => x[2]);
  return { status: 'ok', unit: fa.unit === '%' ? 'pp' : fa.unit, matched, onlyA, onlyB, mean: d.reduce((s, v) => s + v, 0) / matched, min: Math.min(...d), max: Math.max(...d), pts: out.flat() };
}
// Rows for a study's metrics (data.js SIMS metrics: [key, label, unit, decimals]).
export function metricRows(sim, A, B, targets = {}) {
  return (sim.metrics || []).map(([key, label, unit, dec]) => { const d = delta(A?.results?.[key], B?.results?.[key], { unit }); return { key, label, unit, dec, ...d, judge: judge(d, targets[sim.id + '.' + key]) }; });
}
export const fmt = (v, dec = 1) => (finite(v) ? (Math.round(v * 10 ** dec) / 10 ** dec).toFixed(dec) : '—');
export function describe(row) {
  if (row.status !== 'ok') return row.note;
  const sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±');
  return `${sign(row.abs)}${fmt(Math.abs(row.abs), row.dec)} ${row.absUnit}` + (row.rel == null ? ` · relative ${row.relNote}` : ` · ${sign(row.rel)}${fmt(Math.abs(row.rel), 1)} % relative`);
}
