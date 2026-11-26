// Route finding in the background (2026-11-26): the planner (route-plan.js) in a module worker, so the page keeps drawing and
// answering while a vehicle's route is searched (a semi-trailer backing up can take 10–30 s). Same code as on the page and in the Node
// tests. In: { fn: 'planAround' | 'planBackIn', args: [vehicle, route, obstacles, options] }. Out: { type: 'progress', expanded, max }
// every 2,000 positions tried, then { type: 'done', result } or { type: 'error', message }.
import * as RP from './route-plan.js?v=semi-20261126-1';
self.onmessage = (e) => { const { fn, args } = e.data || {}, f = RP[fn];
  try { if (fn !== 'planAround' && fn !== 'planBackIn') throw Error('unknown planner ' + fn); const [v, route, obstacles, o] = args; let n = 0;
    const result = f(v, route, obstacles, { ...o, onProgress: (expanded, max) => { n += 2000; self.postMessage({ type: 'progress', expanded: expanded || n, max }); } });
    self.postMessage({ type: 'done', result }); }
  catch (err) { self.postMessage({ type: 'error', message: err && err.message || String(err) }); } };
