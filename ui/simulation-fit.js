// Presentation only. Keep the actual controls, listeners, canvases and model coordinates.
const installed = new WeakSet();
const titleOf = el => (el.id==='chartp'?'Charts':el.querySelector('h2,h3,.cph b')?.textContent || el.getAttribute('aria-label') || (el.querySelector('.legend,.ramp') ? 'Legend' : 'Notes')).replace(/^\s*\d+\s*/, '').trim();
export function installSimulationFit(doc = document) {
  // Host and iframe runtimes may load this module in different JS realms.
  if (installed.has(doc) || doc.documentElement.hasAttribute('data-pc-fit-installed') || !doc.body) return;
  doc.documentElement.dataset.pcFitInstalled='1';
  installed.add(doc);
  const win = doc.defaultView;
  const css = doc.createElement('style');
  css.textContent = `
    @media(min-width:901px){
      html.pc-simulation-fit,html.pc-simulation-fit body{height:100%;overflow:hidden!important;overscroll-behavior:none}
      .pc-simulation-fit .app{height:100dvh!important;min-height:0!important;overflow:hidden!important}
      .pc-simulation-fit .app.railL{grid-template-columns:clamp(272px,24vw,318px) minmax(0,1fr) clamp(250px,22vw,300px)!important}
      .pc-simulation-fit .rail,.pc-simulation-fit .peekX{display:none!important}
      .pc-simulation-fit .pc-fit-panel{display:flex!important;flex-direction:column!important;min-height:0!important;overflow:hidden!important;padding:8px!important;gap:8px;box-sizing:border-box}
      .pc-simulation-fit .pc-fit-tabs{display:flex;flex-wrap:wrap;gap:4px;flex:none}
      .pc-simulation-fit .pc-fit-tabs button,.pc-simulation-fit .pc-fit-pages button{font:500 12px var(--f-body,system-ui);padding:5px 8px;min-height:28px;border:1px solid var(--line,#ddd);border-radius:5px;background:var(--surface,#fff);color:var(--ink,#222);cursor:pointer}
      .pc-simulation-fit .pc-fit-tabs button[aria-selected=true]{background:var(--accent-soft,#fbe9e5);border-color:var(--accent,#d8402a);color:var(--accent,#d8402a)}
      .pc-simulation-fit .pc-fit-window{flex:1;min-height:0;overflow:hidden;position:relative}
      .pc-simulation-fit .pc-fit-content{transform-origin:top left;position:absolute;top:0;left:0;width:100%}
      .pc-simulation-fit .pc-fit-content>.colIn{transform:none!important;width:auto!important;min-height:0!important;padding:0!important;overflow:visible!important;display:block!important}
      .pc-simulation-fit .pc-fit-item{flex:none!important;min-height:0!important;margin:0!important;overflow:visible!important}
      .pc-simulation-fit .pc-fit-item[data-pc-fit-active=false]{display:none!important}
      .pc-simulation-fit .pc-fit-item.shut>:not(h2):not([hidden]),.pc-simulation-fit .pc-fit-item.pc-col>:not(h2):not([hidden]){display:revert!important}
      .pc-simulation-fit .pc-fit-pages{display:flex;align-items:center;justify-content:space-between;gap:6px;flex:none;font-size:11px}
      .pc-simulation-fit .pc-fit-pages[hidden]{display:none!important}
      .pc-simulation-fit .pc-fit-content .chartp{position:static!important;display:grid!important;width:auto!important;height:auto!important;padding:8px!important;overflow:visible!important;border:0!important}
      .pc-simulation-fit .pc-fit-content .cpg{min-width:0!important;max-width:none!important;overflow:visible!important;flex:none!important}
      .pc-simulation-fit .pc-fit-content .cpg .note{white-space:normal!important}
      .pc-simulation-fit .pc-fit-content #expmsg img{display:block;max-height:140px;object-fit:contain}
      .pc-simulation-fit .pc-fit-content :is(.chart-wrap,.rlist,.layers){overflow:visible!important;max-height:none!important}
      .pc-simulation-fit .stage>.chartp{overflow:hidden!important}
      .pc-simulation-fit .stage.split>.chartp{display:flex!important;flex-direction:column!important;gap:4px!important;padding:4px!important}
      .pc-simulation-fit .stage>.chartp>.cpg.pc-fit-panel{display:flex!important;flex-direction:column!important;flex:1 1 0!important;min-width:0!important;gap:4px!important;padding:4px!important}
      .pc-simulation-fit .stage>.chartp>.cpg[data-pc-chart-selected=false]{display:none!important}
      .pc-simulation-fit .pc-chart-select{flex:none;font:12px var(--f-body,system-ui);height:28px;padding:2px 6px;max-width:100%}
      .pc-simulation-fit .pc-fit-tabs[hidden]{display:none!important}
    }`;
  doc.head.append(css);
  let pending = false;
  const panels = new Map();
  function fitPanel(panel, state) {
    if (win.innerWidth <= 900 || !panel.getBoundingClientRect().height) return;
    const { content, viewport, pages, label, prev, next } = state;
    // Engine-hidden Results must not be forced into view before a run.
    state.items.forEach(el=>el.removeAttribute('data-pc-fit-active'));
    const available = state.items.filter(el => !el.hidden && win.getComputedStyle(el).display !== 'none');
    if (!available.includes(state.active)) state.active = available[0];
    state.items.forEach(el => { const active = el === state.active; el.dataset.pcFitActive = String(active); const b = state.buttons.get(el); if (b) { b.hidden = !available.includes(el); b.setAttribute('aria-selected', String(active)); } });
    if (!state.active) return;
    content.style.transform = ''; content.style.width = '100%';
    pages.hidden = true;
    const natural = Math.max(1, content.scrollHeight), have = viewport.clientHeight;
    let scale = Math.min(1, Math.max(.85, have / natural));
    content.style.width = `${100 / scale}%`;
    const height = content.scrollHeight * scale;
    // Long groups have explicit Previous/Next pages instead of wheel scrolling or tiny text.
    const paging = height > have + 2;
    pages.hidden = !paging;
    const pageHeight = Math.max(1, viewport.clientHeight - 12);
    // Leave a small overlap so a row spanning a page boundary is still reachable in full.
    state.step = Math.max(1, pageHeight - Math.min(56,pageHeight*.25)); state.scale = scale;
    const last = Math.max(0, Math.ceil((height - viewport.clientHeight) / state.step));
    state.page = Math.max(0,Math.min(state.page, last));
    content.style.transform = `translateY(${-state.page * state.step}px) scale(${scale})`;
    viewport.scrollTop=0;panel.scrollTop=0;
    label.textContent = `${titleOf(state.active)} · ${state.page + 1} / ${last + 1}`;
    prev.disabled = state.page === 0; next.disabled = state.page >= last;
  }
  function enhance(panel) {
    if (panels.has(panel)) return;
    let inner = panel.querySelector(':scope > .colIn');
    if (!inner) { inner = doc.createElement('div'); inner.className = 'colIn'; while (panel.firstChild) inner.append(panel.firstChild);if(panel.classList.contains('cpg')){const section=doc.createElement('section');section.className='sec';while(inner.firstChild)section.append(inner.firstChild);inner.append(section);}panel.append(inner); }
    const tabs = doc.createElement('div'); tabs.className = 'pc-fit-tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', panel.id === 'panelR' ? 'Results sections' : 'Parameter sections');
    const viewport = doc.createElement('div'); viewport.className = 'pc-fit-window';
    const content = doc.createElement('div'); content.className = 'pc-fit-content'; content.append(inner); viewport.append(content);
    const pages = doc.createElement('div'); pages.className = 'pc-fit-pages'; pages.hidden = true;
    const prev = doc.createElement('button'), next = doc.createElement('button'), label = doc.createElement('span');
    prev.type = next.type = 'button'; prev.textContent = '← Previous'; next.textContent = 'Next →'; pages.append(prev, label, next);
    panel.classList.add('pc-fit-panel'); panel.append(tabs, viewport, pages);
    const state = { content, viewport, tabs, pages, prev, next, label, items: [], buttons: new Map(), active: null, page: 0 };
    panels.set(panel, state);
    prev.onclick = () => { state.page--; schedule(); }; next.onclick = () => { state.page++; schedule(); };
    panel.addEventListener('focusin', e => { if (!content.contains(e.target)) return; const item = state.items.find(el => el.contains(e.target)); if (!item) return; state.active = item; const targetY = (e.target.getBoundingClientRect().top - content.getBoundingClientRect().top); state.page = Math.floor(targetY / Math.max(1,state.step)); schedule(); });
    // Native scrolling is unnecessary here; model wheel events remain the engine's zoom.
    panel.addEventListener('wheel', e => e.preventDefault(), { passive: false });
    new win.ResizeObserver(schedule).observe(panel);
  }
  function refresh() {
    pending = false;
    const app = doc.querySelector('.app'); if (!app) return;
    doc.documentElement.classList.add('pc-simulation-fit');
    for (const panel of app.querySelectorAll(':scope > aside.panel,:scope > .col')) enhance(panel);
    for(const strip of app.querySelectorAll('.stage > .chartp')){
      if(!strip.getBoundingClientRect().height)continue;
      const groups=[...strip.querySelectorAll(':scope > .cpg')];if(!groups.length)continue;
      let select=strip.querySelector(':scope > .pc-chart-select');
      if(!select){select=doc.createElement('select');select.className='pc-chart-select';select.setAttribute('aria-label','Result chart');groups.forEach((g,i)=>{const o=doc.createElement('option');o.value=i;o.textContent=titleOf(g);select.append(o);});select.onchange=schedule;strip.prepend(select);}
      groups.forEach((chart,i)=>{chart.dataset.pcChartSelected=String(i===+select.value);if(i===+select.value)enhance(chart);});
    }
    // Structure sizer has charts in a separate drawing column, not #panelR.
    if (doc.title.includes('Structure Sizer')) for (const panel of app.querySelectorAll(':scope > .draw')) enhance(panel);
    for (const [panel, state] of panels) {
      const inner = state.content.firstElementChild;
      for (const el of [...inner.children]) {
        if (!el.matches('.sec,.card,.chartp,.cpg') || state.buttons.has(el)) continue;
        const b = doc.createElement('button'); b.type = 'button'; b.textContent = titleOf(el); b.setAttribute('role','tab');
        b.onclick = () => { state.active = el; state.page = 0; schedule(); };
        el.classList.add('pc-fit-item'); state.tabs.append(b); state.items.push(el); state.buttons.set(el, b);
        const h=el.querySelector(':scope > h2.pc-tog');if(h){h.classList.remove('pc-tog');h.removeAttribute('role');h.removeAttribute('aria-expanded');h.tabIndex=-1;h.addEventListener('click',e=>e.stopImmediatePropagation(),true);}
      }
      // Prefer Analysis on the left, Results on the right; retain an explicit user's tab thereafter.
      if (!state.active) state.active = state.items.find(el => /^(Analysis|Results|Simulation)$/i.test(titleOf(el)) && !el.hidden) || state.items.find(el => !el.hidden);
      state.tabs.hidden=state.items.length===1;
      fitPanel(panel, state);
    }
  }
  function schedule() { if (!pending) { pending = true; win.requestAnimationFrame(refresh); } }
  new win.MutationObserver(schedule).observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'open'] });
  win.addEventListener('resize', schedule); schedule();
  doc.addEventListener('click',schedule);
  for (const frame of doc.querySelectorAll('iframe')) {
    const child = () => { try { if (frame.contentDocument?.body) installSimulationFit(frame.contentDocument); } catch {} };
    frame.addEventListener('load', child); child();
  }
  win.PlotCloudSimulationFit = { refresh: schedule, panels };
}
