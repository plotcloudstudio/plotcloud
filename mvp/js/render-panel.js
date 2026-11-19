// Render (2026-11-19): the interior rendering task in one window, opened from the Workspace. A view of the 3D model is the
// base; the designer names the furniture to show (as modelled, and with reference pictures of the products), paints the area
// that may change (or leaves the whole view), says the intent, and generates with their own OpenAI key. Each result is kept
// with what made it (view, level, model revision, references, region, wording, image model, time), can be compared with the
// view or another result, used as the base for the next edit, and saved as a captioned PNG.
// A render is a presentation image only; when the model changes after it, it is marked as showing an earlier model.
import * as RA from './render-ai.js?v=render-20261119-1';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fileURL = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
const PRESETS = ['Warm oak floor, white plaster walls, linen textiles', 'Calm healthcare interior: soft daylight, easy-clean surfaces, wood accents', 'Evening, warm artificial light, lamps on', 'Overcast daylight, neutral colour balance', 'Concrete, black steel and glass, minimal'];
const STYLE = `.rn{position:fixed;inset:0;z-index:120;background:rgba(20,26,38,.42);display:flex;align-items:stretch;justify-content:center;padding:18px}
.rn-win{background:var(--paper,#fff);color:var(--ink,#1d2433);border-radius:14px;box-shadow:0 24px 70px rgba(0,0,0,.28);display:grid;grid-template-rows:auto 1fr;width:min(1480px,100%);overflow:hidden}
.rn-hd{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid var(--line,#e3e6ec)}.rn-hd b{font-size:16px}.rn-hd .rn-tag{font-size:12px;color:var(--mut,#667085)}.rn-hd .rn-x{margin-left:auto;border:0;background:none;font-size:22px;cursor:pointer;color:inherit}
.rn-body{display:grid;grid-template-columns:340px 1fr;min-height:0}.rn-side{overflow:auto;border-right:1px solid var(--line,#e3e6ec);padding:6px 16px 18px}
.rn-side section{border-bottom:1px solid var(--line,#e3e6ec);padding:12px 0}.rn-side h3{font-size:13px;margin:0 0 8px;display:flex;gap:6px;align-items:baseline}.rn-side h3 i{font-style:normal;color:var(--mut,#667085);font-weight:500}
.rn-side label{display:block;font-size:12px;color:var(--mut,#667085);margin:6px 0 2px}.rn-side input[type=text],.rn-side input[type=password],.rn-side select,.rn-side textarea{width:100%;box-sizing:border-box;font:inherit;font-size:13px;padding:6px 8px;border:1px solid var(--line,#d5d9e0);border-radius:7px;background:#fff;color:inherit}
.rn-note{font-size:12px;color:var(--mut,#667085);margin:6px 0 0;line-height:1.45}.rn-msg{font-size:12.5px;margin:6px 0 0}.rn-msg.warn{color:#b42318}.rn-msg.ok{color:#067647}
.rn-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px}.rn-chips button{font-size:11.5px;border:1px solid var(--line,#d5d9e0);background:#fff;border-radius:99px;padding:3px 8px;cursor:pointer;color:inherit}
.rn-furn{list-style:none;margin:0;padding:0;max-height:150px;overflow:auto;font-size:12.5px}.rn-furn li{display:flex;gap:6px;align-items:center;padding:2px 0}
.rn-refs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px}.rn-refs figure{margin:0;border:1px solid var(--line,#e3e6ec);border-radius:8px;padding:4px;position:relative;font-size:11px}.rn-refs img{width:100%;aspect-ratio:1;object-fit:contain;background:#f6f7f9;border-radius:5px}
.rn-refs input{width:100%;box-sizing:border-box;font-size:11px;border:0;border-top:1px solid var(--line,#eee);margin-top:3px;padding:2px 0;background:none;color:inherit}.rn-refs .rn-rm{position:absolute;top:2px;right:4px;border:0;background:#fff;border-radius:50%;cursor:pointer;line-height:1}
.rn-mine{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}.rn-mine button{border:1px solid var(--line,#e3e6ec);background:#fff;border-radius:6px;padding:2px;cursor:pointer;width:46px}.rn-mine img{width:40px;height:40px;object-fit:contain;display:block}
.rn-main{display:grid;grid-template-rows:auto 1fr auto;min-height:0;background:#f4f5f7}.rn-bar{display:flex;gap:8px;align-items:center;padding:8px 14px;border-bottom:1px solid var(--line,#e3e6ec);background:#fff;font-size:12.5px;flex-wrap:wrap}
.rn-bar .seg{display:inline-flex;border:1px solid var(--line,#d5d9e0);border-radius:8px;overflow:hidden}.rn-bar .seg button{border:0;background:#fff;padding:4px 10px;cursor:pointer;font:inherit;color:inherit}.rn-bar .seg button[aria-pressed=true]{background:var(--ink,#1d2433);color:#fff}
.rn-stage{position:relative;display:flex;align-items:center;justify-content:center;min-height:0;overflow:hidden;padding:14px}.rn-frame{position:relative;max-width:100%;max-height:100%;line-height:0;box-shadow:0 2px 12px rgba(0,0,0,.12)}
.rn-frame img{max-width:100%;max-height:calc(100vh - 290px);display:block}.rn-frame canvas{position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;opacity:.45}
.rn-empty{color:var(--mut,#667085);font-size:14px;text-align:center;max-width:420px;line-height:1.5}.rn-cmp{position:relative;line-height:0}.rn-cmp .rn-top{position:absolute;inset:0;overflow:hidden}.rn-cmp .rn-top img{max-width:none}
.rn-cmp input[type=range]{position:absolute;left:12px;right:12px;bottom:10px;width:calc(100% - 24px);accent-color:#fff;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))}.rn-cmpl{position:absolute;top:8px;font:600 11.5px/1 Inter,sans-serif;background:rgba(255,255,255,.9);padding:4px 7px;border-radius:5px;color:#1d2433}
.rn-strip{display:flex;gap:10px;overflow-x:auto;padding:10px 14px;border-top:1px solid var(--line,#e3e6ec);background:#fff;min-height:132px}.rn-card{flex:0 0 200px;border:1px solid var(--line,#e3e6ec);border-radius:9px;padding:6px;font-size:11.5px;background:#fff}
.rn-card[aria-current=true]{outline:2px solid var(--accent,#2563eb)}.rn-card img{width:100%;height:96px;object-fit:cover;border-radius:6px;cursor:pointer;background:#eef0f3}.rn-card .rn-meta{color:var(--mut,#667085);margin:3px 0}.rn-card .rn-stale{color:#b54708}
.rn-card .rn-acts{display:flex;gap:4px;flex-wrap:wrap}.rn-card .rn-acts button{font-size:11px;border:1px solid var(--line,#d5d9e0);background:#fff;border-radius:6px;padding:2px 6px;cursor:pointer;color:inherit}
.rn-go{width:100%;margin-top:8px}`;

