// Capability registry (replan item 06, plan §4 and §4.6). Three top-level analysis types — building, interior, tables — with one
// primary category per study; tables reuse saved runs and never solve again. Every entry states its method, inputs, outputs,
// status and the test that exercises it. Status is what PlotCloud actually does today, not the target:
//   'screening'  a PlotCloud browser engine runs it (design screening, not certification)
//   'reference'  a reference engine runs on the user's own computer (local-compute/), with file exchange
//   'data'       a view or calculation over saved runs and inputs (no solver)
//   'not-connected'  target capability; the engine or inputs it needs are not connected — no result is ever shown
import { SIMS } from './data.js';

export const CATEGORIES = [
  { id: 'building', label: 'Building analysis', note: 'Site, surroundings, massing, envelope and whole-building questions.' },
  { id: 'interior', label: 'Interior analysis', note: 'Rooms, work planes, viewpoints, furniture and lighting layouts.' },
  { id: 'table', label: 'Tables', note: 'Hourly and summary data, comparisons and audit tables built from saved runs.' },
];
// Existing studies (plan §4.5): primary category, target IDs they cover, and their method identity.
export const STUDIES = {
  sunhours: { category: 'building', covers: ['B02'], also: ['I06'], method: 'PlotCloud ray-cast direct sun hours (browser)', test: 'tests/sun-period.cjs' },
  radiation: { category: 'building', covers: ['B03'], method: 'PlotCloud sky-patch incident radiation from EPW (browser, no reflections) — not HB-Radiance', test: 'tests/climate-studies.cjs' },
  utci: { category: 'building', covers: ['B09'], method: 'UTCI polynomial with PlotCloud solar MRT estimate (browser)', test: 'tests/climate-studies.cjs' },
  wind: { category: 'building', covers: ['B07', 'B08'], method: 'PlotCloud GPU lattice flow screening (browser) — not OpenFOAM CFD', test: 'tests/climate-studies.cjs' },
  stormwater: { category: 'building', covers: [], extension: 'Site drainage screening', method: 'PlotCloud runoff screening with a design storm (not EPW)', test: 'tests/free-simulations.cjs' },
  structure: { category: 'building', covers: [], extension: 'Structural screening', method: 'PlotCloud frame solver on confirmed members, supports and loads', test: 'tests/structural-workflow.cjs' },
  skyview: { category: 'building', covers: ['B04'], method: 'Sky exposure / projected sky view factor (browser)', test: 'tests/environment-analysis.cjs' },
  shadebenefit: { category: 'building', covers: ['B05'], method: 'Temperature-weighted shade benefit (browser); not a load-based result', test: 'tests/environment-analysis.cjs' },
  solarenvelope: { category: 'building', covers: ['B06'], method: 'Solar envelope from protected periods (browser); not a planning approval', test: 'tests/environment-analysis.cjs' },
  daylight: { category: 'interior', covers: ['I01', 'I02', 'I03', 'I04'], method: 'PlotCloud browser daylight screening (DF, sDA/ASE estimates) — not HB-Radiance annual simulation', test: 'tests/shared-conditions.cjs' },
  vent: { category: 'interior', covers: ['I10'], also: ['B12'], method: 'Airflow network estimate (browser) — not CFD', test: 'tests/mvp-new-sims.cjs' },
  acoustics: { category: 'interior', covers: [], extension: 'Room acoustics screening', method: 'Statistical reverberation (browser)', test: 'tests/acoustics.cjs' },
  spacesyntax: { category: 'interior', covers: [], extension: 'Spatial organisation', method: 'Visibility graph / connectivity', test: 'tests/mvp-new-sims.cjs' },
  movementdepth: { category: 'interior', covers: [], extension: 'Spatial organisation', method: 'Step depth on the space graph', test: 'tests/mvp-new-sims.cjs' },
  evac: { category: 'interior', covers: [], extension: 'Circulation and walking', method: 'Shortest-path walking time; not a fire-egress certification', test: 'tests/mvp-new-sims.cjs' },
  isovist: { category: 'interior', covers: ['I12'], method: 'Isovist from a placed observer', test: 'tests/mvp-new-sims.cjs' },
  views: { category: 'interior', covers: ['I12'], method: 'Geometric view to outside', test: 'tests/mvp-new-sims.cjs' },
  wayfinding: { category: 'interior', covers: [], extension: 'Wayfinding', method: 'Decision points and sign visibility', test: 'tests/mvp-new-sims.cjs' },
  privacy: { category: 'interior', covers: [], extension: 'Privacy and sightlines', method: 'Sightlines from outside observers', test: 'tests/mvp-new-sims.cjs' },
  cameras: { category: 'interior', covers: [], extension: 'Camera coverage', method: 'Field-of-view coverage', test: 'tests/mvp-new-sims.cjs' },
  climate: { category: 'table', covers: ['T01'], method: 'EPW charts and wind rose', test: 'tests/environment-ui.cjs' },
  passive: { category: 'table', covers: ['T02'], method: 'Passive strategy opportunity hours (weather only, not indoor comfort)', test: 'tests/environment-ui.cjs' },
};
// Target capability map (plan §4.2–4.4). Entries without an existing study are listed with what they need.
const T = (id, category, name, needs, engine) => ({ id, category, name, needs, engine });
export const TARGETS = [
  T('B01', 'building', 'Sun path and solar position', 'Coordinates, standard time zone', 'Ladybug SunPath'),
  T('B02', 'building', 'Direct sun hours and shadow', 'Massing, receiving surfaces', 'LB/HB Direct Sun Hours'),
  T('B03', 'building', 'Radiation and sky matrix', 'EPW radiation, geometry', 'LB Incident Radiation / HB Annual Irradiance'),
  T('B04', 'building', 'Sky exposure and view factors', 'Geometry, receivers', 'LB Sky Mask / View Factors'),
  T('B05', 'building', 'Shade benefit', 'Shade objects, EPW', 'LB Shade Benefit / HB Load Shade Benefit'),
  T('B06', 'building', 'Solar envelope', 'Plot, protected periods', 'LB Solar Envelope'),
  T('B07', 'building', 'Wind flow and profile', 'Massing, wind directions', 'Butterfly / OpenFOAM'),
  T('B08', 'building', 'Pedestrian wind comfort', 'Multi-direction wind fields, weights', 'Wind fields + statistics'),
  T('B09', 'building', 'Outdoor thermal comfort', 'EPW, MRT source', 'LB UTCI / HB UTCI map'),
  T('B10', 'building', 'Heating and cooling demand', 'Closed thermal zones, constructions, EPW, use template', 'HB-Energy Ideal Loads (EnergyPlus)'),
  T('B11', 'building', 'System energy, EUI and operational carbon', 'B10 + systems, carbon factors', 'HB-Energy HVAC / OpenStudio'),
  T('B12', 'building', 'Whole-building natural ventilation', 'Rooms, openings, controls', 'HB Airflow Network'),
  T('B13', 'building', 'PV potential and generation', 'Radiation, module data', 'HB Photovoltaics'),
  T('B14', 'building', 'District / large-building energy', 'Footprints, storeys, use', 'Dragonfly → Honeybee'),
  T('B15', 'building', 'Urban heat island weather', 'Base EPW, urban form', 'Dragonfly UWG'),
  T('I01', 'interior', 'Point-in-time illuminance and luminance', 'Rooms, openings, optical materials, sensors', 'HB-Radiance point-in-time'),
  T('I02', 'interior', 'Annual DA / cDA / UDI', 'I01 model, EPW, occupancy schedule', 'HB-Radiance Annual Daylight'),
  T('I03', 'interior', 'sDA / ASE', 'I02 + evaluation area, shading control', 'HB-Radiance sDA/ASE recipes'),
  T('I04', 'interior', 'Daylight factor', 'Rooms, openings, materials; CIE overcast', 'HB-Radiance Daylight Factor / local Radiance'),
  T('I05', 'interior', 'Glare (DGP, annual)', 'Eye points, view direction', 'HB-Radiance imageless annual glare'),
  T('I06', 'interior', 'Interior direct sun', 'Openings, interior obstructions', 'HB Direct Sun Hours'),
  T('I07', 'interior', 'Electric lighting and dimming', 'Fixtures with photometry, controls', 'Radiance electric lighting'),
  T('I08', 'interior', 'PMV / PPD / SET', 'Indoor air temp, MRT from a thermal model', 'LB PMV / HB PMV map'),
  T('I09', 'interior', 'Adaptive comfort and overheating', 'Indoor operative temperature, outdoor history', 'LB Adaptive / HB Adaptive map'),
  T('I10', 'interior', 'Indoor airflow', 'Openings or diffusers, boundary conditions', 'HB AFN / Butterfly'),
  T('I11', 'interior', 'Local discomfort', 'Local air speed and radiant data', 'LB Ankle Draft / Radiant Asymmetry'),
  T('I12', 'interior', 'Views and visibility', 'Observers, windows, obstructions', 'LB View Percent / Visibility'),
  T('T01', 'table', 'Climate data and wind rose', 'EPW', 'Ladybug data'),
  T('T02', 'table', 'Psychrometrics, degree days, passive strategies', 'EPW + strategy rules', 'Ladybug comfort charts'),
  T('T03', 'table', 'Hourly / per-point result tables', 'Saved runs', 'PlotCloud tables'),
  T('T04', 'table', 'Monthly / annual summaries', 'Saved runs, statistics definitions', 'PlotCloud tables'),
  T('T05', 'table', 'A/B/C comparison', 'Comparable runs', 'PlotCloud compare'),
  T('T06', 'table', 'Input differences and attribution', 'Plan revisions and runs', 'PlotCloud compare'),
  T('T07', 'table', 'Parameter sweep and sensitivity', 'Base plan, ranges, budget', 'Hosted job queue'),
  T('T08', 'table', 'Report charts and metric lists', 'Saved results', 'PlotCloud reports'),
  T('T09', 'table', 'Data quality, assumptions and audit', 'Inputs, templates, provenance', 'PlotCloud provenance'),
];
// What is actually connected for each target ID (only what exists in this repository and runs).
const LOCAL = { I04: 'Radiance CIE overcast daylight factor through local-compute/ (user-installed Radiance, file exchange)', B10: 'Reviewed epJSON + EPW through local-compute/ (user-installed EnergyPlus); no automatic thermal model from geometry' };
const DATA = { T03: 'Tables view over saved runs (#/tables)', T04: 'Summary rows over saved runs (#/tables)', T05: 'Plan comparison with absolute, relative and percentage-point differences (project overview)', T06: 'Model and parameter differences between plan revisions (project overview)', T08: 'Report with metrics and figures from saved runs (project overview → Report)', T09: 'Effective parameters with sources, EPW quality and run lineage (project overview, backups)' };
export function targetStatus(id) {
  const studies = Object.entries(STUDIES).filter(([, s]) => s.covers.includes(id)).map(([k]) => k);
  if (studies.length) return { status: 'screening', via: studies, note: studies.map((k) => STUDIES[k].method).join(' · ') };
  if (DATA[id]) return { status: 'data', via: [], note: DATA[id] };
  if (LOCAL[id]) return { status: 'reference', via: ['local-compute'], note: LOCAL[id] };
  return { status: 'not-connected', via: [], note: 'Not connected in PlotCloud. Needs: ' + TARGETS.find((t) => t.id === id).needs + '; engine: ' + TARGETS.find((t) => t.id === id).engine + '.' };
}
export const STATUS_LABEL = { screening: 'Runs · design screening', reference: 'Reference engine on your computer', data: 'Built from saved runs', 'not-connected': 'Not connected' };
// One entry per existing study, for the catalogue and tests.
export function registry() {
  return SIMS.map((s) => ({ id: s.id, name: s.name, category: STUDIES[s.id]?.category, domainTags: [s.group, s.scope], covers: STUDIES[s.id]?.covers || [], extension: STUDIES[s.id]?.extension || null, method: STUDIES[s.id]?.method, inputs: s.inputs, outputs: (s.metrics || []).map(([key, label, unit]) => ({ key, label, unit })), status: 'screening', cost: 'browser', test: STUDIES[s.id]?.test, route: '#/simulations/' + s.id }));
}
export const categoryOf = (simId) => STUDIES[simId]?.category || null;
