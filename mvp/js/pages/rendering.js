// Rendering (main flow step 4) and Boards (step 5). Rendering talks to the operator render service in server/ (it needs that
// service's URL and operator token, and the service needs its own image-model credentials); without them this page says so and
// creates nothing. Renders are saved as project assets marked "not performance evidence". Boards compose already saved
// material — engine previews, metrics and saved renders — into one sheet, without asking for another upload.
import * as S from '../store.js';
import { SIMS } from '../data.js';
import { $, $$, esc, currentProject, setCurrent, toast } from '../app.js';

const CFG = 'pc-render-service';
const cfg = () => { try { return JSON.parse(localStorage.getItem(CFG) || '{}'); } catch { return {}; } };
const fileURL = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
export async function requestRender(service, body) {
  const r = await fetch(service.url.replace(/\/+$/, '') + '/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + service.token }, body: JSON.stringify(body), credentials: 'omit' });
  const out = await r.json().catch(() => ({ error: 'The service returned no JSON.' }));
  if (!r.ok || !/^data:image\//.test(out.image_data_url || '')) throw Error(out.error || 'Rendering failed (HTTP ' + r.status + ').');
  return out;
}

export function render(app, [kind], params) {
  const p = S.project(params.get('project')) || currentProject();
  if (!p) { app.innerHTML = '<div class="wrap"><h1 class="display md">Choose a project first.</h1><a class="btn" href="#/project/new">Create a project</a></div>'; return; }
  setCurrent(p); p.renders = p.renders || [];
  return kind === 'boards' ? boards(app, p) : rendering(app, p);
}

function rendering(app, p) {
  const c = cfg();
  app.innerHTML = `<div class="wrap pj"><a href="#/project/${esc(p.id)}">← ${esc(p.name)}</a><span class="eyebrow" style="margin-top:20px">Rendering · interior</span><h1 class="display md">Interior rendering</h1>
    <p class="lede">An image from a view of your model, with furniture or material references. Renderings are for presentation only; they are not daylight, comfort or any other performance result.</p>
    <section class="card"><h2>Render service</h2><p class="note" id="rsStatus" role="status">Requires the PlotCloud render service (server/) run by an operator, with its own image-model credentials. Not connected in this browser yet.</p>
      <div class="grid g2"><label class="f">Service URL<input id="rsUrl" value="${esc(c.url || '')}" placeholder="https://render.example.org"></label><label class="f">Operator token<input id="rsToken" type="password" value="${esc(c.token || '')}"></label></div><button class="btn" type="button" id="rsCheck">Save and check service</button></section>
    <section class="card"><h2>Request</h2><div class="grid g2"><label class="f">View of your model (PNG/JPEG)<input type="file" id="rsSource" accept="image/png,image/jpeg"></label><label class="f">Furniture / material references (up to 3)<input type="file" id="rsRefs" accept="image/png,image/jpeg" multiple></label>
      <label class="f">Scene<select id="rsScene">${['Interior', 'Living room', 'Bedroom', 'Kitchen / dining', 'Office interior', 'Hospitality interior'].map((s) => `<option>${s}</option>`).join('')}</select></label><label class="f">Description<textarea id="rsPrompt" rows="2" placeholder="e.g. warm timber, the referenced sofa by the window"></textarea></label></div>
      <button class="btn accent" type="button" id="rsGo">Render</button><p class="note" id="rsMsg" role="status"></p></section>
    <section class="card"><h2>Saved renders</h2><div id="rsList"></div></section></div>`;
  const list = () => { $('#rsList', app).innerHTML = p.renders.map((r, i) => `<figure style="margin:0 0 14px"><img src="${esc(r.image)}" alt="Render ${i + 1}" style="max-width:100%;max-height:320px"><figcaption class="note">${esc(r.created.slice(0, 16).replace('T', ' '))} · ${esc(r.provider || '')} ${esc(r.model || '')} · ${esc(r.prompt)} · not performance evidence</figcaption></figure>`).join('') || '<p class="note">No renders yet.</p>'; };
  list();
  $('#rsCheck', app).onclick = async () => { const s = { url: $('#rsUrl', app).value.trim(), token: $('#rsToken', app).value.trim() }, st = $('#rsStatus', app); try { localStorage.setItem(CFG, JSON.stringify(s)); } catch { }
    if (!/^https?:\/\//.test(s.url)) { st.textContent = 'Enter the service URL from your operator.'; return; }
    try { const r = await fetch(s.url.replace(/\/+$/, '') + '/health', { credentials: 'omit' }); const h = await r.json(); st.textContent = r.ok && h.status === 'ok' ? `Service reachable · ${h.scope} · limitations: ${(h.limitations || []).join(' ')}` : 'Service did not answer as expected.'; }
    catch (e) { st.textContent = 'Service not reachable from this browser: ' + e.message; } };
  $('#rsGo', app).onclick = async () => { const msg = $('#rsMsg', app), s = cfg(), src = $('#rsSource', app).files[0];
    if (!s.url || !s.token) { msg.textContent = 'Connect a render service first. Nothing was generated.'; return; }
    if (!src) { msg.textContent = 'Choose a view of your model as the source image.'; return; }
    msg.textContent = 'Rendering…';
    try { const refs = await Promise.all([...$('#rsRefs', app).files].slice(0, 3).map(fileURL)), prompt = $('#rsPrompt', app).value.trim() || 'Photorealistic interior keeping the geometry of the source view';
      const out = await requestRender(s, { request_id: 'pc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), scene: $('#rsScene', app).value, edit_mode: 'full', source_image: await fileURL(src), reference_images: refs, prompt, ...(refs.length ? { interior_workflow: { schema: 1, intent: 'atmosphere', reference_bindings: refs.map((_, i) => ({ reference_index: i, purpose: 'atmosphere' })) } } : {}) });
      p.renders.push({ id: 'render-' + Date.now().toString(36), image: out.image_data_url, prompt, provider: out.provider, model: out.model, requestId: out.request_id, created: out.created_at || new Date().toISOString(), evidence: 'presentation only — not performance evidence' }); S.save(); msg.textContent = 'Saved to this project.'; list(); }
    catch (e) { msg.textContent = e.message + ' Nothing was saved.'; } };
}

// ---- Boards: one A3 landscape sheet from saved previews, metrics and renders; exported as PNG
function boards(app, p) {
  const items = [...p.runs.filter((r) => r.results?.thumb).map((r) => ({ id: r.id, img: r.results.thumb, caption: `${SIMS.find((s) => s.id === r.simId)?.name || r.simId} · v${S.version(p, r.versionId)?.n ?? '?'} · ${(r.results.kpis || []).slice(0, 2).map((k) => k.join(' ')).join(' · ')} · run ${r.id}` })), ...(p.renders || []).map((r) => ({ id: r.id, img: r.image, caption: 'Rendering (presentation only) · ' + r.prompt.slice(0, 60) }))];
  app.innerHTML = `<div class="wrap pj"><a href="#/project/${esc(p.id)}">← ${esc(p.name)}</a><span class="eyebrow" style="margin-top:20px">Boards</span><h1 class="display md">Presentation board</h1>
    <p class="lede">Pick saved engine previews and renders. Captions carry the run ID; nothing is re-uploaded or recomputed.</p>
    <section class="card"><h2>Panels</h2>${items.length ? items.map((it) => `<label style="display:block"><input type="checkbox" data-item="${esc(it.id)}" checked> ${esc(it.caption)}</label>`).join('') : '<p class="note">No saved previews or renders yet. Save a study result or a render first.</p>'}
      <label class="f">Board title<input id="bdTitle" value="${esc(p.name)}"></label><button class="btn accent" type="button" id="bdMake" ${items.length ? '' : 'disabled'}>Download board (PNG)</button><p class="note" id="bdMsg" role="status"></p></section><canvas id="bdCanvas" width="2339" height="1654" style="width:100%;height:auto;border:1px solid var(--line)" hidden></canvas></div>`;
  const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  $('#bdMake', app).onclick = async () => {
    const pick = items.filter((it) => $(`[data-item="${it.id}"]`, app)?.checked), cv = $('#bdCanvas', app), g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#1f2a44'; g.font = 'bold 64px Inter, Arial, sans-serif'; g.fillText($('#bdTitle', app).value, 80, 120);
    g.font = '28px Inter, Arial, sans-serif'; g.fillStyle = '#6b7385'; g.fillText(`PlotCloud · ${new Date().toISOString().slice(0, 10)} · design screening results, not compliance`, 80, 170);
    const cols = Math.min(3, Math.max(1, pick.length)), rows = Math.ceil(pick.length / cols), cw = (W - 160 - (cols - 1) * 40) / cols, ch = (H - 260 - (rows - 1) * 40) / Math.max(1, rows);
    for (const [i, it] of pick.entries()) { const im = await load(it.img), x = 80 + (i % cols) * (cw + 40), y = 220 + Math.floor(i / cols) * (ch + 40), s = Math.min(cw / im.width, (ch - 60) / im.height);
      g.drawImage(im, x, y, im.width * s, im.height * s); g.fillStyle = '#1f2a44'; g.font = '24px Inter, Arial, sans-serif'; g.fillText(it.caption.slice(0, 110), x, y + im.height * s + 34); }
    cv.hidden = false; const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = `plotcloud-board-${p.name.replace(/[^\w-]+/g, '-').slice(0, 30)}.png`; document.body.append(a); a.click(); a.remove();
    p.boards = [...(p.boards || []), { id: 'board-' + Date.now().toString(36), created: new Date().toISOString(), runIds: pick.filter((x) => !x.id.startsWith('render-')).map((x) => x.id), renderIds: pick.filter((x) => x.id.startsWith('render-')).map((x) => x.id) }]; S.save();
    $('#bdMsg', app).textContent = `Board with ${pick.length} panel(s) downloaded.`; toast('Board downloaded');
  };
}
