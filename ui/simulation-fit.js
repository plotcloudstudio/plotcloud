// Presentation only. Keep the actual controls, listeners, canvases and model coordinates.
import {prepareSolarPilotLayout,fitSolarCharts} from './solar-pilot-layout.js?v=unified-20261025-1';
import {prepareUnifiedSimulation} from './unified-simulation-layout.js?v=1';
const installed = new WeakSet();
const titleOf = el => (el.id==='chartp'?'Charts':el.querySelector('h2,h3,.cph b')?.textContent || el.getAttribute('aria-label') || (el.querySelector('.legend,.ramp') ? 'Legend' : 'Notes')).replace(/^\s*\d+\s*/, '').trim();
function prepareExteriorLayout(doc){
  if(!/Wind Flow|Stormwater/i.test(doc.title))return true;
  const app=doc.querySelector('.app');if(app?.dataset.pcExteriorLayout)return true;
  const left=doc.querySelector('#panelL > .colIn'),right=doc.querySelector('#panelR > .colIn');
  if(!left||!right||!doc.defaultView.__pcShell)return false;
  app.dataset.pcExteriorLayout='1';
  const heading=(el,text)=>{if(!el)return;const target=el.querySelector('.acch')||el;target.textContent=text;};
  for(const i of doc.querySelectorAll('.sec h2 i'))i.remove();
  const resultHeading=doc.getElementById('h-res'),result=resultHeading?.closest('.sec');
  heading(resultHeading,'Results');if(result)right.prepend(result);
  const exportHeading=doc.getElementById('h-set')||doc.getElementById('h-lay');
  let exports=exportHeading?.closest('.sec');
  if(!exports){exports=doc.createElement('section');exports.className='sec';const h=doc.createElement('h2');h.textContent='Export';exports.append(h);}
  else heading(exportHeading,'Export');
  left.append(exports);
  for(const id of ['export','exportPng','exportJson']){
    const button=doc.getElementById(id);if(!button||exports.contains(button))continue;
    const row=button.closest('.two,.row');
    if(row&&row!==result&&row.querySelectorAll('button').length<=2)exports.append(row);else exports.append(button);
  }
  for(const id of ['expmsg','saveMsg']){const message=doc.getElementById(id);if(message&&!exports.contains(message))exports.append(message);}
  const legend=doc.getElementById('legend'),charts=doc.getElementById('chartp');
  let group=legend?.closest('.lgdsec');
  if(!group){group=doc.createElement('section');group.className='sec lgdsec';if(legend)group.append(legend);right.append(group);}
  group.setAttribute('aria-label','Charts');
  const h=doc.createElement('h2');h.textContent='Charts';group.prepend(h);
  if(charts){charts.hidden=false;group.append(charts);}
  if(result&&/Stormwater/i.test(doc.title)){const metrics=charts?.querySelector('.kp4');const block=metrics?.closest('.cpg');if(block)resultHeading.after(block);else if(metrics)resultHeading.after(metrics);}
  if(result)for(const section of [...right.children])if(section!==result&&section!==group&&section.matches('.sec')&&!section.querySelector('h2')){while(section.firstChild)result.append(section.firstChild);section.remove();}
  const plan=doc.querySelector('[data-view="plan"]');if(plan)plan.click();
  for(const split of doc.querySelectorAll('[data-view="split"]'))split.remove();
  doc.querySelector('#stage')?.classList.remove('split');
  doc.querySelector('#panelR')?.setAttribute('aria-label','Results and Charts');
  const analysis=doc.getElementById('h-sim')||doc.getElementById('h-storm')||doc.getElementById('h-rain');
  if(analysis){if(analysis.id==='h-sim')heading(analysis,'Analysis');const note=doc.createElement('p');note.className='note';note.dataset.pcWorkflowHint='';note.textContent=analysis.id==='h-sim'?'Set wind direction and reference speed, choose the analysis detail, then run. Inspect Results and Charts on the right; save images from Export. This is an early-design study, not a wind-comfort certification.':'Set rainfall intensity, storm duration and surface or detention parameters, then run. Inspect Results and Charts on the right; save images and analysis data from Export. This is an early-design screening, not a drainage compliance assessment.';analysis.after(note);}
  const settings=doc.createElement('section');settings.className='sec';settings.id='exteriorSettings';
  const settingsTitle=doc.createElement('h2');settingsTitle.textContent='Settings';settings.append(settingsTitle);
  for(const section of [...left.children])if(section!==exports&&!section.querySelector('#h-model,#h-scene')){section.classList.remove('shut');settings.append(section);}
  left.prepend(settings);
  const facade=doc.getElementById('facBox');if(facade&&result)result.append(facade);
  const roseNote=doc.getElementById('roseNote');if(roseNote){doc.getElementById('rose').title=roseNote.textContent;roseNote.hidden=true;}
  const chartSpacing=doc.createElement('style');chartSpacing.textContent='[data-pc-exterior-layout] #panelR .lgdsec{padding:8px!important;gap:4px!important}[data-pc-exterior-layout] #chartp{padding:0!important;gap:3px!important}[data-pc-exterior-layout] #chartp>.cpg{gap:3px!important}[data-pc-exterior-layout] #chartp .cph{margin:0!important}[data-pc-exterior-layout] #chartp .kp4{margin:0!important}';doc.head.append(chartSpacing);
  const compactCharts=doc.createElement('style');compactCharts.textContent='[data-pc-exterior-layout] #chartp .kp4{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:4px!important}[data-pc-exterior-layout] #chartp .kp4>div{padding:4px!important}[data-pc-exterior-layout] #chartp .kp4 b{font-size:15px!important}[data-pc-exterior-layout] #chartp .kp4 small{font-size:8px!important}';doc.head.append(compactCharts);
  const listStyle=doc.createElement('style');listStyle.textContent='#exteriorSettings>.sec{border:0;padding:8px 0}#exteriorSettings .sec>h2{pointer-events:none}#panelR .lgdsec #chartp{display:block!important;position:static!important;width:auto!important;height:auto!important}#panelR .lgdsec #chartp>.cpg{display:grid!important;min-width:0!important;padding:6px 0!important;margin:0!important}';doc.head.append(listStyle);
  return true;
}
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
      .pc-simulation-fit .pc-fit-content .chartp canvas{display:block!important;position:static!important;inset:auto!important;width:100%!important}
      .pc-simulation-fit .pc-fit-content .chartp :is(#runoffChart,#pondChart){height:150px!important}
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
    if(panel.closest('[data-pc-unified]')&&state.active.id!=='unifiedResults'){
      if(state.active.id==='unifiedCharts'){fitSolarCharts(doc,viewport);const key=viewport.clientWidth+':'+viewport.clientHeight;if(state.unifiedChartSize!==key){state.unifiedChartSize=key;win.__pcUnifiedCharts?.();win.__pcWindCharts?.();}}
      if(content.scrollHeight>viewport.clientHeight+2){
        const app=panel.closest('[data-pc-unified]');app.pcRollbackUnified?.([{group:titleOf(state.active),required:content.scrollHeight,available:viewport.clientHeight,plots:[...state.active.querySelectorAll('canvas')].map(c=>({id:c.id,height:c.clientHeight}))}]);
        for(const [oldPanel,old]of panels){old.tabs.remove();old.pages.remove();old.viewport.remove();oldPanel.classList.remove('pc-fit-panel');}
        panels.clear();schedule();return;
      }
      state.page=0;state.scale=1;content.style.transform='none';return;
    }
    fitSolarCharts(doc,viewport);
    if(state.active.contains(doc.getElementById('rose'))){const key=viewport.clientWidth+':'+win.innerHeight;if(state.windChartSize!==key){state.windChartSize=key;win.__pcWindCharts?.();}}
    const natural = Math.max(1, content.scrollHeight), have = viewport.clientHeight;
    let scale = panel.closest('[data-pc-unified]')?1:Math.min(1, Math.max(.85, have / natural));
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
    if(doc.readyState!=='complete')return;
    if(!prepareExteriorLayout(doc))return;
    if(!prepareSolarPilotLayout(doc))return;
    let unifiedRequested=new URLSearchParams(win.location.search).get('layout')==='unified',owner=win.frameElement?.id==='eng'?win.frameElement:null;
    try{unifiedRequested ||= new URLSearchParams(win.parent.location.search).get('layout')==='unified';if(!owner&&win.parent.frameElement?.id==='eng')owner=win.parent.frameElement;}catch{}
    if(unifiedRequested&&owner&&owner.dataset.pcSettingsReady!=='true')return;
    if(doc.body.dataset.pcSharedWeatherLoading)return;
    doc.documentElement.classList.add('pc-simulation-fit');
    prepareUnifiedSimulation(doc);
    for(const label of doc.querySelectorAll('#unifiedCharts .cph .note,#unifiedCharts small')){const text=label.textContent.trim();if(label.title!==text)label.title=text;}
    for (const panel of app.querySelectorAll(':scope > aside.panel,:scope > .col')) enhance(panel);
    for(const strip of app.querySelectorAll('.stage > .chartp')){
      if(!strip.getBoundingClientRect().height)continue;
      const groups=[...strip.querySelectorAll(':scope > .cpg')];if(!groups.length)continue;
      let select=strip.querySelector(':scope > .pc-chart-select');
      if(!select){select=doc.createElement('select');select.className='pc-chart-select';select.setAttribute('aria-label','Result chart');groups.forEach((g,i)=>{const o=doc.createElement('option');o.value=i;o.textContent=titleOf(g);select.append(o);});select.onchange=schedule;strip.prepend(select);}
      groups.forEach((chart,i)=>{chart.dataset.pcChartSelected=String(i===+select.value);if(i===+select.value)enhance(chart);});
    }
    for (const [panel, state] of panels) {
      const inner = state.content.firstElementChild;
      for (const el of [...inner.children]) {
        if (!el.matches('.sec,.card,.chartp,.cpg') || state.buttons.has(el)) continue;
        const b = doc.createElement('button'); b.type = 'button'; b.textContent = titleOf(el); b.setAttribute('role','tab');
        b.onclick = () => { state.active = el; state.page = 0; schedule();if(el.querySelector('#chartp')&&typeof win.drawCharts==='function')win.requestAnimationFrame(()=>win.drawCharts()); };
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
  doc.fonts?.ready.then(()=>{for(const state of panels.values())state.unifiedChartSize=null;schedule();});
  win.addEventListener('load',schedule,{once:true});
  doc.addEventListener('click',schedule);
  for (const frame of doc.querySelectorAll('iframe')) {
    const child = () => { try { if (frame.contentDocument?.body) installSimulationFit(frame.contentDocument); } catch {} };
    frame.addEventListener('load', child); child();
  }
  win.PlotCloudSimulationFit = { refresh: schedule, panels };
}
