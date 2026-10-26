// P0 import-to-result foundation: Quick Simulation is independent of Site/Plan Studio, requires semantic and level review,
// saves a traceable analysis model, blocks incompatible studies, and exposes evidence exports.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const base = (process.env.TEST_BASE || 'http://127.0.0.1:8767') + '/mvp/';

(async () => {
  const importer = fs.readFileSync(path.join(__dirname, '../mvp/js/viewport.js'), 'utf8');
  assert.doesNotMatch(importer, /over 25 MB|Over 80,000 triangles/); assert.match(importer, /budget = 120000/);
  const chrome = process.env.PLAYWRIGHT_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(chrome) ? chrome : undefined, args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('requestfailed', (r) => errors.push(`${r.url()} · ${r.failure()?.errorText}`));
    await page.goto(base); await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('plotcloud'); }); await page.reload();
    await page.goto(base + '#/simulations'); await page.locator('a[href="#/quick-simulation"]').waitFor();
    await page.goto(base + '?quick=1#/quick-simulation'); await page.locator('#qsFile').waitFor({ state: 'attached', timeout: 8000 }).catch(async (error) => { console.error('Quick page failed:', page.url(), errors, (await page.locator('body').innerText()).slice(0, 1000)); throw error; });
    await page.evaluate(() => { const mesh = [0,0,0,5,0,0,5,0,3]; __quickSimulation.accept({ source:{name:'Rhino-test.3dm',bytes:52428800,format:'3dm',unitScale:1,upAxis:'z',importedAt:new Date().toISOString()}, sourceTriangles:240000,triangles:3,simplified:true,
      components:[0,1,2].map((i)=>({name:`Wall_${i+1}`,srcLayer:'L01_Walls',type:'imported',layer:'Imported',mat:'Imported',sourceTriangles:80000,g:{x:i?5:0,y:i===2?5:0,z:0,w:5,d:.2,h:3},mesh})) }); });
    await page.locator('#qsReview:not([hidden])').waitFor();
    assert.equal(await page.locator('[data-map]').inputValue(), 'wall');
    assert.match(await page.locator('#qsReady').innerText(), /Ready with stated limits/);
    await page.locator('[data-lconfirm="0"]').check(); await page.locator('#qsSave').click();
    const saved = await page.evaluate(async () => { const S = await import('./js/store.js'), p = S.projects()[0], v = p.versions.at(-1); return { analysisOnly: p.analysisOnly, siteRequired: p.siteRequired, versions: p.versions.length, source: v.model.analysisModel.source, readiness: v.model.analysisModel.readiness, levels: v.model.analysisModel.levels }; });
    assert.equal(saved.analysisOnly, true); assert.equal(saved.siteRequired, false); assert.equal(saved.versions, 1); assert.match(saved.source.fingerprint, /^fnv1a-/); assert.equal(saved.levels[0].confirmed, true);
    // A different study must be checked against the saved model instead of assuming every imported mesh is valid.
    const storm = await page.evaluate(async () => { const S = await import('./js/store.js'), A = await import('./js/analysis-model.js'); return A.inspectAnalysisModel(S.projects()[0].versions[0].model, 'stormwater'); });
    assert.equal(storm.state, 'not-ready'); assert.match(storm.issues.join(' '), /ground or floor surface/);
    // A saved engine result carries the source/analysis lineage; Results exposes both durable export formats.
    const exported = await page.evaluate(async () => { const S = await import('./js/store.js'), E = await import('./js/result-export.js'), p = S.projects()[0], v = p.versions[0]; S.addRun(p, v.id, 'daylight', { level: 'L1' }, { kpis: [['sDA', '42%']], sda: 42 }); return { lineage:p.runs[0].input, json:E.evidencePayload(p, '2026-10-25T00:00:00.000Z'), csv:E.resultsCsv(p) }; });
    const lineage = exported.lineage;
    assert.equal(lineage.level, 'L1'); assert.match(lineage.modelSource.fingerprint, /^fnv1a-/); assert.ok(lineage.analysisModelId);
    assert.equal(exported.json.format, 'plotcloud-simulation-evidence'); assert.equal(exported.json.versions[0].analysisModel.id, lineage.analysisModelId); assert.match(exported.csv, /source_fingerprint/); assert.match(exported.csv, /Rhino-test\.3dm/); assert.match(exported.csv, /fnv1a-/);
    const resultsSource = fs.readFileSync(path.join(__dirname, '../mvp/js/pages/results.js'), 'utf8'); assert.match(resultsSource, /Export CSV/); assert.match(resultsSource, /Export evidence JSON/);
    assert.deepEqual(errors.filter((x) => !/fonts\.googleapis/.test(x)), []); console.log('PASS P0 Quick Simulation: import, review, level confirmation, preflight, lineage and exports');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
