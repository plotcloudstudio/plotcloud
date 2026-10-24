import { RESOURCES, MODEL_TOOLS, FULL, PAGE } from '../data.js';
import { esc } from '../app.js';

const link = (t) => (t.tool ? FULL(t.tool) : t.route ? PAGE(t.route) : PAGE('library'));
const list = (n, title, items, more = '') => `<section class="section" style="margin-top:72px"><div class="kicker"><b>${n}</b>${title}</div>${more}
  <ol class="numlist cols" style="margin-top:18px">${items.map((t) => `<li style="grid-template-columns:1fr auto"><a href="${link(t)}" target="_blank" rel="noopener" style="text-decoration:none"><b>${esc(t.name)}</b><p>${esc(t.blurb)}</p></a><span aria-hidden="true" class="muted">↗</span></li>`).join('')}</ol></section>`;

export function render(app) {
  app.innerHTML = `<div class="wrap">
    <span class="eyebrow">Resources</span>
    <div class="split" style="margin-top:16px"><h1 class="display">Tools and files,<br><span>free to use.</span></h1>
      <p class="lede">Useful on their own, and a way into the platform. Every link opens what PlotCloud already offers.</p></div>
    ${list('01', 'Presentation tools', RESOURCES.ai)}
    ${list('02', 'CAD blocks and 3D files', RESOURCES.files.map(([name, blurb]) => ({ name, blurb })))}
    ${list('03', 'Model-building tools', MODEL_TOOLS)}
    ${list('04', 'References', RESOURCES.refs)}
  </div>`;
}
