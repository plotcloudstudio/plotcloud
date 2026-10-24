// Batch runs for Results: each selected simulation runs its own simulation page (sim-engine.js, batch mode) in a hidden frame,
// one after another, on one version. A failed item is marked and the rest go on; any item can be run again on its own.
// The results are saved here (one writer for the store), exactly as "Save result" saves them, with source 'batch'.
import * as S from './store.js';

let seq = 0;
export function createBatch(host, { onChange } = {}) {
  const items = [];   // { key, simId, versionId, level, room, ov, status: 'queued'|'running'|'done'|'failed', why, runId, t0, t1 }
  let busy = false, stop = false;
  const emit = () => onChange && onChange(items.slice());
  function add(list) { for (const it of list) { const old = items.findIndex((x) => x.simId === it.simId && x.versionId === it.versionId); const n = { ...it, key: `${it.simId}@${it.versionId}`, status: 'queued', why: '' }; if (old >= 0) items[old] = n; else items.push(n); } emit(); pump(); }
  function retry(key) { const it = items.find((x) => x.key === key); if (!it || it.status === 'running') return; it.status = 'queued'; it.why = ''; emit(); pump(); }
  async function pump() {
    if (busy) return; busy = true;
    try { for (;;) { if (stop) break; const it = items.find((x) => x.status === 'queued'); if (!it) break; await runOne(it); } } finally { busy = false; }
  }
  function runOne(it) {
    return new Promise((resolve) => {
      const p = S.project(it.projectId), v = p && S.version(p, it.versionId);
      if (!v) { Object.assign(it, { status: 'failed', why: 'That version is gone.' }); emit(); resolve(); return; }
      const token = 'b' + (++seq) + Math.random().toString(36).slice(2, 7);
      it.status = 'running'; it.t0 = Date.now(); it.why = ''; emit();
      const q = new URLSearchParams({ sim: it.simId, project: p.id, version: v.id, batch: token });
      if (it.level) q.set('level', it.level); if (it.room) q.set('room', it.room); if (it.ov && Object.keys(it.ov).length) q.set('ov', JSON.stringify(it.ov));
      const fr = document.createElement('iframe'); fr.title = 'Batch run'; fr.setAttribute('aria-hidden', 'true'); fr.tabIndex = -1;
      fr.style.cssText = 'position:fixed;left:0;top:0;width:1360px;height:860px;border:0;opacity:0;pointer-events:none;z-index:-1';   // on screen but invisible: an off-screen or hidden frame is slowed down by the browser
      fr.src = 'index.html#/batch-run?' + q.toString(); host.appendChild(fr);
      let started = false, over = false;
      const end = (ok, why, data) => {
        if (over) return; over = true; removeEventListener('message', on); clearTimeout(t1); clearTimeout(t2); fr.remove(); it.t1 = Date.now();
        if (ok) { try { const r = S.addRun(p, v.id, it.simId, data.settings, data.results, 'batch'); Object.assign(it, { status: 'done', runId: r.id, why: '' }); } catch (e) { Object.assign(it, { status: 'failed', why: 'The result could not be saved: ' + (e.message || 'storage') }); } }
        else Object.assign(it, { status: 'failed', why: why || 'The engine stopped.' });
        emit(); resolve(); };
      const on = (e) => { const d = e.data; if (e.source !== fr.contentWindow || !d || d.pcBatch !== token) return; if (d.stage === 'running') { started = true; return; } end(!!d.ok, d.why, d); };
      addEventListener('message', on);
      const t1 = setTimeout(() => { if (!started) end(false, 'The engine did not start (it did not load or got no model).'); }, 75000);
      const long = it.simId === 'wind' || it.simId === 'vent', t2 = setTimeout(() => end(false, `No result after ${long ? 11 : 5} minutes.`), long ? 660000 : 300000);   // flow solvers take longest
    });
  }
  return { add, retry, items: () => items.slice(), get busy() { return busy; }, dispose() { stop = true; host.querySelectorAll('iframe').forEach((f) => f.remove()); } };
}
