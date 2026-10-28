// One command surface; existing Plan Studio controls and history remain authoritative.
export function mountWorkbenchShell(app,{activePane,deleteSelection,fit,center}){
 const root=app.querySelector('.w2');root.classList.add('wb-shell');
 const bar=document.createElement('header');bar.className='wb-commandbar';bar.setAttribute('aria-label','Workbench commands');
 bar.innerHTML='<button type="button" class="btn sm" id="libraryToggle" aria-expanded="true">Tools</button><div class="wb-edit" role="toolbar" aria-label="Edit model"></div><p class="wb-commandline" role="status" id="commandHint">Command: Select objects</p>';
 root.prepend(bar);bar.insertBefore(app.querySelector('#cap'),bar.querySelector('.wb-edit'));
 const commands=[['select','Select','[data-tool="select"]'],['delete','Delete','[data-tool="del"]'],['undo','Undo','#undo'],['redo','Redo','#redo'],['text','Text','[data-tool="note"]'],['orbit','Orbit','[data-tool="orbit"]']];
 const source=(pane,key,selector)=>{if(!pane.ready)return null;const doc=pane.win.document,ceiling=pane.ws.state().view2d==='ceiling';return doc.querySelector(ceiling&&['select','delete'].includes(key)?`[data-ct="${key==='delete'?'del':'select'}"]`:selector);};
 const edit=bar.querySelector('.wb-edit');
 for(const [key,label,selector]of commands){const button=document.createElement('button');button.type='button';button.className='btn sm';button.dataset.command=key;button.textContent=label;button.title=label;button.onclick=()=>{const pane=activePane();if(!pane.ready)return;if(key==='delete'&&deleteSelection()!==false)return;source(pane,key,selector)?.click();};edit.append(button);}
 const centerButton=document.createElement('button');centerButton.type='button';centerButton.className='btn sm';centerButton.dataset.command='center';centerButton.textContent='Center model';centerButton.title='Center selected imported building objects, or all visible unlocked building imports, at X/Y=0 and base Z=0. Furniture is excluded. Undo restores the position.';centerButton.onclick=()=>center?.();edit.append(centerButton);
 const more=document.createElement('details');more.className='wb-extra';more.innerHTML='<summary>More ▾</summary><div class="w2-menu" role="group" aria-label="Additional edit tools"></div>';edit.after(more);
 const extra=[['clear','Clear current level…','#clear',false],['light','Ceiling light','[data-ct="light"]',true],['panel','Ceiling panel','[data-ct="panel"]',true],['vent','Ceiling vent','[data-ct="vent"]',true],['smoke','Smoke detector','[data-ct="smoke"]',true]];
 for(const [key,label,selector]of extra){const b=document.createElement('button');b.type='button';b.dataset.extra=key;b.textContent=label;b.onclick=()=>{const p=activePane();const original=p.ready?p.win.document.querySelector(selector):null;if(original&&!original.disabled)original.click();more.open=false;};more.lastElementChild.append(b);}
 more.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();more.open=false;more.querySelector('summary').focus();}});
 const dismiss=e=>{if(!more.contains(e.target))more.open=false;};document.addEventListener('pointerdown',dismiss);
 const views=app.querySelector('.w3-gearw');bar.append(views);const gear=app.querySelector('#tabGear');gear.textContent='View tools ▾';gear.setAttribute('aria-label','View tools');gear.title='Explode, Walkthrough and Interior elevation';
 bar.append(app.querySelector('.w2-tr'));bar.append(bar.querySelector('.wb-commandline'));
 const utilities=document.createElement('div');utilities.className='wb-zoom';utilities.innerHTML='<button type="button" class="btn sm" data-zoom="fit">Fit</button><button type="button" class="btn sm" data-zoom="fitSelectedBtn">Zoom selected</button><button type="button" class="btn sm" data-zoom="zOut" aria-label="Zoom out">−</button><output id="workbenchZoom" aria-label="Zoom">100%</output><button type="button" class="btn sm" data-zoom="zIn" aria-label="Zoom in">+</button>';
 app.querySelector('.w2-status').append(utilities);
 utilities.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(b.dataset.zoom==='fit')fit();else{const p=activePane();if(p.ready)p.win.document.getElementById(b.dataset.zoom)?.click();}});
 app.querySelector('#libraryToggle').onclick=()=>{const closed=root.classList.toggle('wb-library-closed');app.querySelector('#libraryToggle').setAttribute('aria-expanded',String(!closed));};
 if(matchMedia('(max-width:1200px)').matches)app.querySelector('#libraryToggle').click();
 const refresh=()=>{const p=activePane();const doc=p.ready?p.win.document:null;
  centerButton.disabled=!p.ready;
  for(const [key,,selector]of commands){const b=edit.querySelector(`[data-command="${key}"]`),original=source(p,key,selector);b.disabled=!original||original.disabled;const pressed=original?.getAttribute('aria-pressed');if(pressed!==null&&pressed!==undefined)b.setAttribute('aria-pressed',pressed);}
  for(const[key,,selector,ceiling]of extra){const b=more.querySelector(`[data-extra="${key}"]`),original=doc?.querySelector(selector);b.hidden=ceiling&&(!p.ready||p.ws.state().view2d!=='ceiling');b.disabled=!original||original.disabled;}
  const hint=doc?.getElementById('toolHint')?.textContent?.trim()||'Select objects';const text='Command: '+hint;const line=bar.querySelector('#commandHint');if(line.textContent!==text)line.textContent=text;line.title=hint;
  const pct=doc?.getElementById('zPct')?.value;utilities.querySelector('output').textContent=(pct||'100')+'%';
 };
 const timer=setInterval(refresh,250);refresh();return()=>{clearInterval(timer);document.removeEventListener('pointerdown',dismiss);};
}
