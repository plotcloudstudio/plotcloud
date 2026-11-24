// Compare versions with results saved in the Workspace (2026-11-15), on the Fallingwater case: Sun hours saved on one version, a
// mass added, saved again on the next version; Results → Compare draws both maps from the saved fields and marks the cells that
// changed (the mass's shadow), with the figures of both versions in the table
const { chromium } = require('playwright'), assert = require('node:assert/strict'), os = require('node:os');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || os.tmpdir();
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const pid = await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); const m = await import('./js/fallingwater-dashboard.js'), q = m.openCase(); try { localStorage.setItem('pc-mvp-current', q.id); localStorage.setItem('pc-unfold', '1'); } catch { } return q.id; });
    await p.goto(base + '/mvp/#/workspace/' + pid); await p.waitForFunction(() => window.__wsStudy?.open && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 240000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    const runSave = async () => { await p.evaluate(() => window.__wsStudy.open('sunhours')); await p.waitForTimeout(800); await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click());
      await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 900000 }); assert.equal(await p.evaluate(() => window.__wsStudy.state().err), '');
      await p.waitForTimeout(1500); await p.click('.sp-studyres [data-st=save]'); await p.waitForTimeout(300);
      // with unsaved model changes Save first asks (2026-11-23): "Save as version vN?", then a second click saves
      if (await p.evaluate(() => /Save as version v\d+\?/.test(document.querySelector('.sp-studyres')?.innerText || ''))) { console.log('PASS Save asks first: the model has unsaved changes'); await p.click('.sp-studyres [data-st=save]'); }
      await p.waitForFunction(() => /Saved to results/.test(document.querySelector('.sp-studyres')?.innerText || ''), null, { timeout: 60000 });
      return p.evaluate(async (id) => { const S = await import('./js/store.js'), pr = S.project(id), r = pr.runs.at(-1); return { v: S.version(pr, r.versionId)?.n, n: r.results.field?.n, label: r.results.field?.label, thumb: (r.results.thumb || '').length, kpis: (r.results.kpis || []).length }; }, pid); };
    const s1 = await runSave(); assert(s1.n > 200 && s1.n <= 2700 && s1.thumb > 5000 && s1.kpis >= 3, 'first save keeps a map, a picture and the figures: ' + JSON.stringify(s1));
    // a tall mass beside the house: its shadow changes the sun hours
    await p.evaluate(() => { const r = window.__wsStudy.state().res, cx = r.X0 + r.nx * r.cell * 0.5, cy = r.Y0 + r.ny * r.cell * 0.3; const ws = __ws2.inst.plan.ws, M = JSON.parse(ws.model()); (M.masses ||= []).push({ id: 'mass_qa', name: 'QA block', points: [[cx - 8, cy - 8], [cx + 8, cy - 8], [cx + 8, cy + 8], [cx - 8, cy + 8]], storeys: 8, fh: 3.2, use: 'Residential', object_type: 'mass', layer: 'Masses' }); const snap = JSON.stringify(M); ws.apply(snap, false); __ws2.hub.change('plan', snap, false); });
    await p.waitForTimeout(2500);
    const s2 = await runSave(); assert(s2.v > s1.v && s2.label === s1.label, 'second save on a newer version, same map: ' + JSON.stringify([s1, s2]));
    console.log('PASS saved twice:', JSON.stringify([s1, s2]));
    await p.goto(base + `/mvp/#/results/${pid}?sim=sunhours`); await p.waitForFunction(() => document.querySelector('.fcv[data-side="b"]')?.dataset.lit != null, null, { timeout: 120000 });
    const cmp = await p.evaluate(() => ({ lit: +document.querySelector('.fcv[data-side="b"]').dataset.lit, cnt: document.querySelector('#fCount')?.textContent, miss: document.querySelectorAll('#ma .miss, #mb .miss').length, rows: [...document.querySelectorAll('.cw-tab tbody tr')].map((t) => t.innerText.replace(/\s+/g, ' ')).slice(0, 6) }));
    assert.equal(cmp.miss, 0, 'no "No picture kept"'); const tot = +(/of (\d+) points/.exec(cmp.cnt) || [])[1]; assert(cmp.lit > 0 && cmp.lit < tot * 0.5, 'the changed cells, not the whole map: ' + JSON.stringify(cmp)); assert(cmp.rows.length >= 3, 'figures of both versions ' + JSON.stringify(cmp.rows));
    await p.evaluate(() => document.querySelector('#cw')?.scrollIntoView()); await p.waitForTimeout(500); await p.screenshot({ path: `${out}/compare-sunhours.png` });
    console.log('PASS Compare versions on the map:', cmp.cnt, '·', JSON.stringify(cmp.rows.slice(0, 3)));
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
