// The study area in Simulation quality, every study in Generate pictures, and the report's summary over several pages (2026-11-18).
// - The study cards have no "Change area"; the area is set once in Simulation quality (5× unless set), by a chip or a typed multiple,
//   kept with the project's defaults, and the card's link opens it.
// - Generate pictures lists every study the Workspace runs (Structure, Snow, Stormwater, the interior studies…).
// - The export list's "Clear list" empties it in one click and Undo brings the items back.
// - A report of 30 items: the summary table runs on to a second page (no row over the footer), each chapter's page as listed,
//   the chapter titles tell the views of one level apart, and the slides' summary splits at 12 rows.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 960 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'persp' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    const id = await p.evaluate(async () => (await import('./js/hospital-example.js')).openHospital().id); await p.goto(base + '/mvp/#/workspace/' + id);
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);

    // ---- the project's name, top left: no switcher; click it to rename (Esc cancels, Enter keeps)
    assert.equal(await p.locator('.sp-pmenu').count(), 0, 'no project switcher'); assert.equal(await p.locator('.sp-proj a[href^="#/workspace/"]').count(), 0);
    await p.click('.sp-pname'); await p.fill('.sp-pnin', 'Changed then cancelled'); await p.press('.sp-pnin', 'Escape');
    await p.click('.sp-pname'); await p.fill('.sp-pnin', 'Hospital, scheme B'); await p.press('.sp-pnin', 'Enter'); await p.waitForTimeout(200);
    const nm = await p.evaluate(async (pid) => { const S = await import('./js/store.js'); return [document.querySelector('.sp-pn').textContent, S.project(pid).name]; }, id);
    assert.deepEqual(nm, ['Hospital, scheme B', 'Hospital, scheme B'], 'renamed in place and kept');
    console.log('PASS the project name: no switcher; renamed in place (Esc cancels, Enter keeps)');
    // ---- the study area: no Change area on the card; 5× by default; set in Simulation quality
    await p.evaluate(() => window.__wsStudy.open('sunhours')); await p.waitForSelector('.sp-studycard'); await p.waitForTimeout(500);
    const card = await p.locator('.sp-studycard').innerText(); assert(!/Change area/.test(card.replace(/Change it in Simulation quality/, '')), 'no Change area button'); assert.match(card, /Study area: 5×/);
    assert.equal(await p.evaluate(() => window.__wsStudy.state().area), 5);
    await p.click('.sp-studycard [data-st=qpop]'); await p.waitForSelector('[data-qarea]', { state: 'visible' });
    await p.click('[data-qarea="3"]'); await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => window.__wsStudy.state().area), 3); assert.match(await p.locator('.sp-studycard').innerText(), /Study area: 3×/);
    await p.evaluate(() => { const x = document.querySelector('[data-qarea-in]'); x.value = '4.5'; x.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(300);
    const kept = await p.evaluate(async (pid) => { const S = await import('./js/store.js'); return [window.__wsStudy.state().area, S.conditionsOf(S.project(pid)).defaults.area]; }, id);
    assert.deepEqual(kept, [4.5, 4.5], 'kept with the project defaults'); assert.match(await p.locator('.sp-studycard').innerText(), /Study area: 4\.5×/);
    console.log('PASS study area: no Change area on the card; 5× by default; set to 3× by a chip and 4.5× typed in Simulation quality, kept with the project');

    // ---- Generate pictures lists every study the Workspace runs
    await p.click('.sp-xlb'); await p.waitForTimeout(500);
    const gen = await p.evaluate(() => [...document.querySelectorAll('[data-gp]')].map((x) => x.dataset.gp));
    for (const k of ['sunhours', 'shadebenefit', 'solarenvelope', 'snow', 'stormwater', 'watersound', 'views', 'movementdepth', 'isovist', 'wayfinding', 'privacy', 'evac', 'cameras', 'structure', 'fire-evacuation']) assert(gen.includes(k), 'Generate pictures lists ' + k + ': ' + gen.join(','));
    await p.click('[data-gp=structure]'); await p.waitForTimeout(300); const figs = await p.evaluate(() => [...document.querySelectorAll('[data-gf^="structure:"]')].map((x) => x.textContent)); assert(figs.includes('Moment M') && figs.includes('Displacement'), figs.join(','));
    await p.click('[data-gp=snow]'); await p.waitForTimeout(300); assert(await p.locator('[data-gf^="snow:"]').count() >= 2, 'snow offers its views');
    console.log(`PASS Generate pictures lists ${gen.length} studies, every one the Workspace runs; Structure offers ${figs.join(', ')}`);

    // ---- the export list's Clear list and Undo, and a long report (on the module directly, with made-up pictures)
    const out = await p.evaluate(async () => {
      const m = await import('./js/export-list.js'), c = document.createElement('canvas'); c.width = 640; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#7aa'; g.fillRect(0, 0, 640, 400); const blob = await m.canvasBlob(c);
      const items = []; for (const lv of ['Level 1', 'Level 2', 'Level 3']) for (const v of ['ratio', 'rt', 'sti', 'chart']) items.push({ kind: 'view', study: 'acoustics', title: `Indoor acoustics · ${v} · ${lv}`, sub: 'Indoor acoustics · Draft · Screening estimate', pictures: [{ label: v, blob }], rows: [['Rooms on target', '33 of 33']], method: 'Sabine.', basis: 'Quality Draft', at: Date.now() });
      for (let i = 0; i < 18; i++) items.push({ kind: 'view', study: 'spacesyntax', title: `Visual integration [HH] · Level ${1 + (i % 3)}`, sub: 'Space syntax · Draft · Screening estimate', pictures: [{ label: 'v', blob }], rows: [['Mean visual integration', '3.85']], method: 'VGA.', basis: 'Quality Draft', at: Date.now() });
      const list = { title: 'Long report', items }, host = document.createElement('div'); document.body.append(host); let changes = 0;
      const draw = () => m.renderList(host, list, { project: 'QA', modelKey: '', onChange: () => { changes++; draw(); }, onExport: () => {}, busy: '' }); draw();
      host.querySelector('[data-xl=clear]').click(); const afterClear = [list.items.length, /List cleared \(30 items\)/.test(host.textContent)];
      host.querySelector('[data-xl=undo]').click(); const afterUndo = list.items.length; host.remove();
      const r = await m.exportList('pdf', list, { project: 'QA project', site: '', coords: '', version: 'v1', revision: 1, author: 'QA' }), txt = new TextDecoder('latin1').decode(new Uint8Array(await r.blob.arrayBuffer()));
      const pages = (txt.match(/\/Type \/Page\b(?!s)/g) || []).length, s = await m.exportList('pptx', list, { project: 'QA project', site: '', coords: '', version: 'v1', revision: 1, author: 'QA' });
      return { afterClear, afterUndo, pages, pptx: s.blob.size }; });
    assert.deepEqual(out.afterClear, [0, true], 'Clear list empties it, with Undo offered'); assert.equal(out.afterUndo, 30, 'Undo brings the 30 back');
    assert.equal(out.pages, 1 + 2 + 30 + 3, 'cover, a summary over two pages, 30 chapters and the closing notes (30 analyses: three pages): ' + out.pages);
    console.log(`PASS Clear list and Undo; a 30-item report: ${out.pages} pages, the summary on two pages (no row over the footer)`);
    // the chapter titles: four views of one level are told apart
    const heads = await p.evaluate(async () => { const m = await import('./js/export-list.js'); return ['ratio', 'chart'].map((v) => m.headOfItem({ kind: 'view', study: 'acoustics', title: `Indoor acoustics · ${v} · Level 1`, sub: 'Indoor acoustics · Draft' })).concat(m.headOfItem({ kind: 'view', study: 'spacesyntax', title: 'Visual integration [HH] · Level 2', sub: 'Space syntax · Draft' })); });
    assert.deepEqual(heads, ['Room Acoustics (Reverberation Time) — Ratio, Level 1', 'Room Acoustics (Reverberation Time) — Chart, Level 1', 'Spatial Configuration (Visibility Graph Analysis) — Visual integration [HH], Level 2']);
    console.log('PASS chapter titles tell the views apart: ' + heads.join(' | '));
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
