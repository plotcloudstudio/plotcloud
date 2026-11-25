// Product review fixes (2026-11-24), a new empty project at 1440×900, a 9 × 6 m room drawn in Plan Studio with one window:
// 1 · Compare versions gives the drawn building's floor area and footprint (it read 0 m² when the building had no masses);
// 2 · Daylight on a level with no windows says so, instead of a silent 0 %;
// 3 · a Daylight result saved from the 2D plan keeps a picture for Compare versions;
// 4 · the minimised "Getting started" button no longer covers the result panel on the right.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [], out = process.env.SHOT_DIR || '/tmp';
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const id = await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('pc-mvp-ws2', JSON.stringify({ ws3: 1, view: 'plan' })); const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save();
      const q = S.createProject('QA review', { units: 'm', north: 0, layers: [], components: [] }); q.onboarding = { created: new Date().toISOString(), siteContext: false }; S.saveVersion(q, 'Empty'); S.save(); return q.id; });
    await p.goto(base + '/mvp/#/workspace/' + id);
    await p.waitForFunction(() => window.__ws2?.inst.plan.ready && window.__ws2?.inst.persp.ready, null, { timeout: 400000 }); await p.waitForTimeout(2500);
    const fr = p.frames().find((f) => f.url().includes('ws=plan'));
    const box = await p.locator('iframe[src*="ws=plan"]').boundingBox();
    const scr = async (q) => { const s2 = await fr.evaluate((q) => window.__ws.screenOf(q), q), c = await fr.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top]; }); return [box.x + s2[0] - c[0], box.y + s2[1] - c[1]]; };
    const room = async () => { await fr.evaluate(() => { window.__ws.camSet({ cx: 0, cy: 0, span: 30 }); window.__ws.tool({ tool: 'room' }); }); await p.waitForTimeout(400);
      const a = await scr([0, 0]), c = await scr([5, 3]); await p.mouse.move(...a); await p.mouse.down(); await p.mouse.move(...c, { steps: 6 }); await p.keyboard.type('9000,6000'); await p.keyboard.press('Enter'); await p.waitForTimeout(300); await p.mouse.up(); await p.waitForTimeout(1200); };
    // 4 · the Getting started button (minimised) and the right-hand panel
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(600);
    // a room with one window on level 1
    await room(); await fr.evaluate(() => window.__ws.tool({ tool: 'win' })); await p.mouse.click(...await scr([4.5, 0])); await p.waitForTimeout(800); await fr.evaluate(() => window.__ws.tool({ tool: 'select' })); await p.keyboard.press('Escape');
    const L1 = await fr.evaluate(() => ({ lv: window.__st.LV, rooms: window.__st.rooms().length, ops: window.__st.M.ops.length }));
    assert(L1.rooms >= 1 && L1.ops >= 1, 'a room and a window on level 1 ' + JSON.stringify(L1));
    // a level above with a room and no windows
    await p.click('button[aria-label="Add level above"], button[title="Add level above"]'); await p.waitForTimeout(2000); await room(); await fr.evaluate(() => window.__ws.tool({ tool: 'select' })); await p.waitForTimeout(1500);
    const L2 = await fr.evaluate(() => window.__st.LV); assert.notEqual(L2, L1.lv, 'on the new level');
    // 1 · Compare versions: floor area of the drawn building
    await p.click('button[aria-label="Versions"], button[title="Versions"]'); await p.waitForTimeout(1500);
    const rows = await p.evaluate(() => [...document.querySelectorAll('.sp-sk-row')].filter((r) => /(Gross floor area|Footprint) \(/.test(r.querySelector('.sp-sk-lab')?.innerText.trim() || ''))
      .map((r) => r.querySelector('.sp-sk-lab').innerText.trim().replace(/\s+/g, ' ') + ' = ' + (r.children[1]?.innerText.trim() || '?')));
    await p.screenshot({ path: out + '/review-compare.png' });
    const num = (s) => +((s || '').match(/= ([\d,.]+)\s*m²/) || [0, '0'])[1].replace(/,/g, '');
    const gfa = rows.find((r) => /Gross floor area/.test(r)), fp = rows.find((r) => /Footprint/.test(r));
    assert(gfa && fp, 'Compare versions rows: ' + JSON.stringify(rows));
    assert(num(gfa) > 90 && num(fp) > 45 && num(gfa) > num(fp), 'two drawn floors of about 54 m²: ' + JSON.stringify(rows));
    console.log(`PASS Compare versions reads the drawn floors: "${gfa}" · "${fp}"`);
    await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelector('.cmp-x, [aria-label="Close"]')?.click()); await p.waitForTimeout(600);
    // 2 · Daylight on the level with no windows
    const run = async () => { await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]')?.click()); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 600000 }); await p.waitForTimeout(1200); return p.evaluate(() => ({ err: window.__wsStudy.state().err, res: !!window.__wsStudy.state().res })); };
    await p.evaluate(() => window.__wsStudy.open('daylight')); await p.waitForTimeout(1000);
    const e2 = await run(); assert(!e2.res && /No windows on this level/.test(e2.err || ''), 'windowless level: ' + JSON.stringify(e2));
    console.log(`PASS Daylight on a level with no windows says "${e2.err.slice(0, 60)}…"`);
    // 3 · Daylight on level 1, saved from the 2D plan: the result has a picture
    await p.evaluate((lv) => { for (const k of ['plan', 'persp']) __ws2.inst[k].ws.level(lv); }, L1.lv); await p.waitForTimeout(1500);
    const e1 = await run(); assert(e1.res && !e1.err, 'level 1 daylight runs ' + JSON.stringify(e1));
    await p.evaluate(() => document.querySelector('.sp-studyres [data-st=save]')?.click()); await p.waitForTimeout(600);
    if (await p.evaluate(() => /Save as version v\d+\?/.test(document.querySelector('.sp-studyres')?.innerText || ''))) await p.evaluate(() => document.querySelector('.sp-studyres [data-st=save]')?.click());
    await p.waitForTimeout(2000);
    const saved = await p.evaluate(async (id) => { const S = await import('./js/store.js'); const r = (S.project(id).runs || []).filter((x) => x.simId === 'daylight').at(-1); return r ? { thumb: (r.results.thumb || '').slice(0, 23), len: (r.results.thumb || '').length } : null; }, id);
    assert(saved && /^data:image\/(jpeg|png)/.test(saved.thumb) && saved.len > 2000, 'the saved daylight result has a picture ' + JSON.stringify(saved));
    console.log(`PASS the Daylight result saved from the 2D plan has a picture (${Math.round(saved.len / 1024)} KB)`);
    // 4 · Getting started does not cover the result panel
    await p.screenshot({ path: out + '/review-panels.png' });
    const ov = await p.evaluate(() => { const m = document.querySelector('.pc-start-min'); if (!m || m.hidden || !m.getClientRects().length) return { shown: false }; const a = m.getBoundingClientRect(), hits = [...document.querySelectorAll('.sp-studyres, .sp-studycard')].filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect()).filter((r) => a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top); return { shown: true, box: [a.left, a.top, a.right, a.bottom].map(Math.round), hits: hits.length }; });
    assert(ov.shown, 'the minimised Getting started button is on screen'); assert.equal(ov.hits, 0, 'it does not overlap a result panel ' + JSON.stringify(ov));
    console.log(`PASS Getting started sits at ${JSON.stringify(ov.box)} and covers no result panel`);
    assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
