// Plan Studio (emb/modeler.html) as a hidden helper: it opens a Workspace version and hands back the exact scene a
// simulation engine reads — the same STC.planScene Send to Simulation uses — or the level as DXF.
// Versions never change, so each answer is kept for the session.
import { toStudio } from './studio-convert.js';

let frame = null, ready = null;
function studio() {
  if (ready) return ready;
  ready = new Promise((res, rej) => {
    const keep = (() => { try { return localStorage.getItem('pc-studio-last'); } catch (e) { return null; } })();
    frame = document.createElement('iframe'); frame.title = 'Plan Studio (model conversion)'; frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:800px;border:0;visibility:hidden';
    frame.src = '../emb/modeler.html?v=sim20-20261025'; document.body.appendChild(frame);
    let n = 0; const wait = () => { const W = frame.contentWindow?.__pcWorkflow;
      if (W?.toolScene && W.use) { try { if (keep == null) localStorage.removeItem('pc-studio-last'); else localStorage.setItem('pc-studio-last', keep); } catch (e) { } res(W); }
      else if (n++ < 300) setTimeout(wait, 100); else rej(new Error('Plan Studio did not start.')); };
    frame.addEventListener('load', wait);
  });
  ready.catch(() => { ready = null; });
  return ready;
}

// a version made in the three-pane Workspace keeps its Plan Studio model (model.studio): that model is used as it is, with north and
// the prevailing wind from the site (Account); an older version (Workspace boxes) is converted
function studioModel(version, site, name) {
  const st = version.model.studio; if (!st || st.v !== 2) return toStudio(version.model, site, { name, id: 'ws-' + version.id });
  const N = JSON.parse(JSON.stringify(st)), c = toStudio({ layers: [], components: [] }, site, { name }).climate;
  return Object.assign(N, { id: 'ws-' + version.id, name, north: site?.north || 0, climate: Object.assign({}, N.climate || {}, { from: c.from, U10: c.U10 }) });
}
// run fn with this version open in Plan Studio; Plan Studio's own "last project" is put back afterwards
async function withModel(version, site, name, fn) {
  const W = await studio(), keep = (() => { try { return localStorage.getItem('pc-studio-last'); } catch (e) { return null; } })();
  try { W.use(studioModel(version, site, name)); try { const I = frame.contentWindow.__imp; if (I) I.setMeshes(version.model.meshes || {}); } catch (e) { } return fn(W); }   // imported meshes' triangles are kept beside the model
  finally { try { if (keep == null) localStorage.removeItem('pc-studio-last'); else localStorage.setItem('pc-studio-last', keep); } catch (e) { } }
}
const cache = (k, make) => { try { const v = sessionStorage.getItem(k); if (v) return Promise.resolve(JSON.parse(v)); } catch (e) { }
  return make().then((v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { } return v; }); };
const siteKey = (site) => [site?.lat, site?.lon, site?.north, site?.wind, site?.windDir].join('|');

// { ok, scene (JSON string), level, levels } or { ok:false, why:[…], levels }
export function studioScene(version, site, name, tool, level) {
  return cache(`pc-scene:${version.id}:${tool}:${level || ''}:${siteKey(site)}`, () => withModel(version, site, name, (W) => ({ ...W.toolScene(tool, level), levels: W.levels() })));
}
export function studioDXF(version, site, name, level) {
  return cache(`pc-dxf:${version.id}:${level || ''}`, () => withModel(version, site, name, (W) => ({ ok: true, text: W.dxf(level), levels: W.levels(), level: level || W.levels()[0]?.id })));
}
// the meshes of a version as Plan Studio draws them (plan metres, z up), for Results' compare views; kept in memory per version
const MESH = new Map();
export function studioMeshes(version, site, name) {
  if (MESH.has(version.id)) return MESH.get(version.id);
  const pr = studio().then(() => withModel(version, site, name, () => { const w = frame.contentWindow, M = w.__st.M, Sx = w.__st.S;
    return { studio: JSON.parse(JSON.stringify(M)), meshes: w.S3.wsMeshes(M, Sx, { hidden: new Set(M.hiddenIds || []) }) }; }))
    .then(async (r) => ({ studio: r.studio, meshes: await r.meshes }));
  pr.catch(() => MESH.delete(version.id)); MESH.set(version.id, pr); return pr;
}
// Plan Studio's site tools (SITEC in emb/modeler.html): the new-project-from-the-map page builds the site with them,
// so there is one owner of the site format
export async function sitec() { await studio(); return frame.contentWindow.__SITEC; }
