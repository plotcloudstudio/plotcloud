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
    return { known: true, busy: !!state?.busy, ready: !!state?.lastR && !state.busy && hasSnapshot, result: state?.lastR };
  }
  if (id === 'daylight') {
    const state = win.__pcAnalysisState?.();
    return { known: true, busy: !!doc.getElementById('run')?.disabled, ready: !!state?.ready && hasSnapshot, stale: !!state?.stale, result: win.__day?.RES };
  }
  const busy = !!doc.getElementById('run')?.disabled || ['prog', 'runPill', 'stopRun'].some(id => visible(doc.getElementById(id)));
  return { known: false, busy, ready: !busy, result: null };
}

export function installStudyWorkflow({ frame, id, runButton, stopButton, status, saveButton, prepared, weatherReady, hasSnapshot }) {
  let stopped = false, savedResult = null, hadResult = false, saved = false;
  const read = () => analysisState(studyDocument(frame, id), id, hasSnapshot());
  const canSave = () => {
    const state = read();
    return prepared() && weatherReady() && !state.busy && (!state.known || state.ready);
  };
  const tick = () => {
    if (stopped) return;
    const doc = studyDocument(frame, id), state = read(), run = doc?.getElementById('run');
    const stop = ['stopRun', 'stop'].map(id => doc?.getElementById(id)).find(visible);
    const ready = prepared() && weatherReady();
    if (state.result) hadResult = true;
    runButton.hidden = !!doc?.body && !run;
    runButton.disabled = !ready || !run || run.disabled || state.busy;
    runButton.textContent = state.busy ? 'Calculating…' : 'Run study';
    stopButton.hidden = !state.busy || !stop;
    stopButton.disabled = !!stop?.disabled;
    saveButton.disabled = !canSave() || (state.known && saved && state.result === savedResult);
    const text = !prepared() ? 'Preparing study…' : !weatherReady() ? 'Waiting for project weather' : state.busy ? 'Calculating · please wait' : state.known ?
      state.ready ? (saved && state.result === savedResult ? 'Result saved to this version' : 'Calculation complete · save your result') :
      (state.stale || hadResult ? 'Inputs changed · run again before saving' : 'Run this study to calculate a result') : 'Calculate, then save the result to this version';
    if (status.textContent !== text) status.textContent = text;
    status.dataset.state = state.busy ? 'running' : state.known && !state.ready && hadResult ? 'stale' : state.ready ? 'ready' : 'idle';
  };
  runButton.onclick = () => {
    const doc = studyDocument(frame, id), run = doc?.getElementById('run');
    if (!prepared() || !weatherReady() || !run || run.disabled || read().busy) return;
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
  return { canSave, refresh: tick, markSaved() { saved = true; savedResult = read().result; tick(); }, dispose() { stopped = true; clearInterval(timer); runButton.onclick = stopButton.onclick = null; } };
}
