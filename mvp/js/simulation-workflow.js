// Presentation only: the engine owns calculation, cancellation and result validity.
const solar = new Set(['sunhours', 'radiation', 'utci']);
const visible = el => !!el && !el.hidden && el.getClientRects().length > 0;

export function studyDocument(frame, id) {
  const doc = frame.contentDocument;
  if (id !== 'stormwater') return doc;
  const model = doc?.getElementById('modelWorkspace');
  return visible(model) ? model.contentDocument : doc?.getElementById('gridWorkspace')?.contentDocument;
}

export function analysisState(doc, id, hasSnapshot = true) {
  if (!doc?.body) return { known: false, busy: false, ready: false, result: null };
  const win = doc.defaultView;
  if (solar.has(id)) {
    const state = win.__sun?.S;
    return { known: true, busy: !!state?.busy, ready: !!state?.lastR && !state.busy && hasSnapshot, result: state?.lastR,progress:state?.progress,validation:state?.validation };
  }
  if (id === 'daylight') {
    const state = win.__pcAnalysisState?.();
    return { known: true, busy: !!doc.getElementById('run')?.disabled, ready: !!state?.ready && hasSnapshot, stale: !!state?.stale, result: win.__day?.RES };
  }
  if(typeof win.__pcAnalysisState==='function'){
    const state=win.__pcAnalysisState(),busy=!!doc.getElementById('run')?.disabled,fraction=parseFloat(doc.querySelector('#prog i')?.style.width)/100;
    return{known:true,busy,ready:!!state?.ready&&!busy&&hasSnapshot,result:state?.ready?(win.__psim?.RES||win.__views?.RES||JSON.stringify(state)):null,progress:busy&&Number.isFinite(fraction)?{fraction,phase:doc.getElementById('runMsg')?.textContent||'Calculating'}:null};
  }
  const busy = !!doc.getElementById('run')?.disabled || ['prog', 'runPill', 'stopRun'].some(id => visible(doc.getElementById(id)));
  return { known: false, busy, ready: !busy, result: null };
}

