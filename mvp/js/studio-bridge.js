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
    frame.src = '../emb/modeler.html'; document.body.appendChild(frame);
    let n = 0; const wait = () => { const W = frame.contentWindow?.__pcWorkflow;
      if (W?.toolScene && W.use) { try { if (keep == null) localStorage.removeItem('pc-studio-last'); else localStorage.setItem('pc-studio-last', keep); } catch (e) { } res(W); }
      else if (n++ < 300) setTimeout(wait, 100); else rej(new Error('Plan Studio did not start.')); };
    frame.addEventListener('load', wait);
  });
  ready.catch(() => { ready = null; });
  return ready;
}

// run fn with this version open in Plan Studio; Plan Studio's own "last project" is put back afterwards
async function withModel(version, site, name, fn) {
  const W = await studio(), keep = (() => { try { return localStorage.getItem('pc-studio-last'); } catch (e) { return null; } })();
  try { W.use(toStudio(version.model, site, { name, id: 'ws-' + version.id })); return fn(W); }
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
