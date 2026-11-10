// Daylight runs and their records (2026-11-01). The Daylight study's engine lives in mvp/js/interior/daylight.js (the former
// emb/daylight.html, unchanged). This puts together what a run takes from the project's shared conditions (site, north, work
// plane, occupied hours, the project weather) and records it as the study page did: the conditions snapshot, the effective
// parameters, provenance and the figures (sDA, ASE, mean daylight factor). Used by the Workspace and by batch runs.
import * as S from './store.js';
import * as DAY from './interior/daylight.js?v=day-20261110-1';
import { climateFile } from './project-climate.js';

const num = (v, d) => (Number.isFinite(+v) && v !== '' && v != null ? +v : d);
// the inputs of a run: shared conditions, then any overrides (batch panel ids: wp, occ0, occ1, north, lat, lon, tz)
export async function daylightInputs(p, ov = {}) {
  const shared = S.clone(S.conditionsOf(p)), site = shared.site || {}, A = shared.defaults || {};
  const tz = num(ov.tz, Number.isFinite(+site.tz) ? +site.tz : Math.round((site.lon || 0) / 15));
  let epw = null, epwName = ''; if (site.climate?.hash) { try { const rec = await climateFile(site.climate.hash); if (rec?.text) { epw = rec.text; epwName = site.climate.station || site.climate.name || 'project weather'; } } catch (e) { } }
  return { shared, inputs: { wp: num(ov.wp, num(A.plane, 0.8)), occ: [num(ov.occ0, num(A.occStart, 8)), num(ov.occ1, num(A.occEnd, 18))], north: num(ov.north, site.north || 0), loc: { lat: num(ov.lat, site.lat), lon: num(ov.lon, site.lon), tz, name: site.label || 'site' }, epw, epwName } };
}
// a run's record for p.runs
export function daylightRecord(p, v, shared, out, extra = {}) {
  const sm = out.sm, pc = (x) => (x * 100).toFixed(1) + '%', site = shared.site || {};
  const results = { kpis: [['sDA 300/50%', pc(sm.sda)], ['ASE 1000/250', pc(sm.ase)], ['Avg DF', sm.df.toFixed(2) + '%'], ['LEED option 2', pc(sm.o2)], ['Floor', sm.area.toFixed(0) + ' m²']], sda: +(sm.sda * 100).toFixed(1), ase: +(sm.ase * 100).toFixed(1), df: +sm.df.toFixed(2) };
  // the daylight factor at each spot (plan metres), for comparing two versions point by point
  const o = extra.origin || [0, 0]; results.field = { name: 'Daylight factor', unit: '%', pts: out.RES.pts.map((q, k) => [+(q.x + o[0]).toFixed(2), +(q.y + o[1]).toFixed(2), +out.RES.ev[k].df.toFixed(3)]) };
  const settings = { site: site.label, ...(extra.level ? { level: extra.level } : {}), ...(extra.settings || {}),
    sharedConditions: { revision: shared.revision, signature: S.conditionsSignature({ sharedConditions: shared }, 'daylight'), site: S.clone(site), defaults: S.clone(shared.defaults || {}), studyOnlyOverrides: !!extra.studyOnly, effective: DAY.conditions() },
    inheritedFrom: 'Project shared conditions', grid: out.RES.spacing, weather: out.epw ? 'project EPW' : 'generic year',
    provenance: { schema: 1, engine: 'daylight', engineRelease: 'daylight-module-20261101', versionId: v?.id, recordedAt: new Date().toISOString(), site: { label: site.label, lat: site.lat, lon: site.lon, north: site.north ?? 0, tz: site.tz }, note: 'Daylight module (the former study page engine); project shared conditions and any overrides are recorded separately.' } };
  return { settings, results };
}