export function openRender(ctx) {
  const { p, S, studio, capture, level, toast } = ctx;
  if (document.querySelector('.rn')) return;
  if (!document.getElementById('rn-css')) { const st = document.createElement('style'); st.id = 'rn-css'; st.textContent = STYLE; document.head.append(st); }
  p.renders = Array.isArray(p.renders) ? p.renders : [];
  const R = { key: RA.savedKey(), models: [], model: RA.savedModel(), base: null, baseFrom: 'view', refs: [], furnOff: new Set(), tool: 'brush', brush: 60, mode: 'edit', cmp: null, busy: false, ac: null, cur: null };
  const el = document.createElement('div'); el.className = 'rn'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Render');
  el.innerHTML = `<div class="rn-win"><div class="rn-hd"><b>Render · interior</b><span class="rn-tag">Presentation images made by OpenAI from a view of this model, with your own key. Not a daylight, comfort or other performance result.</span><button type="button" class="rn-x" data-rn="close" aria-label="Close Render">×</button></div>
    <div class="rn-body"><div class="rn-side">
      <section><h3>1 · OpenAI <i data-rn-svc></i></h3>
        <label for="rnKey">Your OpenAI API key</label><input type="password" id="rnKey" autocomplete="off" spellcheck="false" placeholder="sk-…" value="${esc(R.key)}">
        <div class="rn-row"><label style="margin:0;display:flex;gap:5px;align-items:center;color:inherit"><input type="checkbox" id="rnRem" ${RA.keyRemembered() ? 'checked' : ''}> Remember on this device</label><button type="button" class="btn sm" data-rn="connect">Connect</button></div>
        <label for="rnModel">Image model</label><select id="rnModel" disabled><option>Connect first</option></select>
        <p class="rn-msg" data-rn-kmsg role="status"></p>
        <p class="rn-note">The key stays in this browser and is sent only to api.openai.com. The view, the reference pictures and your words go from this browser to OpenAI; each image is billed to your OpenAI account. PlotCloud's servers are not involved.</p></section>
      <section><h3>2 · View <i data-rn-vinfo>not captured</i></h3>
        <label for="rnSize">Image size</label><select id="rnSize">${RA.SIZES.map(([v, t]) => `<option value="${v}">${t} · ${v.replace('x', ' × ')}</option>`).join('')}</select>
        <button type="button" class="btn sm rn-go" data-rn="capture">Capture the 3D view</button><p class="rn-note">Frame the room in the 3D view first (walk or orbit); the capture uses that camera.</p></section>
      <section><h3>3 · Furniture <i data-rn-fcount></i></h3><ul class="rn-furn" data-rn-furn></ul>
        <label>Reference pictures of products (up to 4)</label><div class="rn-refs" data-rn-refs></div>
        <div class="rn-row"><label class="btn sm" style="margin:0;color:inherit">Add pictures<input type="file" id="rnRefFile" accept="image/png,image/jpeg,image/webp" multiple hidden></label></div>
        <div data-rn-minewrap></div></section>
      <section><h3>4 · Area to change <i data-rn-reg>the whole view</i></h3><div class="rn-row"><span class="seg" style="display:inline-flex;border:1px solid var(--line,#d5d9e0);border-radius:8px;overflow:hidden" data-rn-tools>${[['brush', 'Paint'], ['rect', 'Box'], ['erase', 'Erase']].map(([k, t]) => `<button type="button" data-rn-tool="${k}" aria-pressed="${k === 'brush'}" style="border:0;background:#fff;padding:4px 9px;cursor:pointer;font:inherit;color:inherit">${t}</button>`).join('')}</span>
        <label style="margin:0">Brush<input type="range" id="rnBrush" min="10" max="200" value="60" style="width:80px;vertical-align:middle"></label><button type="button" class="btn sm" data-rn="clearreg">Whole view</button></div>
        <p class="rn-note">Paint over the part that may change (a sofa, a wall finish); nothing painted means the whole view. The image model follows the area as guidance, not to the pixel.</p></section>
      <section><h3>5 · Intent</h3><textarea id="rnDesc" rows="3" placeholder="e.g. Scandinavian patient lounge: pale oak, sage green upholstery, soft daylight"></textarea>
        <div class="rn-row rn-chips">${PRESETS.map((t) => `<button type="button" data-rn-pre="${esc(t)}">${esc(t.split(':')[0].split(',')[0])}</button>`).join('')}</div>
        <label style="display:flex;gap:6px;align-items:center;color:inherit;margin-top:8px"><input type="checkbox" id="rnKeep" checked> Keep camera, geometry and furniture layout</label></section>
      <section><h3>6 · Generate</h3><div class="rn-row"><label style="margin:0">Quality <select id="rnQ" style="width:auto">${RA.QUALITY.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label><label style="margin:0">Images <select id="rnN" style="width:auto"><option>1</option><option>2</option></select></label></div>
        <button type="button" class="btn accent rn-go" data-rn="go" disabled>Generate</button><button type="button" class="btn sm rn-go" data-rn="stop" hidden>Stop</button><p class="rn-msg" data-rn-gmsg role="status"></p></section>
    </div>
    <div class="rn-main"><div class="rn-bar"><span class="seg"><button type="button" data-rn-mode="edit" aria-pressed="true">Base and area</button><button type="button" data-rn-mode="cmp" aria-pressed="false">Compare</button></span><span data-rn-base></span><span style="margin-left:auto" data-rn-cmpctl></span></div>
      <div class="rn-stage" data-rn-stage></div><div class="rn-strip" data-rn-strip aria-label="Renders of this project"></div></div></div></div>`;
  document.body.append(el);
  const q = (s) => el.querySelector(s), say = (s, t, k) => { const m = q(s); m.textContent = t || ''; m.className = 'rn-msg' + (k ? ' ' + k : ''); };
  const studioNow = () => studio() || {}, revNow = () => RA.modelRev(studioNow());
  let region = null;   // the painted area, a canvas at the base image's size

  // ---- 1 · the key and the model
  async function connect(quiet) { const k = q('#rnKey').value.trim(); if (!k) { if (!quiet) say('[data-rn-kmsg]', 'Paste your OpenAI API key first.', 'warn'); return; }
    say('[data-rn-kmsg]', 'Checking the key…'); try { const ms = await RA.listModels(k); R.key = k; RA.setKey(k, q('#rnRem').checked); R.models = ms;
      if (!ms.length) { say('[data-rn-kmsg]', 'This key works, but no image model is available to it. Check the OpenAI organization’s model access.', 'warn'); return; }
      if (!ms.includes(R.model)) R.model = ms[0]; RA.setModel(R.model); const sel = q('#rnModel'); sel.disabled = false; sel.innerHTML = ms.map((m) => `<option ${m === R.model ? 'selected' : ''}>${esc(m)}</option>`).join('');
      say('[data-rn-kmsg]', `Connected · ${ms.length} image model${ms.length === 1 ? '' : 's'} available`, 'ok'); q('[data-rn-svc]').textContent = 'connected'; ready(); }
    catch (e) { say('[data-rn-kmsg]', e.message, 'warn'); } }
  // ---- 2 · the view
  async function doCapture() { const [w, h] = q('#rnSize').value.split('x').map(Number); q('[data-rn-vinfo]').textContent = 'capturing…';
    try { const v = await capture(w, h), lv = level(); R.base = { image: v.imageData, w, h, camera: v.camera, lv: lv?.id || null, lvName: lv?.name || '', rev: revNow(), at: new Date().toISOString() }; R.baseFrom = 'view'; newRegion(); R.mode = 'edit'; drawFurn(); drawStage(); ready();
      q('[data-rn-vinfo]').textContent = `${lv?.name ? lv.name + ' · ' : ''}${w} × ${h}`; }
    catch (e) { q('[data-rn-vinfo]').textContent = 'not captured'; say('[data-rn-gmsg]', e.message || 'The 3D view could not be captured.', 'warn'); } }
  // ---- 3 · furniture in the view's level, and reference pictures
  const furnHere = () => (studioNow().furn || []).filter((f) => !R.base?.lv || f.lv === R.base.lv);
  const furnText = (f) => `${f.label || f.name || f.type || 'piece'}${f.w ? ` ${(+f.w).toFixed(2)} × ${(+f.d || 0).toFixed(2)}${f.h ? ` × ${(+f.h).toFixed(2)}` : ''} m` : ''}`;
  function drawFurn() { const L = furnHere(), on = L.filter((f) => !R.furnOff.has(f.id)).length; q('[data-rn-fcount]').textContent = L.length ? `${on} of ${L.length} named` : 'none on this level';
    q('[data-rn-furn]').innerHTML = L.length ? L.slice(0, 80).map((f) => `<li><input type="checkbox" data-rn-f="${esc(f.id)}" ${R.furnOff.has(f.id) ? '' : 'checked'} aria-label="Name ${esc(furnText(f))} in the request"><span>${esc(furnText(f))}</span></li>`).join('') : `<li class="rn-note">${R.base ? 'No modelled furniture on this level.' : 'Capture a view to list its level’s furniture.'}</li>`;
    q('[data-rn-refs]').innerHTML = R.refs.map((r, i) => `<figure><img src="${r.image}" alt=""><button type="button" class="rn-rm" data-rn-rm="${i}" aria-label="Remove reference ${i + 1}">×</button><input type="text" data-rn-rn="${i}" value="${esc(r.name)}" aria-label="What reference ${i + 1} shows" placeholder="e.g. lounge chair"></figure>`).join('');
    const mine = (S.account().furniture || []).filter((x) => x.thumb).slice(0, 12); q('[data-rn-minewrap]').innerHTML = mine.length ? `<label>From My furniture</label><div class="rn-mine">${mine.map((x, i) => `<button type="button" data-rn-mine="${i}" title="Add ${esc(x.name)} as a reference"><img src="${x.thumb}" alt="${esc(x.name)}"></button>`).join('')}</div>` : ''; }
  async function addRef(image, name) { if (R.refs.length >= 4) { say('[data-rn-gmsg]', 'Up to 4 reference pictures.', 'warn'); return; } R.refs.push({ image: await asPng(image), name: name || '' }); drawFurn(); }
  // ---- 4 · the area to change, painted over the base
  function newRegion() { region = document.createElement('canvas'); region.width = R.base.w; region.height = R.base.h; regInfo(); }
  function regInfo() { const m = region && RA.maskFrom(region); q('[data-rn-reg]').textContent = m ? `${Math.round(m.share * 100)} % of the view` : 'the whole view'; return m; }
  // ---- the stage: the base with its area, or a comparison
  function drawStage() { const st = q('[data-rn-stage]'); el.querySelectorAll('[data-rn-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rnMode === R.mode)));
    const baseLbl = R.baseFrom === 'view' ? 'Base: the 3D view' : `Base: render ${R.baseFrom.slice(7)}`; q('[data-rn-base]').textContent = R.base ? baseLbl : '';
    if (R.mode === 'cmp') return drawCmp(st); q('[data-rn-cmpctl]').innerHTML = '';
    if (!R.base) { st.innerHTML = `<div class="rn-empty"><b>Capture the 3D view to start.</b><br>The view is the base: the image model keeps its camera and layout and changes the area you paint.</div>`; return; }
    st.innerHTML = '<div class="rn-frame"><img alt="The base image" data-rn-bimg></div>'; const fr = st.firstChild, img = fr.firstChild; img.src = R.base.image; region.setAttribute('aria-label', 'Area to change: paint over the image'); fr.append(region); paintOverlay(); }
  function paintOverlay() { /* the painted area shows blue at 45 % (canvas opacity); nothing else to do */ }
  async function drawCmp(st) { const opts = [['view', 'The 3D view'], ...p.renders.map((r, i) => [r.id, `Render ${i + 1}`])], a = R.cmp?.[0] || 'view', b = R.cmp?.[1] || p.renders.at(-1)?.id;
    q('[data-rn-cmpctl]').innerHTML = `Left <select data-rn-ca>${opts.map(([v, t]) => `<option value="${v}" ${v === a ? 'selected' : ''}>${t}</option>`).join('')}</select> Right <select data-rn-cb>${opts.map(([v, t]) => `<option value="${v}" ${v === b ? 'selected' : ''}>${t}</option>`).join('')}</select> <button type="button" class="btn sm" data-rn="cmpsave" ${b ? '' : 'disabled'}>Save side by side</button>`;
    if (!b) { st.innerHTML = '<div class="rn-empty">Generate a render first; then compare it with the view or another render.</div>'; return; }
    const [ia, ib] = await Promise.all([imgOf(a, b), imgOf(b, a)]); if (!ia || !ib) { st.innerHTML = '<div class="rn-empty">This image is not in this browser (renders are kept on the device that made them).</div>'; return; }
    st.innerHTML = `<div class="rn-cmp"><div class="rn-frame"><img src="${ib}" alt="Right image" data-rn-cimg></div><div class="rn-top" style="width:50%"><img src="${ia}" alt="Left image"></div><span class="rn-cmpl" style="left:8px">${esc(opts.find((o) => o[0] === a)[1])}</span><span class="rn-cmpl" style="right:8px">${esc(opts.find((o) => o[0] === b)[1])}</span><input type="range" min="0" max="100" value="50" aria-label="Divide between the two images" data-rn-split></div>`;
    const top = st.querySelector('.rn-top'), under = st.querySelector('[data-rn-cimg]'); const fit = () => { top.firstChild.style.width = under.clientWidth + 'px'; top.firstChild.style.height = under.clientHeight + 'px'; }; under.onload = fit; fit();
    st.querySelector('[data-rn-split]').oninput = (e) => { top.style.width = e.target.value + '%'; }; }
  // 'view' is the 3D view the other render was made from (its own base); with no render beside it, the base captured now
  async function imgOf(id, other) { if (id === 'view') { const rec = other && other !== 'view' ? await RA.getImages(other) : null; return rec?.source || R.base?.image || null; } const rec = await RA.getImages(id); return rec?.result || null; }
  // ---- the results
  async function drawStrip() { const rev = revNow(), st = q('[data-rn-strip]'); if (!p.renders.length) { st.innerHTML = '<p class="rn-note" style="margin:auto">Renders of this project appear here, each with what made it. They are kept in this browser.</p>'; return; }
    st.innerHTML = p.renders.map((r, i) => `<div class="rn-card" data-rn-card="${esc(r.id)}" ${R.cur === r.id ? 'aria-current="true"' : ''}><img alt="Render ${i + 1}" data-rn-open="${esc(r.id)}"><div class="rn-meta"><b>Render ${i + 1}</b> · ${esc(r.at.slice(0, 16).replace('T', ' '))}<br>${esc(r.level || 'view')} · ${esc(r.model)}${r.region ? ` · area ${Math.round(r.region * 100)} %` : ''}${r.refs?.length ? ` · ${r.refs.length} ref.` : ''}</div>${r.rev !== rev ? '<div class="rn-meta rn-stale">The model has changed since this render</div>' : ''}
      <div class="rn-acts"><button type="button" data-rn-cmp="${esc(r.id)}">Compare</button><button type="button" data-rn-base="${esc(r.id)}">Edit further</button><button type="button" data-rn-dl="${esc(r.id)}">PNG</button><button type="button" data-rn-del="${esc(r.id)}" aria-label="Delete render ${i + 1}">Delete</button></div></div>`).join('');
    for (const r of p.renders) { const rec = await RA.getImages(r.id).catch(() => null), im = st.querySelector(`[data-rn-open="${CSS.escape(r.id)}"]`); if (im) { if (rec?.result) im.src = rec.result; else im.alt = 'Not in this browser'; } } }
  function ready() { q('[data-rn="go"]').disabled = R.busy || !R.base || !R.models.length; }
  async function generate() {
    const m = regInfo(), furniture = furnHere().filter((f) => !R.furnOff.has(f.id)).map(furnText), desc = q('#rnDesc').value, keep = q('#rnKeep').checked, refs = R.refs.map((r) => ({ name: r.name.trim(), image: r.image }));
    const prompt = RA.buildPrompt({ desc, furniture, refs, region: !!m, keep }), size = `${R.base.w}x${R.base.h}`, quality = q('#rnQ').value, n = +q('#rnN').value;
    R.busy = true; R.ac = new AbortController(); ready(); q('[data-rn="stop"]').hidden = false; say('[data-rn-gmsg]', `Generating ${n === 1 ? 'one image' : n + ' images'} with ${R.model}… this can take a minute.`);
    try { const out = await RA.renderEdit({ key: R.key, model: R.model, image: R.base.image, mask: m?.dataURL || null, refs, prompt, size, quality, n, signal: R.ac.signal });
      for (const img of out.images) { const id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        await RA.putImages(id, { result: img, source: R.base.image, mask: m?.dataURL || null, refs: refs.map((r) => r.image) });
        p.renders.push({ id, at: new Date().toISOString(), model: R.model, size, quality, prompt, desc: desc.trim(), refs: refs.map((r) => r.name || 'reference'), furniture: furniture.length, region: m ? +m.share.toFixed(3) : 0, keep,
          base: R.baseFrom, level: R.base.lvName || '', lv: R.base.lv, camera: R.base.camera, rev: R.base.rev, viewAt: R.base.at, evidence: 'presentation only' }); R.cur = id; }
      S.save(); say('[data-rn-gmsg]', `Done: ${out.images.length} render${out.images.length === 1 ? '' : 's'} saved with this project, in this browser.`, 'ok'); R.mode = 'cmp'; R.cmp = ['view', R.cur]; await drawStrip(); drawStage(); toast?.('Render saved');
    } catch (e) { say('[data-rn-gmsg]', e.message, 'warn'); } finally { R.busy = false; R.ac = null; q('[data-rn="stop"]').hidden = true; ready(); } }
  async function download(r) { const rec = await RA.getImages(r.id); if (!rec?.result) return say('[data-rn-gmsg]', 'This image is not in this browser.', 'warn'); const i = p.renders.indexOf(r) + 1;
    const url = await RA.captioned(rec.result, [`${p.name} · Render ${i} · ${r.level || 'view'} · ${r.at.slice(0, 16).replace('T', ' ')} · ${r.model}${r.rev !== revNow() ? ' · model changed since' : ''}`, 'Presentation image made with OpenAI from a PlotCloud model view. Not a daylight, comfort or other performance result.']);
    save(url, `${slug(p.name)}-render-${i}.png`); }
  const slug = (s) => String(s || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'project';
  const save = (url, name) => { const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); };
  async function asPng(src) { const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(Error('That picture could not be read.')); i.src = src; });
    const k = Math.min(1, 1024 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/png'); }

  // ---- painting the area
  let drag = null; const ptOf = (e) => { const b = region.getBoundingClientRect(); return [(e.clientX - b.left) * region.width / b.width, (e.clientY - b.top) * region.height / b.height]; };
  el.addEventListener('pointerdown', (e) => { if (e.target !== region) return; e.preventDefault(); region.setPointerCapture(e.pointerId); const p0 = ptOf(e); drag = { p0, snap: R.tool === 'rect' ? region.getContext('2d').getImageData(0, 0, region.width, region.height) : null }; stroke(p0, p0); });
  el.addEventListener('pointermove', (e) => { if (!drag) return; const pt = ptOf(e); if (R.tool === 'rect') { const x = region.getContext('2d'); x.putImageData(drag.snap, 0, 0); x.fillStyle = '#2563eb'; x.fillRect(Math.min(drag.p0[0], pt[0]), Math.min(drag.p0[1], pt[1]), Math.abs(pt[0] - drag.p0[0]), Math.abs(pt[1] - drag.p0[1])); } else { stroke(drag.last || drag.p0, pt); drag.last = pt; } });
  el.addEventListener('pointerup', () => { if (drag) { drag = null; regInfo(); } });
  function stroke(a, b) { if (R.tool === 'rect') return; const x = region.getContext('2d'), r = R.brush * region.width / 1536; x.globalCompositeOperation = R.tool === 'erase' ? 'destination-out' : 'source-over'; x.strokeStyle = x.fillStyle = '#2563eb'; x.lineWidth = r * 2; x.lineCap = 'round'; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0] + 0.01, b[1]); x.stroke(); x.globalCompositeOperation = 'source-over'; }

  // ---- clicks and inputs
  const close = () => { R.ac?.abort(); el.remove(); removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape' && !drag) { e.stopPropagation(); close(); } }; addEventListener('keydown', onKey, true);
  el.addEventListener('click', async (e) => { const b = e.target.closest('button'); if (!b) { if (e.target === el) close(); return; } const d = b.dataset;
    if (d.rn === 'close') close(); else if (d.rn === 'connect') connect(); else if (d.rn === 'capture') doCapture(); else if (d.rn === 'go') generate(); else if (d.rn === 'stop') R.ac?.abort();
    else if (d.rn === 'clearreg') { if (R.base) { newRegion(); drawStage(); } } else if (d.rnTool) { R.tool = d.rnTool; el.querySelectorAll('[data-rn-tool]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }
    else if (d.rnPre) { const t = q('#rnDesc'); t.value = (t.value.trim() ? t.value.trim() + '. ' : '') + d.rnPre; }
    else if (d.rnMode) { R.mode = d.rnMode; drawStage(); }
    else if (d.rnRm) { R.refs.splice(+d.rnRm, 1); drawFurn(); } else if (d.rnMine) { const x = (S.account().furniture || []).filter((y) => y.thumb)[+d.rnMine]; if (x) addRef(x.thumb, x.name); }
    else if (d.rnCmp) { R.mode = 'cmp'; R.cmp = ['view', d.rnCmp]; R.cur = d.rnCmp; drawStage(); drawStrip(); }
    else if (d.rnBase) { const r = p.renders.find((x) => x.id === d.rnBase), rec = await RA.getImages(d.rnBase); if (!rec?.result) return; const [w, h] = r.size.split('x').map(Number); R.base = { image: rec.result, w, h, camera: r.camera, lv: r.lv, lvName: r.level, rev: r.rev, at: r.viewAt }; R.baseFrom = 'render:' + (p.renders.indexOf(r) + 1); newRegion(); R.mode = 'edit'; drawStage(); ready(); }
    else if (d.rnDl) { const r = p.renders.find((x) => x.id === d.rnDl); if (r) download(r); }
    else if (d.rnDel) { const i = p.renders.findIndex((x) => x.id === d.rnDel); if (i < 0 || !confirm(`Delete render ${i + 1} from this project?`)) return; p.renders.splice(i, 1); S.save(); RA.delImages(d.rnDel).catch(() => {}); if (R.cmp?.includes(d.rnDel)) R.cmp = null; drawStrip(); drawStage(); }
    else if (d.rn === 'cmpsave') { const a = q('[data-rn-ca]').value, bb = q('[data-rn-cb]').value, [ia, ib] = await Promise.all([imgOf(a, bb), imgOf(bb, a)]); if (!ia || !ib) return; const lab = (v) => v === 'view' ? 'The 3D view' : 'Render ' + (p.renders.findIndex((x) => x.id === v) + 1);
      save(await RA.sideBySide(ia, ib, [lab(a), lab(bb)]), `${slug(p.name)}-compare.png`); } });
  el.addEventListener('change', async (e) => { const t = e.target;
    if (t.id === 'rnModel') { R.model = t.value; RA.setModel(R.model); } else if (t.id === 'rnRem') { if (R.key) RA.setKey(R.key, t.checked); }
    else if (t.dataset.rnF) { if (t.checked) R.furnOff.delete(t.dataset.rnF); else R.furnOff.add(t.dataset.rnF); drawFurn(); }
    else if (t.id === 'rnRefFile') { for (const f of [...t.files].slice(0, 4)) { try { await addRef(await fileURL(f), f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ')); } catch (er) { say('[data-rn-gmsg]', er.message, 'warn'); } } t.value = ''; }
    else if (t.matches('[data-rn-ca],[data-rn-cb]')) { R.cmp = [q('[data-rn-ca]').value, q('[data-rn-cb]').value]; drawStage(); } });
  el.addEventListener('input', (e) => { if (e.target.id === 'rnBrush') R.brush = +e.target.value; else if (e.target.dataset.rnRn != null) R.refs[+e.target.dataset.rnRn].name = e.target.value; });
  drawFurn(); drawStage(); drawStrip(); if (R.key) connect(true);
  return { el, close, state: () => ({ models: R.models, model: R.model, base: !!R.base, refs: R.refs.length, region: region ? RA.maskFrom(region)?.share || 0 : 0, renders: p.renders.length, mode: R.mode, busy: R.busy }) };
}
