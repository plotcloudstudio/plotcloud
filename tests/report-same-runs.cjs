// The comparison report keeps its runs (2026-11-24): every download of one report view (Metrics CSV, Field CSV, PDF) names the
// same runs, even when a newer run is saved between the clicks; a note then offers the newer runs, and "Use the latest runs"
// switches to them. Also the Tables run CSV writes one point per row for both point formats (flat and [x,y,v]).
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('fs'), { execFileSync } = require('child_process');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], out = process.env.SHOT_DIR || '/tmp';
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const ids = await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save();
      const q = (await import('./js/hospital-example.js')).openHospital(), va = q.versions.at(-1) || S.saveVersion(q, 'QA baseline'), vb = S.saveVersion(q, 'QA changed design');
      const field = (k) => ({ label: 'Sun hours', unit: 'h', step: 1, pts: [[0, 0, 1 + k], [1, 0, 2 + k], [0, 1, 3 + k]] });
      const ra = S.addRun(q, va.id, 'sunhours', {}, { avgSunHours: 4, field: field(0), kpis: [] }, 'workspace'), rb = S.addRun(q, vb.id, 'sunhours', {}, { avgSunHours: 5, field: { label: 'Sun hours', unit: 'h', step: 1, pts: [0, 0, 2, 1, 0, 3, 0, 1, 4] }, kpis: [] }, 'workspace'); S.save();
      return { id: q.id, a: va.id, b: vb.id, ra: ra.id, rb: rb.id }; });
    await p.goto(`${base}/mvp/#/comparison-report/${ids.id}?a=${ids.a}&b=${ids.b}&sim=sunhours`); await p.waitForSelector('[data-report-export=metrics]');
    const dl = async (k) => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.click(`[data-report-export=${k}]`)]); const f = out + '/same-runs-' + k + '-' + d.suggestedFilename(); await d.saveAs(f); return fs.readFileSync(f, 'utf8'); };
    const metrics = await dl('metrics'); assert(metrics.includes(ids.ra) && metrics.includes(ids.rb), 'Metrics CSV names both runs');
    // a newer run on design B, saved between the clicks
    const rb2 = await p.evaluate(async (ids) => { const S = await import('./js/store.js'), q = S.project(ids.id); const r = S.addRun(q, ids.b, 'sunhours', {}, { avgSunHours: 6, field: { label: 'Sun hours', unit: 'h', step: 1, pts: [[0, 0, 9]] }, kpis: [] }, 'workspace'); S.save(); return r.id; }, ids);
    const fields = await dl('fields'), cells = (l) => [...l.matchAll(/("(?:[^"]|"")*"|[^,]*)(,|$)/g)].map((m) => m[1].replace(/^"|"$/g, '').replace(/""/g, '"')).slice(0, -1); const runsInFields = [...new Set(fields.replace(/^\ufeff/, '').split(/\r?\n/).slice(1).map((l) => cells(l)[2]))];
    assert.deepEqual(runsInFields.sort(), [ids.ra, ids.rb].sort(), 'Field CSV uses the same runs, not the newer one: ' + runsInFields);
    assert.equal(fields.split(/\r?\n/).length - 1, 6, 'one row per point: 3 + 3');
    const [d] = await Promise.all([p.waitForEvent('download', { timeout: 240000 }), p.click('[data-report-export=pdf]')]); const pdfF = out + '/same-runs.pdf'; await d.saveAs(pdfF);
    const pdfText = execFileSync('pdftotext', [pdfF, '-']).toString(); assert(pdfText.includes(ids.rb) && !pdfText.includes(rb2), 'the PDF names the same run for B');
    assert.equal(await p.isVisible('#reportNewer'), true, 'a note says a newer run exists');
    console.log(`PASS one report view: Metrics CSV, Field CSV and PDF all name runs ${ids.ra} and ${ids.rb}; the newer ${rb2} is offered in a note`);
    await p.click('#reportRefresh'); const m2 = await dl('metrics'); assert(m2.includes(rb2) && !m2.includes(ids.rb), 'after "Use the latest runs" the newer run is used');
    assert.equal(await p.isVisible('#reportNewer'), false, 'note gone');
    console.log('PASS "Use the latest runs" switches to the newer run');
    // Tables: run CSV for both point formats
    const rows = await p.evaluate(async (ids) => { const S = await import('./js/store.js'), T = await import('./js/pages/tables.js'), q = S.project(ids.id); const v = q.versions.at(-1).id; return [{ id: 'rN', versionId: v, simId: 'sunhours', created: '', results: { field: { label: 'Sun hours', unit: 'h', pts: [[0, 0, 1], [1, 0, 2], [0, 1, 3]] } } }, { id: 'rF', versionId: v, simId: 'sunhours', created: '', results: { field: { label: 'Sun hours', unit: 'h', pts: [0, 0, 2, 1, 0, 3, 0, 1, 4] } } }].map((r) => { const csv = T.runCSV(q, r), i = csv.split('\n').findIndex((l) => l.startsWith('x_m')); return { pts: csv.split('\n').slice(i + 1), stats: T.fieldStats(r.results.field) }; }); }, ids);
    assert.deepEqual(rows[0].pts, ['0,0,1', '1,0,2', '0,1,3'], 'nested points: one per row'); assert.deepEqual(rows[1].pts, ['0,0,2', '1,0,3', '0,1,4'], 'flat points: one per row');
    assert(rows[0].stats.n === 3 && rows[0].stats.mean === 2 && rows[1].stats.mean === 3, 'field statistics for both formats ' + JSON.stringify(rows.map((r) => r.stats)));
    console.log('PASS Tables run CSV and field statistics read both point formats');
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
