import {settingsAccordion} from './simulation-settings-accordion.js?v=panel-scroll-20261026-1';
// Reparent the engine's real controls: do not clone IDs, listeners, geometry or results.
export function prepareUnifiedSimulation(doc){
 const win=doc.defaultView;
 let opted=new URLSearchParams(win.location.search).get('layout')==='unified';
 try{opted ||= win.parent!==win&&new URLSearchParams(win.parent.location.search).get('layout')==='unified';}catch{}
 if(!opted)return false;
 const app=doc.querySelector('.app'),left=doc.querySelector('#panelL>.colIn'),right=doc.querySelector('#panelR>.colIn');
 if(!app||app.dataset.pcUnified||app.dataset.pcUnifiedBlocked||doc.readyState!=='complete')return false;
 if(!left||!right)return false;
 const original=[...doc.querySelectorAll('*')].map(node=>({node,parent:node.parentNode,next:node.nextSibling,cls:node.getAttribute('class'),open:node.hasAttribute('open'),hidden:node.hidden}));
 app.dataset.pcUnified='true';
 const group=(id,title)=>{const el=doc.createElement('section');el.className='card pc-unified-group';el.id=id;const h=doc.createElement('h2');h.textContent=title;el.append(h);return el;};
 const settings=group('unifiedSettings','Settings'),exports=group('unifiedExport','Export'),results=group('unifiedResults','Results'),charts=group('unifiedCharts','Charts');charts.classList.add('lgdsec');
 const parked=doc.createElement('div');parked.hidden=true;const extraNodes=[];
 const acoustic=/Indoor Acoustics/.test(doc.title),circulation=/Circulation/.test(doc.title),camera=/Camera Coverage/.test(doc.title),isovist=/Isovist/.test(doc.title);
 // Keep every engine ID connected throughout reparenting; engine helpers use getElementById.
 left.append(settings,exports,parked);right.append(results,charts);
 let workspaceImported=false;try{workspaceImported=win.frameElement?.id==='modelWorkspace'&&win.parent.parent.document.getElementById('eng')?.contentWindow===win.parent;}catch{}
 let workspaceInfo=null,detentionControl=null,detentionFields=[];
 const updateDetention=()=>{if(!app.dataset.pcUnified)return;for(const el of detentionFields)el.hidden=!detentionControl.checked;};
 if(workspaceImported){
  for(const id of ['srcSeg','drop','units','example']){const el=doc.getElementById(id);if(el){const container=id==='srcSeg'?el.parentElement:['units','example'].includes(id)?el.closest('.two'):el;if(container)container.hidden=true;}}
  workspaceInfo=doc.createElement('p');workspaceInfo.className='note';workspaceInfo.textContent='Geometry, metres and Y-up are supplied by the selected Workspace version. Edit the model in Workspace.';doc.getElementById('h-site')?.after(workspaceInfo);
  detentionControl=doc.getElementById('detention');if(detentionControl){detentionFields=[doc.getElementById('radius')?.closest('.two'),doc.getElementById('placeStorage')].filter(Boolean);updateDetention();}
 }
 // Project-level conditions have one editor. Keep historical override controls intact for
 // legacy views, but do not present a second set of project inputs in this workspace layout.
 const sharedOverrides=doc.getElementById('pilotOverrides');if(sharedOverrides)parked.append(sharedOverrides);
 const localWeather=doc.getElementById('epwB');if(doc.getElementById('pilotSharedSummary')&&localWeather)localWeather.hidden=true;
 const bar=doc.querySelector('#stage .vbar,#stage>.bar'),viewControls=doc.createElement('div');viewControls.className='pc-unified-view-controls';
 const display=doc.createElement('details');display.className='pc-unified-display';display.innerHTML='<summary>Display layers</summary>';
 if(bar){
  const tools=doc.getElementById('toolBar');if(tools){for(const button of tools.querySelectorAll('button'))if(!button.hidden&&win.getComputedStyle(button).display==='none')button.hidden=true;viewControls.append(tools);}
  const hint=doc.getElementById('toolHint');if(hint)viewControls.append(hint);
  const undo=doc.getElementById('undo');if(undo)viewControls.append(undo.parentElement);
 }
 // Preserve the project model controls outside the Settings ancestor: host hide selectors use :has().
 for(const child of [...left.children]){
  if(child===settings||child===exports||child===parked)continue;
  if(child.hidden||child.querySelector('#h-model,#h-scene')||circulation&&child.querySelector('#h-plan')){parked.append(child);continue;}
  if(child.id==='pilotExport'||child.querySelector('#h-lay,#h-set')&&/export/i.test(child.querySelector('h2')?.textContent||''))exports.append(child);
  else settings.append(child);
 }
 for(const child of [...right.children]){
  if(child===results||child===charts)continue;
  if(child.querySelector('#h-ex'))exports.append(child);
  else if(child.querySelector('#h-lay')){
   const exportButtons=[...child.querySelectorAll('[data-ex],#exPng,#exCsv,#exportPng,#exportJson')];
   for(const button of exportButtons)exports.append(button);
   const message=child.querySelector('#exMsg');if(message)exports.append(message);
   for(const input of child.querySelectorAll('[data-layer]')){const label=input.closest('label');if(label)display.append(label);}
   child.querySelector('h2')?.remove();settings.append(child);
  }else if(child.id==='pilotCharts'||child.classList.contains('lgdsec'))charts.append(child);
  else results.append(child);
 }
 for(const node of doc.querySelectorAll('#legend,#chartp'))if(!charts.contains(node))charts.append(node);
 for(const input of exports.querySelectorAll('[data-layer]')){const label=input.closest('label');if(label)display.append(label);}
 const plot=doc.getElementById('chartp');if(plot){plot.hidden=false;plot.removeAttribute('data-pc-fit-active');}
 if(!display.querySelector('input'))display.hidden=true;
 const agents=doc.getElementById('agMsg');if(agents)results.append(agents);
 const spot=plot?.querySelector('#spot'),spotGroup=spot?.closest('.cpg');
 if(spotGroup&&!spotGroup.querySelector('canvas'))results.append(spotGroup);
 else if(spot){const detail=doc.createElement('section'),h=doc.createElement('h3');h.textContent='Selected spot';detail.append(h,spot);results.append(detail);}
 const roomDetail=plot?.querySelector('#roomBox');if(roomDetail)results.append(roomDetail);
 // Geometry belongs to the Workspace; playback controls belong to the viewport.
 // Keep editable calculation and trip inputs together in Settings.
 if(acoustic){
  const preset=doc.getElementById('preset');if(preset?.value==='project')parked.append(preset.parentElement);
  const project=doc.getElementById('projectline');if(project)results.prepend(project);
  const materialNote=doc.getElementById('materialNote');if(materialNote)results.append(materialNote);
  const band=doc.getElementById('band')?.parentElement,quality=doc.getElementById('quality')?.parentElement;
  if(band&&quality){const row=doc.createElement('div');row.className='two';quality.before(row);row.append(band,quality);extraNodes.push(row);}
  for(const id of ['motion','pulse']){const input=doc.getElementById(id);if(input&&bar)viewControls.append(id==='motion'?input.closest('label'):input.parentElement);}
 }
 if(circulation){
  const anim=doc.getElementById('anim');if(anim&&bar)viewControls.append(anim);
  const brush=doc.getElementById('brushRow');if(brush&&bar)viewControls.append(brush);
  for(const id of ['ckp','cpSub','cpNote','walkEst','tripRes']){const node=doc.getElementById(id);if(node)results.append(node);}
 }
 if(camera){const note=doc.getElementById('lvlNote');if(note)charts.append(note);}
 if(isovist){const readout=doc.getElementById('wRes');if(readout)results.append(readout);}
 // A consistent camera bar: geometry views only. Editing, result colouring and layers
 // are Settings, with a native disclosure instead of another floating toolbar.
 if(bar)for(const group of [...bar.children]){
  if(!group.matches('.views'))continue;
  const cameraGroup=group.querySelector('[data-cam=plan],[data-view=plan]');
  const fitOnly=group.querySelector('#fit,#fitBtn,#fit3');
  if(!cameraGroup&&!fitOnly)viewControls.prepend(group);
 }
 if(bar&&!bar.querySelector('[data-cam=plan],[data-view=plan]')){const current=doc.createElement('div');current.className='views pc-current-view';current.textContent='Plan';current.setAttribute('aria-label','Current view: Plan');bar.prepend(current);extraNodes.push(current);}
 const advanced=doc.createElement('details');advanced.id='unifiedViewSettings';advanced.className='pc-settings-tools';advanced.innerHTML='<summary>Advanced · view & editing</summary>';
 const editing=doc.createElement('details');editing.className='pc-settings-subgroup';editing.open=true;editing.innerHTML='<summary>View & editing tools</summary>';editing.append(viewControls);
 display.open=true;advanced.append(editing,display);settings.append(advanced);extraNodes.push(advanced,editing);
 advanced.hidden=!viewControls.children.length&&display.hidden;
 const summary=doc.getElementById('projectClimateSummary');if(summary)settings.children[0].after(summary);
 // Long methodological paragraphs are help, not input parameters. Keep full text in an accessible dialog.
 const help=doc.createElement('dialog');help.className='pc-unified-help';help.innerHTML='<h2>Analysis notes</h2><button type="button">Close</button>';
 const notes=[...settings.querySelectorAll('p.note:not([id]),#lvlNote,#qNote,#pmNote')].filter(n=>!n.querySelector('input,select,button,a')&&n.textContent.trim().length>70);
 if(circulation){const usage=doc.getElementById('wUse')?.closest('label')?.querySelector('span.note');if(usage)notes.push(usage);}
 if(notes.length){for(const note of notes)help.append(note);const button=doc.createElement('button');button.type='button';button.className='btn';button.textContent='Analysis notes ⓘ';button.onclick=()=>help.showModal();settings.append(button);help.querySelector('button').onclick=()=>help.close();doc.body.append(help);}
 const scaleNotes=doc.createElement('p');help.append(scaleNotes);help.querySelector('button').onclick=()=>help.close();
 app.pcShowScaleNotes=text=>{scaleNotes.textContent=text;if(!help.isConnected)doc.body.append(help);help.showModal();};
 for(const section of settings.querySelectorAll('.sec'))section.classList.remove('shut','pc-col');
 left.append(settings,exports,parked);right.append(results,charts);
 const css=doc.createElement('style');css.textContent=`
 @media(min-width:901px){
 .pc-simulation-fit .app[data-pc-unified]:has(#ptList){grid-template-columns:380px minmax(0,1fr) 300px!important}
 [data-pc-unified] .pc-unified-group{padding:8px!important;border:1px solid var(--line);border-radius:6px;display:grid;gap:6px;background:var(--surface)}
 [data-pc-unified] .pc-unified-group>h2{margin:0;font-size:12px;line-height:1.4}
 [data-pc-unified] #unifiedSettings{padding:6px!important}
 [data-pc-unified] #unifiedSettings .sec{padding:3px 0!important;border:0!important;gap:6px!important;flex:none!important}
 [data-pc-unified] #unifiedSettings :is(#vgaSet,#axSet,#sgSet){gap:6px!important}
 [data-pc-unified]:has(#modeBar) #unifiedSettings #h-set{display:none}
 [data-pc-unified] #unifiedSettings .sec:has(>#h-draw):has(>#props[hidden]){display:none}
 [data-pc-unified] #unifiedSettings .sec>h2{font-size:11px;margin:0;pointer-events:none}
 [data-pc-unified] #unifiedResults>.sec>h2{display:none}
 [data-pc-unified] #unifiedSettings .sec.shut>:not(h2):not([hidden]),[data-pc-unified] #unifiedSettings .sec.pc-col>:not(h2):not([hidden]){display:revert!important}
 [data-pc-unified] #unifiedSettings .sec>h2:after{display:none!important}
 [data-pc-unified] #unifiedSettings .ctl{gap:4px!important;margin:0!important}
 [data-pc-unified] #unifiedSettings .props{padding:6px!important;margin:0!important}
 [data-pc-unified] #unifiedSettings details.more{margin:0!important;padding:0!important;display:grid;gap:6px}
 [data-pc-unified] .pc-unified-view-controls #anim{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:4px;margin:0}
 [data-pc-unified] .pc-unified-view-controls #anim .two{display:flex;gap:6px;align-items:center}
 [data-pc-unified] .pc-unified-view-controls #anim :is(.aprog,#aMsg){margin:0;flex-basis:100%}
 [data-pc-unified] .pc-unified-view-controls:has(#motion){display:grid;grid-template-columns:1fr 1fr;max-width:440px}
 [data-pc-unified] #pilotSharedSummary{padding:4px 6px!important;margin-bottom:4px!important;line-height:1.3!important}
 [data-pc-unified] #pilotSharedSummary p{margin:4px 0!important}
 [data-pc-unified] #pilotSettings>h2,[data-pc-unified] #pilotCharts>h2{display:none}
 [data-pc-unified] #unifiedSettings .sw2{gap:4px!important}
 [data-pc-unified] #unifiedSettings :is(#longBox,#lvLong,#longRow,#qLong){position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(480px,70vw);box-sizing:border-box;z-index:100;background:var(--surface);box-shadow:0 12px 48px #0003}
 [data-pc-unified] .pc-unified-view-controls{display:flex;gap:4px;flex-wrap:wrap;align-items:center;max-width:100%;background:var(--surface);color:var(--ink);border-radius:5px;padding:4px}
 [data-pc-unified] .pc-unified-view-controls .tools{display:flex!important;gap:4px;flex-wrap:wrap}
 [data-pc-unified] .pc-unified-view-controls #toolHint{flex-basis:100%;margin:0}
 [data-pc-unified] .pc-unified-display{position:relative;background:var(--surface);padding:4px 8px;border:1px solid var(--line);border-radius:5px}
 [data-pc-unified] .pc-unified-display[open]{position:static;display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:6px}
 [data-pc-unified] .pc-unified-display>summary{grid-column:1/-1}
 [data-pc-unified] #unifiedSettings details:not(#pilotOverrides):not(.pc-settings-section):not(.pc-settings-tools):not(.pc-settings-subgroup):not(.pc-unified-display)>summary{display:none}
 [data-pc-unified] #unifiedSettings :is(.pc-settings-section,.pc-settings-tools){border-top:1px solid var(--line);padding:4px 0;margin:0;min-width:0}
 [data-pc-unified] #unifiedSettings :is(.pc-settings-section,.pc-settings-tools,.pc-settings-subgroup)>summary{display:list-item;cursor:pointer;font-weight:600;line-height:1.4;padding:4px 0}
 [data-pc-unified] #unifiedSettings .pc-settings-section>.sec>h2{display:none}
 [data-pc-unified] #unifiedSettings .pc-settings-section:has(>.sec>#h-draw):not(:has(#props:not([hidden]))){display:none}
 [data-pc-unified] #unifiedViewSettings:not([open])>:not(summary),[data-pc-unified] #unifiedSettings .pc-settings-section:not([open])>:not(summary){display:none!important}
 [data-pc-unified] #unifiedViewSettings .views{display:flex;flex-wrap:wrap;gap:4px}
 [data-pc-unified] #unifiedViewSettings .views button{font:inherit;padding:5px 7px}
 [data-pc-unified] .pc-current-view{padding:6px 12px;font-size:12.5px;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:7px}
 [data-pc-unified] #unifiedViewSettings .switch{display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0}
 [data-pc-unified] #unifiedCharts #chartp{display:block!important;position:static!important;width:auto!important;height:auto!important;padding:0!important}
 [data-pc-unified] #unifiedCharts{padding:4px!important;gap:2px!important}
 [data-pc-unified] #unifiedCharts .cpg{padding:0!important;margin:0!important;gap:4px!important;min-width:0!important;max-width:none!important}
 [data-pc-unified] #unifiedCharts .sec{padding:2px 0!important;gap:4px!important;border:0!important}
 [data-pc-unified] #unifiedCharts canvas{background:#fff;border-radius:3px;position:static!important;inset:auto!important;width:100%!important;display:block}
 [data-pc-unified] #unifiedCharts :is(#decay,#bands){height:120px!important}
 [data-pc-unified] #unifiedCharts .cpg{overflow:visible!important}
 [data-pc-unified] #unifiedCharts:has(#cScat) .kp4{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:4px!important}
 [data-pc-unified] #unifiedCharts:has(#cScat) .kp4>div{padding:4px!important}
 [data-pc-unified] #unifiedCharts .lgd,[data-pc-unified] #unifiedCharts .legend{position:static!important;width:auto!important;margin:0!important}
 [data-pc-unified] #unifiedCharts .lgd{gap:3px!important}
 [data-pc-unified] #unifiedCharts .cph .note{white-space:nowrap!important;overflow:hidden;text-overflow:ellipsis;min-width:0}
 [data-pc-unified] #unifiedCharts:has(#cSpot) .kp4{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:4px!important}
 [data-pc-unified] #unifiedCharts:has(#cSpot) .kp4>div{padding:4px!important}
 [data-pc-unified] #unifiedExport{grid-template-columns:repeat(2,minmax(0,1fr))}
 [data-pc-unified] #unifiedExport>h2,[data-pc-unified] #unifiedExport>.sec{grid-column:1/-1}
 [data-pc-unified] #unifiedExport .sec>h2{display:none}
 .pc-unified-help{max-width:680px;max-height:75vh;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:24px}
 }`;
 doc.head.append(css);
 for(const details of settings.querySelectorAll('details'))if(details!==advanced&&!details.closest('#studyContract'))details.open=true;
 app.pcFitSettings=settingsAccordion(doc,settings,extraNodes);
 const context=doc.getElementById('props'),contextHome=context?.parentElement;
 const updateContext=()=>{if(!app.dataset.pcUnified||!context||!isovist)return;const target=!context.hidden&&!context.querySelector('input,select,textarea')?results:contextHome;if(context.parentElement!==target)target.append(context);};
 app.pcUpdateUnifiedContext=updateContext;updateContext();
 const moved=original.filter(({node,parent,next})=>node.parentNode!==parent||node.nextSibling!==next);
 if(isovist&&context){const record=original.find(r=>r.node===context);if(record&&!moved.includes(record))moved.push(record);}
 const hiddenChanges=original.filter(({node,hidden})=>node.hidden!==hidden);
 win.__pcUnifiedCharts?.();
 if(acoustic)win.dispatchEvent(new win.Event('resize'));
 // Preflight at the real panel width. If it does not fit, preserve the old usable UI for review.
 const measured=[];
 const columnStyles=[left,right].map(node=>[node,node.getAttribute('style')]);
 for(const [node]of columnStyles){node.style.setProperty('display','block','important');node.style.setProperty('transform','none','important');node.style.setProperty('width','auto','important');}
 for(const [panel,group]of [[doc.getElementById('panelL'),settings],[doc.getElementById('panelL'),exports],[doc.getElementById('panelR'),charts]]){
  group.classList.add('pc-fit-content');
  const before=group.getAttribute('style');group.style.cssText=`position:fixed;left:0;top:0;width:${Math.max(200,panel.clientWidth-16)}px;box-sizing:border-box;visibility:hidden;transform:none!important`;
  const available=Math.floor(panel.clientHeight-56);
  const required=Math.ceil(group.getBoundingClientRect().height);
  measured.push({group:group.querySelector('h2').textContent,required,available,...(group.id==='unifiedCharts'?{plots:[...group.querySelectorAll('canvas')].map(c=>({id:c.id,height:Math.round(c.getBoundingClientRect().height)})),sections:[...group.querySelectorAll('#chartp>.cpg')].map(c=>({title:c.querySelector('.cph b')?.textContent,height:Math.round(c.getBoundingClientRect().height)}))}:{})});
  if(before===null)group.removeAttribute('style');else group.setAttribute('style',before);
  group.classList.remove('pc-fit-content');
 }
 for(const [node,style]of columnStyles)if(style===null)node.removeAttribute('style');else node.setAttribute('style',style);
 app.dataset.pcUnifiedMeasurements=JSON.stringify(measured);
 // A short chart/export panel must never replace the whole interface with the old shell.
 // Keep the new header and Settings; the fit controller reports any local overflow.
 app.dataset.pcLayoutConstrained=JSON.stringify(measured.filter(x=>x.required>x.available));
 const stopCollapse=e=>e.stopImmediatePropagation(),headings=[...settings.querySelectorAll('.sec>h2')];
 detentionControl?.addEventListener('change',updateDetention);
 for(const h of headings){for(const i of h.querySelectorAll('i'))i.remove();h.classList.remove('pc-tog');h.addEventListener('click',stopCollapse,true);}
 for(const i of doc.querySelectorAll('.sec>h2 i'))i.remove();
 const plan=doc.querySelector('[data-cam=plan],[data-view=plan]');plan?.click();
 for(const split of doc.querySelectorAll('[data-cam=split],[data-view=split]')){const record=original.find(r=>r.node===split);if(record&&!moved.includes(record))moved.push(record);split.remove();}doc.getElementById('stage')?.classList.remove('split');
 // Explicit recovery hook only. Ordinary viewport resizing must never invoke it.
 app.pcRollbackUnified=over=>{
  for(const h of headings)h.removeEventListener('click',stopCollapse,true);
  detentionControl?.removeEventListener('change',updateDetention);
  for(const {node,parent,next}of [...moved].reverse()){if(next?.parentNode===parent)parent.insertBefore(node,next);else parent.appendChild(node);}
  for(const {node,hidden}of hiddenChanges)node.hidden=hidden;
  for(const {node,cls,open}of original)if(node.matches('.sec,h2,details')){if(cls===null)node.removeAttribute('class');else node.setAttribute('class',cls);node.toggleAttribute('open',open);}
  doc.getElementById('panelL').append(left);doc.getElementById('panelR').append(right);
  for(const node of [settings,exports,results,charts,parked,css,help,viewControls,display,workspaceInfo,...extraNodes])node?.remove();
  delete app.dataset.pcUnified;app.dataset.pcUnifiedBlocked=JSON.stringify(over);delete app.pcRollbackUnified;
  win.__pcUnifiedCharts?.();
  delete app.pcShowScaleNotes;delete app.pcUpdateUnifiedContext;delete app.pcFitSettings;
  const notice=doc.createElement('p');notice.className='note pc-layout-review';notice.setAttribute('role','status');notice.style.cssText='padding:6px;margin:0;border:1px solid var(--line)';notice.textContent='Fixed layout needs review: '+over.map(x=>`${x.group} ${x.required}px / ${x.available}px available`).join('; ')+'. Existing controls and current results are preserved.';doc.getElementById('panelL').prepend(notice);
 };
 return true;
}
