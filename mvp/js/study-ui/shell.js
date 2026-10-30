import * as S from '../store.js';
import {LIVE} from '../app.js';
// The same study layout as Sun Hours and the other engine studies (sim-engine.js): a two-row .shbar header with project,
// version, site chip, input review and the Run study / auto-save / Save result workflow; Settings | Export tabs at the top
// of the left panel; Results | Charts tabs on the right. Element IDs used by the study code and tests are kept.
function unify(root,kind,{settings,results,nav,heading,chartStage}){
 const pre=kind==='environment'?'env':'ss',head=root.querySelector(kind==='environment'?'.env-head':'.ss-head'),q=s=>root.querySelector(s);
 // ---- header
 const back=head.querySelector('a[href="#/simulations"]'),title=head.querySelector('strong'),proj=q('#'+pre+'-project'),ver=q('#'+pre+'-version');
 back.className='btn sm ghost';back.textContent='← Back';title.className='shname';title.textContent=title.textContent.trim();
 const badge=document.createElement('span');badge.innerHTML=LIVE;
 const label=(text,el)=>{const l=document.createElement('label');l.className='shsel';l.append(text,el);return l;};
 const p=S.project(proj.value),c=p&&S.conditionsOf(p),chip=document.createElement('a');chip.className='shsite';
 if(p){chip.href='#/project-settings/'+p.id;chip.textContent=`${(c.site.label||'Site').split(',')[0]} · Shared r${c.revision} ↗`;}
 const review=document.createElement('button');review.type='button';review.className='btn sm';review.id='studyReviewInputs';review.textContent='Review inputs';
 review.onclick=()=>{show('settings');const d=[...settings.querySelectorAll('details')].find(x=>/Workbench inputs/.test(x.querySelector('summary')?.textContent||''));if(d){d.open=true;d.scrollIntoView({block:'nearest'});d.querySelector('summary')?.focus();}};
 const flow=document.createElement('div');flow.className='study-workflow';flow.setAttribute('role','group');flow.setAttribute('aria-label','Calculate and save');
 const status=q('#'+pre+'-status'),run=q('#'+pre+'-run'),stop=q('#'+pre+'-stop'),save=q('#'+pre+'-save'),progress=q('#'+pre+'-progress'),auto=q('#env-autosave')?.closest('label');
 status.classList.add('study-state');run.className='btn sm accent';run.textContent='Run study';stop.className='btn sm';stop.textContent='Stop calculation';save.className='btn sm primary';
 if(auto){auto.className='note';auto.lastChild.textContent=' Auto-save completed result';}
 flow.append(status,run,stop,...(auto?[auto]:[]),save,progress);
 const exportButtons=[q('#'+pre+'-report'),q('#ss-json')].filter(Boolean);
 head.classList.add('shbar');head.replaceChildren(back,title,badge.firstChild,label('Project',proj),label('Version',ver),chip,review,flow);
 // ---- left: Settings | Export tabs
 const exportPanel=document.createElement('div');exportPanel.dataset.studyPanel='export';exportPanel.className='study-tab-panel';
 const settingsPanel=document.createElement('div');settingsPanel.dataset.studyPanel='settings';settingsPanel.className='study-tab-panel';
 let exportSection=kind==='environment'?q('#env-csv')?.closest('details'):null;if(kind==='structure')q('.study-export')?.remove();
 if(exportSection&&exportSection.tagName==='DETAILS')exportSection.open=true;
 const reportBox=document.createElement('section');reportBox.className='study-export-actions';reportBox.innerHTML='<h3>Report and inputs</h3><p class="note">Exports use the saved result and the reviewed inputs of this version.</p>';reportBox.append(...exportButtons);for(const b of exportButtons)b.className='btn sm';
 for(const el of [...settings.children])if(el!==nav&&el!==exportSection)settingsPanel.append(el);
 if(exportSection)exportPanel.append(exportSection);exportPanel.prepend(reportBox);
 nav.className='study-panel-nav pc-fit-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Settings and Export');
 settings.append(settingsPanel,exportPanel);
 // anything the study code adds later (input contract, notices) belongs to Settings
 new MutationObserver(list=>{for(const m of list)for(const n of m.addedNodes)if(n.nodeType===1&&n.parentElement===settings&&n!==nav&&n!==settingsPanel&&n!==exportPanel)settingsPanel.prepend(n);}).observe(settings,{childList:true});
 const tabs={settings:nav.querySelector('[data-study-jump=settings]'),export:nav.querySelector('[data-study-jump=export]')};
 function show(which){for(const [k,b] of Object.entries(tabs)){b.setAttribute('role','tab');b.setAttribute('aria-selected',String(k===which));}settingsPanel.hidden=which!=='settings';exportPanel.hidden=which!=='export';settings.scrollTop=0;}
 tabs.settings.onclick=()=>show('settings');tabs.export.onclick=()=>show('export');show('settings');
 // ---- right: Results | Charts tabs
 const rnav=document.createElement('nav');rnav.className='study-panel-nav pc-fit-tabs';rnav.setAttribute('role','tablist');rnav.setAttribute('aria-label','Results and Charts');
 rnav.innerHTML='<button type="button" role="tab" data-study-result-tab="results">Results</button><button type="button" role="tab" data-study-result-tab="charts">Charts</button>';
 const gallery=document.createElement('div');gallery.className='study-chart-gallery';gallery.hidden=true;
 heading.replaceWith(rnav);results.append(gallery);
 function charts(){gallery.replaceChildren();const visuals=[...results.querySelectorAll('canvas,.env-wind-rose'),...(chartStage?[...chartStage.querySelectorAll('canvas,.env-wind-rose')]:[])].filter(v=>!gallery.contains(v));
  for(const v of visuals){const fig=document.createElement('figure');let h=v.previousElementSibling;while(h&&!h.matches('h2,h3'))h=h.previousElementSibling;const cap=document.createElement('figcaption');cap.textContent=h?.textContent||'';
   if(v.tagName==='CANVAS'){const img=document.createElement('img');try{img.src=v.toDataURL('image/png');}catch{continue;}img.alt=cap.textContent||'Chart';img.style.maxWidth='100%';fig.append(cap,img);}else fig.append(cap,v.cloneNode(true));gallery.append(fig);}
  if(!gallery.children.length)gallery.innerHTML='<p class="note">No charts for this result yet. Run the study; numeric results are under Results.</p>';else if(chartStage)gallery.insertAdjacentHTML('afterbegin','<p class="note">The same charts are also shown in the main view.</p>');}
 function showResult(which){for(const b of rnav.querySelectorAll('button'))b.setAttribute('aria-selected',String(b.dataset.studyResultTab===which));results.dataset.studyTab=which;gallery.hidden=which!=='charts';if(which==='charts')charts();}
 for(const b of rnav.querySelectorAll('button'))b.onclick=()=>showResult(b.dataset.studyResultTab);showResult('results');
}
export function mountStudyShell(root,{kind='environment',spatial=true}={}){
 root.classList.add('study-shell');const $=s=>root.querySelector(s);let body,settings,main,results,chartStage=null;
 if(kind==='environment'){
  body=$('.env-body');settings=$('.env-setup');main=$('.env-main');results=$('.env-results');body.append(results);$('.env-view-tools')?.querySelector('span')?.remove();$('.env-view-tools')?.classList.add('study-old-tools');
  if(!spatial){chartStage=document.createElement('section');chartStage.className='study-chart-stage';chartStage.setAttribute('aria-label','Climate charts');chartStage.innerHTML='<h2>Charts</h2><p>Run the study to view its weather charts. Settings and numeric results stay available on either side.</p>';main.prepend(chartStage);}
 }else if(kind==='structure'){
  body=$('.ss-body');settings=$('.ss-setup');main=$('.ss-main');results=$('.ss-results');body.append(results);const exports=document.createElement('section');exports.className='study-export';exports.innerHTML='<h3>Export</h3><p class="note">Export the reviewed inputs or a completed report.</p>';exports.append($('#ss-report'),$('#ss-json'));settings.append(exports);$('.ss-view-tools')?.classList.add('study-struct-tools');
 }else{
  root.classList.remove('wrap');root.classList.add('local-study');const title=$('h1'),intro=title.nextElementSibling,choices=$('.acts'),back=$('a[href="#/simulations"]'),groups=[...root.children].filter(e=>e.matches('section.card')),top=$('.grid.g2'),setup=top.children[0],recipe=top.children[1],review=groups[0],exchange=groups[1];
  const head=document.createElement('header');head.className='study-local-head';head.append(back,title,choices);intro.className='study-local-intro';head.append(intro);body=document.createElement('div');body.className='study-local-body';settings=document.createElement('aside');settings.className='study-local-settings';main=document.createElement('section');main.className='study-local-main';results=document.createElement('section');results.className='study-local-results';
  const source=$('#lc-canvas').parentElement;main.append(source);source.className='study-local-stage';const oldHint=source.querySelector('.note');if(oldHint)oldHint.remove();settings.append(recipe);const guide=document.createElement('details');guide.className='study-local-guide';guide.innerHTML='<summary>Local runner setup & installation</summary>';guide.append(setup);settings.append(guide,review);
  const output=$('#lc-results'),history=$('#lc-history'),historyTitle=history.previousElementSibling;results.append(output,historyTitle,history);settings.append(exchange);top.remove();root.replaceChildren(head,body);body.append(settings,main,results);for(const h of root.querySelectorAll('section.card h2'))if(/^2\./.test(h.textContent))h.textContent='Analytical inputs';else if(/^3\./.test(h.textContent))h.textContent='Results & export';
  $('#lc-daylight>.grid.g2').style.gridTemplateColumns='minmax(0,1fr)';
 }
 settings.classList.add('study-settings');results.classList.add('study-results');main.classList.add('study-main');settings.setAttribute('aria-label','Settings and Export');results.setAttribute('aria-label','Results and Charts');
 const nav=document.createElement('nav');nav.className='study-panel-nav';nav.setAttribute('aria-label','Settings and export shortcuts');nav.innerHTML='<button type="button" data-study-jump="settings">Settings</button><button type="button" data-study-jump="export">Export</button>';settings.prepend(nav);
 nav.querySelector('[data-study-jump=settings]').onclick=()=>settings.scrollTo({top:0,behavior:'auto'});nav.querySelector('[data-study-jump=export]').onclick=()=>{const target=kind==='environment'?$('#env-csv').closest('details'):kind==='local'?$('#lc-import').closest('section'):$('.study-export');if(target){if(target.tagName==='DETAILS')target.open=true;settings.scrollTop=Math.max(0,target.getBoundingClientRect().top-settings.getBoundingClientRect().top+settings.scrollTop-40);target.querySelector('button,input')?.focus({preventScroll:true});}};
 const heading=document.createElement('h2');heading.className='study-results-heading';heading.textContent='Results & Charts';results.prepend(heading);
 if(kind==='environment'||kind==='structure')unify(root,kind,{settings,results,nav,heading,chartStage});
 function arrangeCharts(){if(!chartStage)return;chartStage.replaceChildren();for(const visual of [...results.querySelectorAll('canvas,.env-wind-rose')]){const card=document.createElement('section');card.className='study-chart-card';let previous=visual.previousElementSibling;const prefix=[];while(previous&&!previous.matches('table,.env-table,canvas,.env-wind-rose')){prefix.unshift(previous);if(previous.matches('h2,h3'))break;previous=previous.previousElementSibling;}const notes=[];let next=visual.nextElementSibling;while(next?.matches('p,#env-calendar-scale')){notes.push(next);next=next.nextElementSibling;}card.append(...prefix,visual,...notes);chartStage.append(card);}if(!chartStage.children.length)chartStage.innerHTML='<h2>Charts</h2><p>No completed weather result is available.</p>';}
 return{arrangeCharts,chartStage,dispose(){}};
}
