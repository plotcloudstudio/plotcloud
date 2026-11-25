// Workspace help (2026-11-25): the keyboard shortcuts that are bound in Plan Studio (emb/modeler.html), short definitions of the
// terms the results use, and a link to each study's method report on the Blog (mvp/research/reports/<id>.md → #/blog/report-<id>).
// Opened from the "?" button in the Workspace's top bar.

// every study with a method report; tests/workspace-help.test.mjs checks this against mvp/research/reports
export const REPORT_IDS = ['acoustics', 'cameras', 'climate', 'daylight', 'evac', 'fire-evacuation', 'isovist', 'movementdepth', 'parking-layout', 'passive', 'privacy', 'radiation', 'shadebenefit', 'skyview', 'snow', 'solarenvelope', 'spacesyntax', 'stormwater', 'structure', 'sunhours', 'utci', 'vehicle-swept-path', 'vent', 'views', 'watersound', 'wayfinding', 'wind'];
export const reportLink = (id) => (REPORT_IDS.includes(id) ? '#/blog/report-' + id : null);

// only keys the code binds (emb/modeler.html keydown; tools work while the plan has the focus)
export const SHORTCUTS = [
  ['Drawing tools (2D plan)', [['V', 'Select and move'], ['R', 'Rectangle room'], ['W', 'Straight wall'], ['H', 'Arc wall'], ['N', 'Window'], ['D', 'Door'], ['F', 'Floor'], ['O', 'Floor opening'], ['E', 'Wall opening'], ['T', 'Text label'], ['X', 'Delete tool']]],
  ['While drawing', [['Type a length, then Enter', 'Exact length or size (e.g. 9000,6000 for a 9 × 6 m room)'], ['Backspace', 'Correct the typed length'], ['Esc', 'Stop drawing, clear the selection']]],
  ['Selection', [['Del or Backspace', 'Delete the selection'], ['Arrow keys', 'Nudge 1 mm (with Shift: 10 mm)'], ['Tab', 'Pick the next object under the pointer'], ['R (furniture selected)', 'Rotate the piece 90°']]],
  ['History', [['Ctrl+Z', 'Undo'], ['Ctrl+Y or Ctrl+Shift+Z', 'Redo']]],
];

export const GLOSSARY = [
  ['Daylight factor (DF)', 'Indoor daylight under an overcast sky as a percentage of the outdoor daylight at the same moment. It ignores the sun and the orientation.'],
  ['sDA 300/50%', 'Spatial daylight autonomy (IES LM-83): the share of the floor that reaches 300 lux for at least half of the occupied hours of a year.'],
  ['ASE 1000/250', 'Annual sun exposure (IES LM-83): the share of the floor that gets more than 1,000 lux of direct sun for more than 250 hours a year; a glare and overheating flag.'],
  ['Sun hours', 'Hours of direct sun a point receives on the chosen days, with the surrounding buildings casting shadows.'],
  ['Sky view factor', 'The share of the sky dome a point sees; low values mean deep, enclosed spaces.'],
  ['UTCI', 'Universal Thermal Climate Index: the air temperature that would feel the same outdoors, from air temperature, humidity, wind and radiation.'],
  ['Lawson criteria', 'Pedestrian wind comfort classes (sitting, standing, strolling, walking) by how often a wind speed is exceeded.'],
  ['EPW', 'EnergyPlus weather file: one typical year of hourly weather for a station. Studies that use weather name the file they used.'],
  ['Version', 'A saved state of the model. Results are kept with the version they were computed on, so later changes do not overwrite them.'],
  ['Out of date (stale)', 'The model or the inputs changed since the result was computed. It is kept, marked, and cannot be exported until it is run again.'],
  ['Method label', 'The tag on each result: how the method was checked (for example "Matches Ladybug" or "Screening estimate"). Click it to read the method report.'],
  ['Screening estimate', 'An early-design check with a simplified method. It shows where to look and how options compare; it is not a compliance or certified result.'],
];

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// the panel's markup: three sections, the method list from the studies the Workspace offers ([id, name] pairs)
export function helpHTML(studies) {
  const keys = SHORTCUTS.map(([g, rows]) => `<h4>${esc(g)}</h4><dl class="sp-hkeys">${rows.map(([k, t]) => `<dt>${k.split(/( or |, then |\+)/).map((x) => (/^( or |, then |\+)$/.test(x) ? esc(x) : `<kbd>${esc(x)}</kbd>`)).join('')}</dt><dd>${esc(t)}</dd>`).join('')}</dl>`).join('');
  const terms = `<dl class="sp-hterms">${GLOSSARY.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl>`;
  const methods = `<ul class="sp-hmeth">${studies.filter(([id]) => reportLink(id)).map(([id, name]) => `<li><a href="${reportLink(id)}" target="_blank" rel="noopener" data-help-report="${esc(id)}">${esc(name)}</a></li>`).join('')}</ul>`;
  return `<header><b>Help</b><button type="button" class="sp-x" data-help="close" aria-label="Close help">×</button></header>
    <nav class="sp-htabs" role="tablist" aria-label="Help">${[['keys', 'Shortcuts'], ['terms', 'Terms'], ['methods', 'Methods']].map(([k, n], i) => `<button type="button" role="tab" data-help-tab="${k}" aria-selected="${i === 0}">${n}</button>`).join('')}</nav>
    <section data-help-sec="keys">${keys}<p class="sp-note">Keys reach the plan while it has the focus: click the plan first.</p></section>
    <section data-help-sec="terms" hidden>${terms}</section>
    <section data-help-sec="methods" hidden><p class="sp-note">Each study's method report: the equations, inputs, sources, checks and limits. They open in a new tab.</p>${methods}</section>`;
}
