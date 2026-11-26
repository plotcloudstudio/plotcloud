// The planner off the page's thread (2026-11-26): planAsync runs route-plan.js in route-worker.js and resolves with its result.
// onProgress(expanded) as it searches; signal (an AbortSignal) stops it at once (the worker is ended) and rejects with 'Stopped.'.
// Where a worker cannot start (Node, an old browser, a worker that fails to load) the same function runs here instead, so the result
// is the same either way. window.__routeWorker counts the runs made in the worker and the time of the last one, for the tests.
import * as RP from './route-plan.js?v=semi-20261126-1';
const W = typeof window !== 'undefined' ? (window.__routeWorker ||= { runs: 0, fallback: 0, lastMs: 0 }) : { runs: 0, fallback: 0, lastMs: 0 };
const local = (fn, args, onProgress) => RP[fn](args[0], args[1], args[2], { ...args[3], onProgress: onProgress ? (e) => onProgress(e) : undefined });
export function planAsync(fn, args, { onProgress, signal } = {}) {
  if (signal?.aborted) return Promise.reject(Error('Stopped.'));
  if (typeof Worker === 'undefined') { W.fallback++; return Promise.resolve(local(fn, args, onProgress)); }
  return new Promise((resolve, reject) => { let w, heard = false, done = false; const t0 = performance.now();
    const end = () => { done = true; try { w && w.terminate(); } catch { } signal?.removeEventListener('abort', stop); };
    const stop = () => { if (done) return; end(); reject(Error('Stopped.')); };
    const fall = () => { if (done) return; end(); W.fallback++; try { resolve(local(fn, args, onProgress)); } catch (e) { reject(e); } };
    try { w = new Worker(new URL('./route-worker.js?v=semi-20261126-1', import.meta.url), { type: 'module' }); } catch { fall(); return; }
    signal?.addEventListener('abort', stop);
    w.onmessage = (e) => { heard = true; const d = e.data || {}; if (d.type === 'progress') { onProgress?.(d.expanded, d.max); return; }
      end(); if (d.type === 'done') { W.runs++; W.lastMs = Math.round(performance.now() - t0); resolve(d.result); } else reject(Error(d.message || 'the route search failed')); };
    w.onerror = (e) => { e.preventDefault?.(); if (!heard) fall(); else { end(); reject(Error(e.message || 'the route search failed')); } };   // it could not load: here instead
    w.postMessage({ fn, args }); });
}
