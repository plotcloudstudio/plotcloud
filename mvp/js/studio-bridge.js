// Plan Studio (emb/modeler.html) as a hidden helper: it opens a Workspace version and hands back the exact scene a
// simulation engine reads — the same STC.planScene Send to Simulation uses — or the level as DXF.
// Versions never change, so each answer is kept for the session.
import { toStudio } from './studio-convert.js';
import {solarMeshScene} from './analysis-geometry.js?v=mesh-fidelity-20261027-1';
import {tzInfo} from './sunscene.js';

let frame = null, ready = null;
function studio() {
  if (ready) return ready;
  ready = new Promise((res, rej) => {
    const keep = (() => { try { return localStorage.getItem('pc-studio-last'); } catch (e) { return null; } })();
    frame = document.createElement('iframe'); frame.title = 'Plan Studio (model conversion)'; frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:800px;border:0;visibility:hidden';
    frame.src = '../emb/modeler.html?workspace=1&v=furniture-detail-20261027-1'; document.body.appendChild(frame);
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
let modelQueue=Promise.resolve();
function withModel(version,site,name,fn){const task=modelQueue.then(()=>withLoadedModel(version,site,name,fn));modelQueue=task.catch(()=>{});return task;}
async function withLoadedModel(version, site, name, fn) {
  const W = await studio(), keep = (() => { try { return localStorage.getItem('pc-studio-last'); } catch (e) { return null; } })();
  try { W.use(studioModel(version, site, name)); try { const I = frame.contentWindow.__imp; if (I) {I.setMeshes(version.model.meshes || {});I.setOff((version.model.layers||[]).filter(l=>l.visible===false).map(l=>l.name));} } catch (e) { } return await fn(W); }
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
  const pr = withModel(version, site, name, async () => { const w = frame.contentWindow, M = w.__st.M, Sx = w.__st.S;
    return { studio: JSON.parse(JSON.stringify(M)), meshes: await w.S3.wsMeshes(M, Sx, { hidden: new Set(M.hiddenIds || []) }) }; });
  pr.catch(() => MESH.delete(version.id)); MESH.set(version.id, pr); return pr;
}
// Plan Studio's site tools (SITEC in emb/modeler.html): the new-project-from-the-map page builds the site with them,
// so there is one owner of the site format
export async function sitec() { await studio(); return frame.contentWindow.__SITEC; }
export function studioSolarScene(version,site,name,projectId){return withModel(version,site,name,async()=>{const w=frame.contentWindow,M=w.__st.M,sc=w.__st.S,raw=await w.S3.wsMeshes(M,sc,{hidden:new Set(M.hiddenIds||[])}),C=w.__SITEC;
 const scene=solarMeshScene(raw,version.model,{name,site,versionId:version.id,projectId,context:M.site?C.contextMasses(M.site,M.north||0):[],terrain:M.site?C.terrainForPlan(M.site,M.north||0):null});
 if(scene.loc)Object.assign(scene.loc,tzInfo(site));
 return{ok:true,scene:JSON.stringify(scene),info:`${scene.geometryAudit.objects} mesh objects · ${scene.geometryAudit.triangles.toLocaleString('en-CA')} triangles · original geometry`};});}
export async function studioOBJ(version,site,name){const {meshes}=await studioMeshes(version,site,name),off=new Set((version.model.layers||[]).filter(l=>l.visible===false).map(l=>l.name)),imports=new Map((version.model.studio?.imports||[]).map(o=>[String(o.id),o]));
 const lines=['# PlotCloud Workspace surface meshes, metres, Y up'];let base=1;
 for(const m of meshes){const im=imports.get(String(m.id));if(im&&off.has(im.layer))continue;lines.push('o '+String(m.id).replace(/[^a-z0-9_-]/gi,'_'));for(let i=0;i<m.pos.length;i+=3)lines.push(`v ${m.pos[i]} ${m.pos[i+2]} ${-m.pos[i+1]}`);for(let i=0;i<m.pos.length/3;i+=3)lines.push(`f ${base+i} ${base+i+1} ${base+i+2}`);base+=m.pos.length/3;}
 return{text:lines.join('\n'),geometryAudit:{objects:lines.filter(l=>l.startsWith('o ')).length,triangles:(base-1)/3,units:'m',axis:'y-up',representation:'Workspace surface meshes'}};}
