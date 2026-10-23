import { RESOURCES, MODEL_TOOLS, FULL, PAGE } from '../data.js';
import { esc, LIVE } from '../app.js';

const link = (t) => (t.tool ? FULL(t.tool) : PAGE(t.route));
const cards = (list) => `<div class="grid g3">${list.map((t) => `<a class="card" href="${link(t)}" target="_blank" rel="noopener" style="text-decoration:none"><h3 style="font-size:15px">${esc(t.name)} ↗</h3><p class="small muted" style="margin-top:6px">${esc(t.blurb)}</p></a>`).join('')}</div>`;

export function render(app) {
  app.innerHTML = `<div class="wrap">
    <span class="eyebrow">Resources</span><h1 style="font-size:30px;margin:8px 0 6px">Free tools and files</h1>
    <p class="muted" style="max-width:680px">Useful on their own, and a way into the platform. Every link below opens what PlotCloud already offers. ${LIVE}</p>
    <div class="sec-h"><h2>AI image and presentation tools</h2></div>${cards(RESOURCES.ai)}
    <div class="sec-h"><h2>CAD blocks and 3D files</h2><a class="btn ghost" href="${PAGE('library')}" target="_blank" rel="noopener">Open the library ↗</a></div>
    <div class="grid g3">${RESOURCES.files.map(([n, d]) => `<a class="card" href="${PAGE('library')}" target="_blank" rel="noopener" style="text-decoration:none"><h3 style="font-size:15px">${esc(n)}</h3><p class="small muted" style="margin-top:6px">${esc(d)}</p></a>`).join('')}</div>
    <div class="sec-h"><h2>Model-building tools</h2><span class="note">for detailed modelling beyond the workspace</span></div>${cards(MODEL_TOOLS)}
    <div class="sec-h"><h2>References</h2></div>${cards(RESOURCES.refs)}
  </div>`;
}
