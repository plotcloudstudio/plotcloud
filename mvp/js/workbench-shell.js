// One command surface; existing Plan Studio controls and history remain authoritative.
export function mountWorkbenchShell(app,{activePane,deleteSelection,fit}){
 const root=app.querySelector('.w2');root.classList.add('wb-shell');
 const bar=document.createElement('header');bar.className='wb-commandbar';bar.setAttribute('aria-label','Workbench commands');
 bar.innerHTML='<button type="button" class="btn sm" id="libraryToggle" aria-expanded="true">Tools</button><div class="wb-edit" role="toolbar" aria-label="Edit model"></div><p class="wb-commandline" role="status" id="commandHint">Command: Select objects</p>';
 root.prepend(bar);bar.insertBefore(app.querySelector('#cap'),bar.querySelector('.wb-edit'));
 const commands=[['select','Select','[data-tool="select"]'],['delete','Delete','[data-tool="del"]'],['undo','Undo','#undo'],['redo','Redo','#redo'],['text','Text','[data-tool="note"]'],['orbit','Orbit','[data-tool="orbit"]']];
 const source=(pane,key,selector)=>{if(!pane.ready)return null;const doc=pane.win.document,ceiling=pane.ws.state().view2d==='ceiling';return doc.querySelector(ceiling&&['select','delete'].includes(key)?`[data-ct="${key==='delete'?'del':'select'}"]`:selector);};
 const edit=bar.querySelector('.wb-edit');
 for(const [key,label,selector]of commands){const button=document.createElement('button');button.type='button';button.className='btn sm';button.dataset.command=key;button.textContent=label;button.title=label;button.onclick=()=>{const pane=activePane();if(!pane.ready)return;if(key==='delete'&&deleteSelection()!==false)return;source(pane,key,selector)?.click();};edit.append(button);}
 const views=app.querySelector('.w3-gearw');bar.append(views);const gear=app.querySelector('#tabGear');gear.textContent='View tools ▾';gear.setAttribute('aria-label','View tools');gear.title='Explode, Walkthrough and Interior elevation';
 bar.append(app.querySelector('.w2-tr'));bar.append(bar.querySelector('.wb-commandline'));
 const utilities=document.createElement('div');utilities.className='wb-zoom';utilities.innerHTML='<button type="button" class="btn sm" data-zoom="fit">Fit</button><button type="button" class="btn sm" data-zoom="zOut" aria-label="Zoom out">−</button><output id="workbenchZoom" aria-label="Zoom">100%</output><button type="button" class="btn sm" data-zoom="zIn" aria-label="Zoom in">+</button>';
 app.querySelector('.w2-status').append(utilities);
 utilities.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(b.dataset.zoom==='fit')fit();else{const p=activePane();if(p.ready)p.win.document.getElementById(b.dataset.zoom)?.click();}});
 app.querySelector('#libraryToggle').onclick=()=>{const closed=root.classList.toggle('wb-library-closed');app.querySelector('#libraryToggle').setAttribute('aria-expanded',String(!closed));};
 if(matchMedia('(max-width:1200px)').matches)app.querySelector('#libraryToggle').click();
 const refresh=()=>{const p=activePane();const doc=p.ready?p.win.document:null;
  for(const [key,,selector]of commands){const b=edit.querySelector(`[data-command="${key}"]`),original=source(p,key,selector);b.disabled=!original||original.disabled;const pressed=original?.getAttribute('aria-pressed');if(pressed!==null&&pressed!==undefined)b.setAttribute('aria-pressed',pressed);}
  const hint=doc?.getElementById('toolHint')?.textContent?.trim()||'Select objects';const text='Command: '+hint;const line=bar.querySelector('#commandHint');if(line.textContent!==text)line.textContent=text;line.title=hint;
  const pct=doc?.getElementById('zPct')?.value;utilities.querySelector('output').textContent=(pct||'100')+'%';
 };
 const timer=setInterval(refresh,250);refresh();return()=>clearInterval(timer);
}
