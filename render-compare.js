/* Compare immutable rendering versions without changing their inputs. */
(function (root) {
  'use strict';
  function baseline(a, b) {
    if (!a || !b) return {kind: 'empty', text: 'Generate at least two results to compare options.'};
    const ar = a.request || {}, br = b.request || {};
    const ac = a.sourceContext || ar.source_context || {}, bc = b.sourceContext || br.source_context || {};
    const sameImage = !!ar.source_image && ar.source_image === br.source_image;
    if (ac.project && bc.project && ac.project !== bc.project) return {kind: 'different', text: 'Different projects. Review the source and camera before comparing.'};
    if (ac.sourceRecordId && bc.sourceRecordId) {
      if (ac.sourceRecordId !== bc.sourceRecordId) return {kind: 'different', text: 'Different source captures. Camera, model or image settings may differ.'};
      if (!sameImage) return {kind: 'related', text: 'Same original Studio capture; one input was refined. These are successive edits, rather than a controlled A/B comparison.'};
      return {kind: 'same', text: 'Same saved Studio source capture and input image. Compare furniture, materials and lighting changes.'};
    }
    return sameImage
      ? {kind: 'same-image', text: 'Same uploaded input image. Model dimensions and camera metadata are unverified.'}
      : {kind: 'unknown', text: 'Different or unknown source images. A matching camera and model cannot be confirmed.'};
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {baseline};
  if (!root.document) return;
  const document = root.document;
  const history = document.getElementById('history');
  if (!history) return;
  const panel = document.createElement('section'); panel.className = 'panel'; panel.id = 'renderCompare'; panel.setAttribute('aria-labelledby', 'renderCompareTitle');
  panel.innerHTML = '<h2 id="renderCompareTitle">Compare options</h2><p>Choose two generated results. Original images and requests stay unchanged.</p><div class="preview"><div><label for="compareA">Option A</label><select id="compareA"></select></div><div><label for="compareB">Option B</label><select id="compareB"></select></div></div><p id="compareBasis" class="note" role="status"></p><div class="preview"><figure style="margin:0;min-width:0"><img id="compareImageA" alt="Option A" style="display:block;width:100%;max-height:420px;object-fit:contain" hidden><figcaption id="compareCaptionA" style="font-size:12px;overflow-wrap:anywhere"></figcaption></figure><figure style="margin:0;min-width:0"><img id="compareImageB" alt="Option B" style="display:block;width:100%;max-height:420px;object-fit:contain" hidden><figcaption id="compareCaptionB" style="font-size:12px;overflow-wrap:anywhere"></figcaption></figure></div><div class="actions"><button type="button" class="secondary" id="downloadComparison">Download comparison PNG</button><button type="button" class="secondary" id="exportComparison">Export comparison record</button></div><p id="compareStatus" class="status" role="status"></p>';
  history.parentElement.insertAdjacentElement('afterend', panel);
  const $ = id => document.getElementById(id);
  let items = [], exporting = false;
  const identity = (v, i) => v.savedRecordId || v.request?.request_id || 'legacy-' + v.createdAt + '-' + i;
  const selected = id => items.find((v, i) => identity(v, i) === $(id).value);
  const description = v => {
    const c = v.sourceContext || v.request?.source_context || {};
    const w = v.request?.interior_workflow;
    const target = w?.target?.description || w?.target?.name || '';
    return [c.viewName || c.fileName || c.name || 'Uploaded image', c.version != null ? 'model v' + c.version : '', target, v.request?.style, v.createdAt ? new Date(v.createdAt).toLocaleString() : ''].filter(Boolean).join(' · ');
  };
  function update() {
    const a = selected('compareA'), b = selected('compareB'), distinct = a && b && a !== b;
    const basis = distinct ? baseline(a, b) : {kind: 'empty', text: items.length < 2 ? 'Generate at least two results to compare options.' : 'Choose a different result for each option.'};
    $('compareBasis').textContent = basis.text; $('compareBasis').dataset.basis = basis.kind;
    for (const [letter, v] of [['A', a], ['B', b]]) {
      const img = $('compareImage' + letter); img.hidden = !v;
      if (v) { img.src = v.img; $('compareCaption' + letter).textContent = description(v); }
      else { img.removeAttribute('src'); $('compareCaption' + letter).textContent = ''; }
    }
    $('downloadComparison').disabled = !distinct || exporting; $('exportComparison').disabled = !distinct || exporting;
  }
  function refresh() {
    items = root.__pcRender?.getVersionSnapshots?.() || [];
    const oldA = $('compareA').value, oldB = $('compareB').value;
    for (const [id, previous, fallback] of [['compareA', oldA, 1], ['compareB', oldB, 0]]) {
      const select = $(id); select.replaceChildren();
      items.forEach((v, i) => { const option = document.createElement('option'); option.value = identity(v, i); option.textContent = 'Result ' + (items.length - i) + ' · ' + (v.request?.style || 'Render'); select.append(option); });
      select.disabled = items.length < 2;
      select.value = items.some((v, i) => identity(v, i) === previous) ? previous : items.length ? identity(items[Math.min(fallback, items.length - 1)], Math.min(fallback, items.length - 1)) : '';
    }
    // A second result should automatically populate the second slot.
    if (items.length > 1 && $('compareA').value === $('compareB').value) {
      const alternate = items.findIndex((v, i) => identity(v, i) !== $('compareA').value);
      $('compareB').value = identity(items[alternate], alternate);
    }
    update();
  }
  function download(name, blob) {
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function loadImage(src) {
    const response = await fetch(src, {credentials: 'omit'});
    if (!response.ok) throw Error('The image host refused access. Save the result to your project and try again.');
    const blob = await response.blob();
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type) || blob.size > 32 * 1024 * 1024) throw Error('Comparison requires PNG, JPEG or WebP images smaller than 32 MB.');
    const url = URL.createObjectURL(blob), img = new Image();
    try { img.src = url; await img.decode(); if (img.naturalWidth * img.naturalHeight > 40e6) throw Error('Image is too large for comparison export.'); return img; }
    finally { URL.revokeObjectURL(url); }
  }
  async function exportingTask(action) {
    if (exporting) return;
    const a = selected('compareA'), b = selected('compareB'); if (!a || !b || a === b) return;
    exporting = true; update(); $('compareStatus').textContent = 'Preparing comparison…';
    try { await action(a, b); $('compareStatus').textContent = 'Comparison downloaded.'; }
    catch (e) { $('compareStatus').textContent = 'Could not export: ' + e.message; }
    finally { exporting = false; update(); }
  }
  $('compareA').onchange = $('compareB').onchange = () => { $('compareStatus').textContent = ''; update(); };
  $('downloadComparison').onclick = () => exportingTask(async (a, b) => {
    const images = await Promise.all([loadImage(a.img), loadImage(b.img)]);
    const width = 1200, imageHeight = 760, header = 130, canvas = document.createElement('canvas'); canvas.width = width * 2; canvas.height = imageHeight + header + 50;
    const x = canvas.getContext('2d'); x.fillStyle = '#fbfaf7'; x.fillRect(0, 0, canvas.width, canvas.height); x.fillStyle = '#222420'; x.font = '24px sans-serif'; x.fillText('PlotCloud · Interior options', 24, 36); x.font = '16px sans-serif'; x.fillText(baseline(a, b).text, 24, 67, canvas.width - 48);
    images.forEach((img, i) => { const scale = Math.min((width - 48) / img.naturalWidth, imageHeight / img.naturalHeight); const w = img.naturalWidth * scale, h = img.naturalHeight * scale; x.font = '20px sans-serif'; x.fillText('Option ' + (i ? 'B' : 'A'), i * width + 24, 108); x.drawImage(img, i * width + (width - w) / 2, header + (imageHeight - h) / 2, w, h); });
    x.font = '14px sans-serif'; x.fillText('AI design visualization · Verify against the model. Export the comparison record for complete inputs.', 24, canvas.height - 18);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); if (!blob) throw Error('The browser could not create the comparison image.'); download('plotcloud-interior-comparison.png', blob);
  });
  $('exportComparison').onclick = () => exportingTask(async (a, b) => {
    const contexts = [a, b].map(v => v.sourceContext || v.request?.source_context || {});
    const sources = root.PlotCloudRenders ? await Promise.all(contexts.map(c => c.sourceRecordId ? root.PlotCloudRenders.get(c.sourceRecordId) : null)) : [];
    const record = {schema: 1, kind: 'interior-option-comparison', createdAt: new Date().toISOString(), baseline: baseline(a, b), options: [a, b].map((v, i) => ({label: i ? 'B' : 'A', createdAt: v.createdAt, savedRecordId: v.savedRecordId || null, sourceContext: contexts[i], request: v.request, image: v.img, sourceRecord: sources[i] || null})), notice: 'AI visualization. A matching image alone does not verify dimensions or product identity.'};
    download('plotcloud-interior-comparison.json', new Blob([JSON.stringify(record, null, 2)], {type: 'application/json'}));
  });
  root.addEventListener('pc-render-versions-changed', refresh); refresh();
})(typeof window === 'undefined' ? {} : window);
