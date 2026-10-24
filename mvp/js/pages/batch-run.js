// One simulation of a batch, run by Results in a hidden frame: the simulation page itself (sim-engine.js) in its batch mode.
import { SIMS } from '../data.js';
export async function render(app, rest, params) {
  const sim = SIMS.find((s) => s.id === params.get('sim'));
  if (!sim) { try { window.parent.postMessage({ pcBatch: params.get('batch'), ok: false, why: 'Unknown simulation.' }, location.origin); } catch (e) { } return; }
  return (await import('./sim-engine.js')).render(app, sim, params);
}
