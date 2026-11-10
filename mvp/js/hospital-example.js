// The hospital example (2026-11-10): one project per browser, made from hospital-case.js the first time it is opened; it opens in
// the Workspace; with { study: 'fire-evacuation' } it opens with Fire Evacuation ready (horizontal relocation, then down the
// stairs and out). Made to run every study in the Workspace, for demonstrations.
import * as S from './store.js';
import { hospitalModel, title, site, CASE_ID } from './hospital-case.js?v=hosp-20261110-5';
export function openHospital(o = {}) {
  try { const key = 'pc-mvp-ws2', ui = JSON.parse(localStorage.getItem(key) || '{}'); localStorage.setItem(key, JSON.stringify({ ...ui, view: 'persp' })); } catch { }
  if (o.study === 'fire-evacuation') try { sessionStorage.setItem('pc-ws-open-study', 'fire-evacuation'); sessionStorage.setItem('pc-ws-study-set', JSON.stringify({ egStrat: 'down', egRatio: '4', egMix: 'typical' })); } catch { }
  let p = S.projects().find((q) => q.caseStudy?.id === CASE_ID && !q.deletedAt); if (p) return p;
  p = S.createProject(title, hospitalModel()); p.site = S.clone(site); p.siteLinked = false; p.caseStudy = { id: CASE_ID, source: 'PlotCloud example: a generic hospital ward block, not a real building' };
  S.updateConditions(p, site, p.sharedConditions.defaults, { keepRevision: true }); S.save(); return p;
}
