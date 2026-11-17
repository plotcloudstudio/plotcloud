// Simulations grouped by design question (2026-11-17), checked as a person would look for them. Every study is in the Building or
// Interior menu under its own name and its group, once. The search finds each study by its name and by common words, in English
// and Chinese ("comfort" and "热舒适" find Outdoor thermal comfort; "sDA" finds Daylight; "CCTV" finds Camera coverage). Enter
// opens the first match. A search with no match says so. The open study shows the other studies of its group, and one click on
// one opens it. Nothing is hidden: the names, the study ids and their saved results are unchanged.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = [], base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('[data-hospital]'); await p.click('.ph-thumb[data-hospital]');
    await p.waitForFunction(() => location.hash.startsWith('#/workspace') && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1000);
    const { GROUPS, ALIASES } = await p.evaluate(async () => { const G = await import('./js/study-groups.js'); return { GROUPS: G.GROUPS, ALIASES: G.ALIASES }; });
    const sims = await p.evaluate(async () => (await import('./js/data.js')).SIMS.map((x) => ({ id: x.id, name: x.name })));
    const shown = () => p.$$eval('.w2-simmenu .w2-simsec:not([hidden])', (ss) => ss.map((s) => [s.dataset.group, s.querySelector('.w2-simcat').textContent, [...s.querySelectorAll('[data-addsim]:not([hidden])')].map((b) => b.dataset.addsim)]));
    // the two menus, by group
    const menus = {};
    for (const [btn, scope] of [['#addSimBtn', 'building'], ['#addSimInt', 'interior']]) { await p.click(btn); await p.waitForSelector('.w2-simmenu:not([hidden])'); menus[scope] = await shown(); await p.locator('.w2-simmenu').screenshot({ path: (process.env.SHOT_DIR || require('os').tmpdir()) + `/sim-menu-${scope}.png` }); await p.keyboard.press('Escape'); await p.waitForTimeout(150); }
    for (const g of GROUPS) { const sec = menus[g.scope].find(([id]) => id === g.id); assert(sec, 'group shown: ' + g.label); assert.equal(sec[1], g.label); assert.deepEqual(sec[2], g.ids, g.label); }
    const listed = [...menus.building, ...menus.interior].flatMap(([, , ids]) => ids), want = sims.filter((s) => !['movementdepth', 'climate', 'passive'].includes(s.id)).map((s) => s.id);
    assert.deepEqual([...listed].sort(), [...want].sort(), 'every study once'); assert.equal(new Set(listed).size, listed.length);
    console.log(`PASS menus: Building ${menus.building.map(([, l, ids]) => `${l} (${ids.length})`).join(', ')} · Interior ${menus.interior.map(([, l, ids]) => `${l} (${ids.length})`).join(', ')}; all ${listed.length} studies once`);
    // search: by name, by each study's first two search words, by sample words people use
    await p.click('#addSimBtn'); await p.waitForSelector('.w2-simmenu:not([hidden])');
    const find = async (q) => { await p.fill('.w2-simmenu [data-simfind]', q); return (await shown()).flatMap(([, , ids]) => ids); };
    for (const s of want.map((id) => sims.find((x) => x.id === id))) { assert((await find(s.name)).includes(s.id), 'by name: ' + s.name);
      for (const w of ALIASES[s.id].split(' ').slice(0, 2)) assert((await find(w)).includes(s.id), `${s.name} by "${w}"`); }
    for (const [q, id] of [['comfort', 'utci'], ['热舒适', 'utci'], ['UTCI', 'utci'], ['sDA', 'daylight'], ['CCTV', 'cameras'], ['结构', 'structure'], ['rain', 'stormwater'], ['疏散', 'fire-evacuation'], ['reverberation', 'acoustics'], ['日照', 'sunhours']]) assert((await find(q)).includes(id), `"${q}" finds ${id}`);
    assert.deepEqual(await find('zzzz'), []); assert(await p.isVisible('.w2-simmenu .w2-simnone'), 'no match is said');
    console.log('PASS search: every study by its name and its words; comfort / 热舒适 / UTCI → Outdoor thermal comfort, sDA → Daylight, CCTV → Camera coverage, 结构 → Structure; "No simulation matches" otherwise');
    // Enter opens the first match: Outdoor thermal comfort from the Building menu, though it is typed, not browsed
    await find('舒适'); await p.locator('.w2-simmenu').screenshot({ path: (process.env.SHOT_DIR || require('os').tmpdir()) + '/sim-menu-search.png' });
    await find('热舒适'); await p.press('.w2-simmenu [data-simfind]', 'Enter');
    await p.waitForFunction(() => window.__wsStudy?.state().id === 'utci', null, { timeout: 60000 }); await p.waitForSelector('.sp-studycard .sp-sibs');
    const sibs = await p.$$eval('.sp-studycard .sp-sibs button', (bs) => bs.map((b) => [b.dataset.stSib, b.getAttribute('aria-current') || '']));
    assert.deepEqual(sibs, [['wind', ''], ['utci', 'true'], ['snow', '']]); assert.match(await p.locator('.sp-studycard .sp-sibs').innerText(), /Wind & outdoor comfort/i);
    await p.click('.sp-studycard [data-st-sib=snow]'); await p.waitForFunction(() => window.__wsStudy?.state().id === 'snow', null, { timeout: 60000 });
    console.log('PASS Enter opens Outdoor thermal comfort; its card shows Wind flow · Outdoor thermal comfort · Snow, and one click opens Snow');
    // a study alone in its group shows no row of others
    await p.evaluate(() => window.__wsStudy.open('structure')); await p.waitForTimeout(300); assert.equal(await p.locator('.sp-studycard .sp-sibs').count(), 0);
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
