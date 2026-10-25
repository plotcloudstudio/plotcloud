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
 if(plot){const groups=[...plot.querySelectorAll(':scope>.cpg')];if(groups.length>1){const select=doc.createElement('select');select.id='pilotChartSelect';select.setAttribute('aria-label','Chart');groups.forEach((g,i)=>{const o=doc.createElement('option');o.value=i;o.textContent=(g.querySelector('h3,.cph b,b')?.textContent||'Chart '+(i+1)).trim();select.append(o);});plot.prepend(select);
   const choose=()=>{groups.forEach((g,i)=>g.dataset.pilotChartActive=String(i===+select.value));doc.defaultView.dispatchEvent(new Event('resize'));doc.defaultView.PlotCloudSimulationFit?.refresh();};select.onchange=choose;choose();}}
 const style=doc.createElement('style');style.textContent='#pilotCharts:not([data-pc-fit-active=false]){display:block!important}#pilotCharts[data-pc-fit-active=false]{display:none!important}#pilotSharedFields{border:0;padding:0;margin:12px 0}#pilotSharedFields:disabled{opacity:.6}#pilotSharedSummary{padding:10px;border:1px solid var(--line);border-radius:6px;margin-bottom:12px;line-height:1.6}#pilotAdvanced,#pilotOverrides{margin:12px 0}#pilotAdvanced summary,#pilotOverrides summary{cursor:pointer;font-weight:600;margin-bottom:10px}#pilotCharts #chartp{display:block!important}#pilotCharts [data-pilot-chart-active=false]{display:none!important}#pilotCharts #chartp canvas{height:150px!important}#pilotCharts .lgd,#pilotCharts .legend{position:static!important;width:auto!important}';doc.head.append(style);
 return true;
}