export function installStudyWorkflow({ frame, id, runButton, stopButton, status, saveButton, prepared, weatherReady, hasSnapshot,onCompleted }) {
  let stopped = false, savedResult = null, hadResult = false, saved = false,lastCompleted=null,saving=false,saveTimer=null,saveError='',busyAt=null,boundRun=null;
  const indicator=document.createElement('progress');indicator.hidden=true;indicator.setAttribute('aria-label','Calculation progress');status.after(indicator);
  const nativeRun=()=>{saveError='';if(!read().known)saved=false;};
  const read = () => analysisState(studyDocument(frame, id), id, hasSnapshot());
  const canSave = () => {
    const state = read();
    return prepared() && weatherReady() && !state.busy && (!state.known || state.ready) && !(saved && (!state.known || state.result === savedResult));
  };
  const tick = () => {
    if (stopped) return;
    const doc = studyDocument(frame, id), state = read(), run = doc?.getElementById('run');
    if(run!==boundRun){boundRun?.removeEventListener('click',nativeRun,true);boundRun=run;boundRun?.addEventListener('click',nativeRun,true);}
    if(state.busy&&busyAt===null)busyAt=performance.now();if(!state.busy)busyAt=null;
    const stop = ['stopRun', 'stop'].map(id => doc?.getElementById(id)).find(visible);
    const ready = prepared() && weatherReady();
    const automatic=saveButton.parentElement.querySelector('#autoSaveResult');if(ready&&automatic&&!automatic.dataset.completionChecked){automatic.dataset.completionChecked='true';if(!state.known){automatic.checked=false;automatic.disabled=true;const label=saveButton.parentElement.querySelector('#autoSaveLabel');if(label)label.textContent='Use Save result for this study';automatic.title='This engine does not yet expose a verified completion state.';}}
    if (state.result) hadResult = true;
    runButton.hidden = !!doc?.body && !run;
    runButton.disabled = !ready || !run || run.disabled || state.busy || saving;
    runButton.textContent = state.busy ? 'Calculating…' : 'Run study';
    stopButton.hidden = !state.busy || !stop;
    stopButton.disabled = !!stop?.disabled;
    saveButton.disabled = saving || !canSave();saveButton.textContent=saving?'Saving result…':'Save result';saveButton.setAttribute('aria-busy',String(saving));
    const progress=state.progress,fraction=Number.isFinite(progress?.fraction)?Math.max(0,Math.min(1,progress.fraction)):null,elapsed=Number.isFinite(progress?.elapsedSeconds)?progress.elapsedSeconds:(busyAt===null?0:(performance.now()-busyAt)/1000);
    indicator.hidden=!state.busy;if(fraction===null)indicator.removeAttribute('value');else{indicator.max=1;indicator.value=fraction;}
    const progressText=`${fraction===null?'Calculating':Math.round(fraction*100)+'%'} · ${progress?.phase||'Engine running'} · ${elapsed.toFixed(1)} s elapsed${fraction===null?' · detailed progress unavailable':''}`;
    const text = saving?'Saving result to this version…':saveError||(!prepared() ? 'Preparing study…' : !weatherReady() ? 'Waiting for project weather' : state.busy ? progressText : state.validation?.blocked?state.validation.message:state.known ?
      state.ready ? (saved && state.result === savedResult ? 'Result saved to this version' : 'Calculation complete · save your result') :
      (state.stale || hadResult ? 'Inputs changed · run again before saving' : 'Run this study to calculate a result') : saved?'Result saved to this version':'Calculate, then save the result to this version');
    if (status.textContent !== text) status.textContent = text;
    status.dataset.state = saving?'saving':saveError?'error':state.busy ? 'running' : state.known && !state.ready && hadResult ? 'stale' : state.ready ? 'ready' : 'idle';
    if(state.known&&state.ready&&state.result&&state.result!==lastCompleted){lastCompleted=state.result;onCompleted?.(state.result);}
  };
  runButton.onclick = () => {
    const doc = studyDocument(frame, id), run = doc?.getElementById('run');
    if (saving || !prepared() || !weatherReady() || !run || run.disabled || read().busy) return;
    run.click(); tick();
    // Expensive runs retain the engine's own confirmation, estimate and Cancel action.
    setTimeout(() => {
      if (stopped) return;
      const confirm = [...['longGo', 'lvStart'].map(id => doc.getElementById(id)),...doc.querySelectorAll('#gwarn [data-gw]')].find(el => {
        if (!el) return false;
        for (let p = el; p; p = p.parentElement) if (p.hidden) return false;
        return true;
      });
      if (confirm) {
        for (let p = confirm.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
        if (visible(confirm)) { confirm.scrollIntoView({ block: 'center' }); confirm.focus({ preventScroll: true }); }
      }
      tick();
    }, 60);
  };
  stopButton.onclick = () => {
    const doc = studyDocument(frame, id), stop = ['stopRun', 'stop'].map(id => doc?.getElementById(id)).find(visible);
    if (stop && !stop.disabled) stop.click();
    tick();
  };
  const timer = setInterval(tick, 250); tick();
  const failSave=(message='The engine did not confirm this save. Retry Save result; your calculated result is still available.')=>{if(stopped)return;saving=false;clearTimeout(saveTimer);saveError=message;tick();};
  return { canSave,isSaving:()=>saving, refresh: tick, beginSave(){if(saving||!canSave())return false;saving=true;saveError='';saveTimer=setTimeout(()=>failSave(),10000);tick();return true;},failSave,markSaved() { saving=false;clearTimeout(saveTimer);saveError='';saved = true; savedResult = read().result; tick(); }, dispose() { stopped = true;clearTimeout(saveTimer);clearInterval(timer);boundRun?.removeEventListener('click',nativeRun,true);indicator.remove();runButton.onclick = stopButton.onclick = null; } };
}
