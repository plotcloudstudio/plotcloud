// Opt-in pilot only: move existing controls/canvases, never clone input IDs or replace engine listeners.
export function prepareSolarPilotLayout(doc){
 if(new URLSearchParams(doc.defaultView.location.search).get('pilot')!=='shared')return true;
 const app=doc.querySelector('.app');if(app?.dataset.pcSolarPilot){const empty=doc.getElementById('pilotResultEmpty'),ready=/Daylight/.test(doc.title)?doc.defaultView.__pcAnalysisState?.().ready:!!doc.defaultView.__sun?.S.lastR;if(empty&&empty.hidden!==!!ready)empty.hidden=!!ready;return true;}
 const left=doc.querySelector('#panelL>.colIn'),right=doc.querySelector('#panelR>.colIn');
 if(doc.readyState!=='complete'||!left||!right)return false;
 app.dataset.pcSolarPilot='1';const day=/Daylight/.test(doc.title);
 const group=(name,id)=>{const el=doc.createElement('section');el.className='sec';el.id=id;const h=doc.createElement('h2');h.textContent=name;el.append(h);return el;};
 const settings=group('Settings','pilotSettings'),exports=group('Export','pilotExport'),results=group('Results','pilotResults'),charts=group('Charts','pilotCharts');charts.classList.add('lgdsec');
 const summary=doc.createElement('div');summary.id='pilotSharedSummary';summary.className='note';settings.append(summary);
 const advanced=doc.createElement('details');advanced.id='pilotAdvanced';advanced.innerHTML='<summary>Advanced · '+(day?'weather, materials & view tools':'calculation & view tools')+'</summary>';
 const overrides=doc.createElement('details');overrides.id='pilotOverrides';overrides.innerHTML='<summary>Override shared conditions for this study</summary><label class="note"><input type="checkbox" id="pilotOverrideEnabled"> Use study-only overrides</label><p class="note">Does not change this project or Account. Reset restores project values.</p><fieldset id="pilotSharedFields" disabled></fieldset><button type="button" class="btn" id="pilotResetShared">Reset to project values</button>';
 const fields=overrides.querySelector('fieldset'),site=doc.getElementById(day?'h-set':'h-site')?.closest('.sec');
 if(site){if(day){const city=doc.getElementById('city');if(city)fields.append(city.closest('.two'));const loc=doc.getElementById('customLoc');if(loc)fields.append(loc);
   for(const id of ['wp','occ0','occ1']){const control=doc.getElementById(id);if(control)fields.append(control.closest('.ctl'));}
   advanced.append(site);
  }else fields.append(site);}
 const park=doc.createElement('div');park.hidden=true;park.id='pilotParked';
 const run=doc.getElementById(day?'h-run':'h-an')?.closest('.sec');if(run){settings.append(run);run.querySelector('h2').textContent=day?'Calculation quality':'Study period';}
 if(!day&&run){for(const node of [run.querySelector('#lvlSeg')?.closest('.row'),run.querySelector('#customRow'),run.querySelector('#ground')?.closest('.two')])if(node)advanced.append(node);}
 const oldExport=doc.getElementById(day?'h-lay':'h-set')?.closest('.sec');if(oldExport)exports.append(oldExport);
 const report=doc.getElementById('h-res')?.closest('.sec');if(report)results.append(report);
 const empty=doc.createElement('p');empty.id='pilotResultEmpty';empty.className='note';empty.textContent='Run this study on the selected Workspace version to inspect its results.';results.prepend(empty);
 const legend=doc.getElementById('legend'),plot=doc.getElementById('chartp');if(legend)charts.append(legend);if(plot){plot.hidden=false;charts.append(plot);}
 // Keep useful view controls, hide the independent model editor in the project workflow.
 for(const section of [...left.children]){if(section===settings||section===exports)continue;
  if(section.querySelector('#h-model,#h-scene'))park.append(section);else if(section!==site&&section!==run&&section!==oldExport)advanced.append(section);}
 for(const section of [...right.children])if(section!==results&&section!==charts){if(section.matches('.lgdsec')||section.contains(legend)||!section.textContent.trim())section.remove();else results.append(section);}
 settings.append(advanced,overrides);left.append(settings,exports,park);right.append(results,charts);
 for(const h of doc.querySelectorAll('#pilotSettings .sec>h2,#pilotExport .sec>h2,#pilotResults .sec>h2')){for(const i of h.querySelectorAll('i'))i.remove();h.style.fontSize='12px';h.classList.remove('pc-tog');h.parentElement.classList.remove('shut','pc-col');h.addEventListener('click',e=>e.stopImmediatePropagation(),true);}
 for(const i of doc.querySelectorAll('.sec h2 i'))i.remove();
 const plan=doc.querySelector(day?'[data-cam="plan"]':'[data-view="plan"]');plan?.click();
 for(const b of doc.querySelectorAll('[data-cam="split"],[data-view="split"]'))b.remove();doc.getElementById('stage')?.classList.remove('split');
 // Detailed readouts stay available in Results; every actual chart remains in the list.
 if(day)for(const [id,title]of [['roomBox','Selected room'],['spot','Selected spot']]){const node=doc.getElementById(id);if(node){const detail=doc.createElement('section');const h=doc.createElement('h3');h.textContent=title;detail.append(h,node);results.append(detail);}}
 const style=doc.createElement('style');style.textContent='#pilotCharts:not([data-pc-fit-active=false]){display:block!important}#pilotCharts[data-pc-fit-active=false]{display:none!important}#pilotSharedFields{border:0;padding:0;margin:12px 0}#pilotSharedFields:disabled{opacity:.6}#pilotSharedSummary{padding:10px;border:1px solid var(--line);border-radius:6px;margin-bottom:12px;line-height:1.6}#pilotAdvanced,#pilotOverrides{margin:12px 0}#pilotAdvanced summary,#pilotOverrides summary{cursor:pointer;font-weight:600;margin-bottom:10px}#pilotCharts #chartp{display:block!important}#pilotCharts .lgd,#pilotCharts .legend{position:static!important;width:auto!important}'+
 '@media(min-width:901px){#pilotCharts{padding:8px!important}#pilotCharts>h2{display:none}#pilotCharts #chartp{padding:0!important}#pilotCharts .cpg{padding:5px 0!important;margin:0!important;border:0!important;border-top:1px solid var(--line)!important;gap:3px!important}#pilotCharts .cph{margin:0!important;gap:4px!important;line-height:1.2}#pilotCharts .cph b{font-size:11px}#pilotCharts .cph .note{font-size:9px;line-height:1.2}#pilotCharts .kp4{gap:4px!important;margin:3px 0!important}#pilotCharts .kp4>div{padding:4px 7px!important}#pilotCharts .kp4 b{font-size:17px!important}#pilotCharts .kp4 small{font-size:9px!important}#pilotCharts #legend{margin:0 0 5px!important;padding:0!important;font-size:10px;line-height:1.2}#pilotCharts #legend h2{font-size:10px;letter-spacing:.08em;margin:0 0 4px}}';doc.head.append(style);
 const compact=doc.createElement('style');compact.textContent='@media(min-width:901px) and (max-height:850px){#pilotCharts .kp4{grid-template-columns:repeat(4,minmax(0,1fr))!important}#pilotCharts .kp4>div{padding:4px!important}#pilotCharts .kp4 b{font-size:14px!important}#pilotCharts .kp4 small{font-size:8px!important;letter-spacing:0!important}#pilotCharts #legend .note{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:9px;line-height:12px}#pilotCharts .cph .note{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}#pilotCharts .cph b{flex-shrink:0}}';doc.head.append(compact);
 for(const note of charts.querySelectorAll('.note'))note.title=note.textContent.trim();
 return true;
}

// Allocate real drawing heights instead of CSS-compressing a bitmap and its hit targets.
export function fitSolarCharts(doc,viewport){
 const charts=doc.getElementById('unifiedCharts')||doc.getElementById('pilotCharts');if(!charts||charts.dataset.pcFitActive!=='true')return;
 const flexible=[...charts.querySelectorAll('canvas')].filter(c=>!['cCrit','cRooms'].includes(c.id));
 if(!flexible.length)return;
 const fixed=charts.getBoundingClientRect().height-flexible.reduce((n,c)=>n+c.getBoundingClientRect().height,0);
 const room=Math.max(0,viewport.clientHeight-fixed-4),each=Math.max(58,Math.min(150,Math.floor(room/flexible.length)));
 let changed=false;
 for(const c of flexible)if(c.dataset.chartHeight!==String(each)){c.dataset.chartHeight=each;changed=true;}
 if(changed)doc.defaultView.__pcRedrawCharts?.();
}
