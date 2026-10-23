// Sun Hours: the PlotCloud Sun Hours engine (emb/sunhours.html, the same file the classic site's tool runs) in the current page shell.
// One implementation: nothing here computes or draws sun hours. This page only
//   sends the version's model, site and north (from Account / the project) as the engine's own scene format,
//   hides the engine's Model and Site & north sections, keeps Plan / 3D / Sun's view with the engine's own results column on the right,
//   makes the left sections collapsible, and saves the engine's results to the version.
import * as S from '../store.js';
import { $, esc, toast, currentProject, setCurrent, currentVersion, setCurrentVersion, simBack, LIVE } from '../app.js';
import { sunScene, tzInfo } from '../sunscene.js';

export function render(app, sim) {
  const p = currentProject();
  if (!p) { app.innerHTML = '<div class="wrap"><p>No project. <a href="#/">Create one on Home.</a></p></div>'; return; }
  setCurrent(p);
  const v = currentVersion(p), site = p.site || S.account().site, t = tzInfo(site);
  app.innerHTML = `<div class="shx">
    <div class="shbar" role="region" aria-label="Simulation">
      <a class="btn sm ghost" href="${simBack()}">← Back</a>
      <b class="shname">${esc(sim.name)}</b>${LIVE}
      <label class="shsel">Project<select id="proj">${S.projects().map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label class="shsel">Version<select id="ver">${p.versions.slice().reverse().map((x) => `<option value="${x.id}" ${x === v ? 'selected' : ''}>v${x.n} — ${esc(x.note)}</option>`).join('') || '<option>No saved versions</option>'}</select></label>
      <a class="shsite" href="#/account" title="Site, north and time zone come from Account">${esc((site?.label || '—').split(',').slice(0, 2).join(','))}${site?.sample ? ' (sample)' : ''} · north ${site?.north ?? 0}° · UTC${t.tz >= 0 ? '+' : ''}${t.tz}${t.dst ? ' with DST' : ''}</a>
      <span class="sp"></span>
      <span class="note" id="shmsg" role="status" aria-live="polite"></span>
      <button class="btn sm primary" id="save" disabled>Save result${v ? ` to v${v.n}` : ''}</button>
    </div>
    ${v ? '<iframe id="eng" data-emb="sunhours" title="Sun hours" src="../emb/sunhours.html"></iframe>' : `<div class="wrap"><p class="note">Save a model version first: <a href="#/workspace">open the Workspace</a>.</p></div>`}
  </div>`;
  $('#proj', app).onchange = (e) => { setCurrent(S.project(e.target.value)); render(app, sim); };
  $('#ver', app).onchange = (e) => { setCurrentVersion(p, e.target.value); render(app, sim); };
  if (!v) return;

  const fr = $('#eng', app), msg = $('#shmsg', app), scene = sunScene(v.model, site, { name: `${p.name} · v${v.n}`, project: p.id, version: v.id });
  window.__pcHO = { tool: 'sunhours' };   // the engine asks for the project model at once instead of after its demo analysis
  const onMsg = (e) => {
    if (e.source !== fr.contentWindow || !e.data?.pc) return; const d = e.data;
    if (d.t === 'hello') { fr.contentWindow.postMessage({ pc: 1, t: 'project', scene: JSON.stringify(scene), name: `${p.name} · v${v.n}`, source: scene.source }, '*'); msg.textContent = `Model: ${p.name} v${v.n} · ${scene.masses.filter((m) => m.role === 'proposed').length} blocks, ${scene.masses.filter((m) => m.role === 'context').length} neighbours`; }
    if (d.t === 'save') {
      const doc0 = fr.contentDocument, stats = [...(doc0?.querySelectorAll('#stats dt') || [])].map((dt) => [dt.textContent.trim(), (dt.nextElementSibling?.textContent || '').trim()]);
      const kpis = (Array.isArray(d.kpis) ? d.kpis : []).filter(([, v]) => v && v !== '—').concat(stats.filter(([k]) => !/window|extent/i.test(k))), num = (s) => { const m = String(s).replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? +m[0] : NaN; }, by = (re) => kpis.find(([k]) => re.test(k));
      const results = { kpis, stats, ground: num((by(/^ground(, average)?$/i) || [])[1]), ground2h: num((by(/ground (with )?≥/i) || [])[1]), roofs: num((by(/roof/i) || [])[1]), facades: num((by(/fa[cç]ade/i) || [])[1]) };
      const doc = fr.contentDocument, val = (id) => { const el = doc?.getElementById(id); return el ? (el.selectedOptions?.[0]?.textContent || el.value || '').trim() : ''; }, on = (id) => doc?.querySelector(`#${id} [aria-pressed="true"], #${id} .on`)?.textContent.trim() || '';
      const settings = { site: site?.label, date: doc?.getElementById('date')?.value || on('daySeg'), from: val('t0'), to: val('t1'), detail: on('lvlSeg'), ground: val('ground'), extent: val('margin') };
      S.addRun(p, v.id, 'sunhours', settings, results, 'full-tool'); fr.contentWindow.postMessage({ pc: 1, t: 'saved', count: p.runs.filter((r) => r.versionId === v.id && r.simId === 'sunhours').length }, '*');
      toast(`Saved to v${v.n}`); msg.innerHTML = `Saved to v${v.n} · <a href="#/results/${p.id}?sim=sunhours">Compare versions →</a>`;
    }
  };
  addEventListener('message', onMsg);
  $('#save', app).onclick = () => { const b = fr.contentDocument?.getElementById('pcAdd'); if (b) b.click(); else toast('Run the analysis first.'); };

  // the page shell around the engine: style only
  const CSS = `
    .sec:has(#h-model), .sec:has(#h-site), [data-view="split"], .pcproj { display: none !important; }
    .col[data-fit] dl.stats > * { display: revert !important; }
    #panelR, #panelR > .colIn { overflow-y: auto !important; }
    .sec.pc-col > :not(h2) { display: none !important; }
    .sec > h2.pc-tog { cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: space-between; }
    .sec > h2.pc-tog::after { content: '–'; font: 600 14px ui-monospace, monospace; color: #8a8f98; }
    .sec.pc-col > h2.pc-tog::after { content: '+'; }`;
  let tries = 0;
  const shell = () => {
    const d = fr.contentDocument; if (!d || !d.getElementById('panelL') || !d.getElementById('chartp')) { if (tries++ < 150) setTimeout(shell, 100); return; }
    if (!d.getElementById('pc-shell')) { const st = d.createElement('style'); st.id = 'pc-shell'; st.textContent = CSS; d.head.appendChild(st); }
    if (d.getElementById('stage')?.classList.contains('split')) d.querySelector('[data-view="plan"]')?.click();
    // the left column stays open in every view (the engine's own shell folds it into numbered buttons outside Plan + chart)
    const appEl = d.querySelector('.app'); if (appEl && !appEl.dataset.pcOpen) { appEl.dataset.pcOpen = '1';
      const unrail = () => { if (appEl.classList.contains('railL') || appEl.classList.contains('peek')) { appEl.classList.remove('railL', 'peek'); d.defaultView.dispatchEvent(new Event('resize')); } };
      new MutationObserver(unrail).observe(appEl, { attributes: true, attributeFilter: ['class'] }); unrail(); }
    for (const sec of d.querySelectorAll('#panelL .sec')) { const h = sec.querySelector(':scope > h2'); if (!h || h.classList.contains('pc-tog')) continue; const k = 'pc-sun-col:' + h.textContent.trim();
      h.classList.add('pc-tog'); h.tabIndex = 0; h.setAttribute('role', 'button'); try { if (localStorage.getItem(k) === '1') sec.classList.add('pc-col'); } catch (e) { }
      const tog = () => { sec.classList.toggle('pc-col'); h.setAttribute('aria-expanded', String(!sec.classList.contains('pc-col'))); try { localStorage.setItem(k, sec.classList.contains('pc-col') ? '1' : '0'); } catch (e) { } };
      h.addEventListener('click', tog); h.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } }); }
    // Save is ready once the engine shows results
    const res = d.getElementById('resSec'), sync = () => { $('#save', app).disabled = !res || res.hidden; }; sync(); if (res) new MutationObserver(sync).observe(res, { attributes: true, attributeFilter: ['hidden'] });
    d.defaultView.dispatchEvent(new Event('resize'));
  };
  fr.addEventListener('load', () => { tries = 0; shell(); }); shell();
  return () => { removeEventListener('message', onMsg); delete window.__pcHO; };
}
