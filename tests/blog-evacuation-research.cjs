// The research note "How accurate is the fire evacuation simulation?" (2026-11-10) on the blog: listed first, opens, its tables,
// references and links render, the image loads, and the downloadable data files are served.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => { const b = await chromium.launch({ args: ['--no-sandbox'] });
  try { const p = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
    await p.goto(base + '/mvp/#/blog'); await p.waitForSelector('#fire-evacuation-accuracy', { timeout: 30000 }); await p.goto(base + '/mvp/#/blog/fire-evacuation-accuracy'); await p.waitForSelector('#fire-evacuation-accuracy .article-table', { timeout: 30000 });
    const art = p.locator('#fire-evacuation-accuracy'); const txt = await art.innerText(); assert.match(txt, /How accurate is the fire evacuation simulation/);
    const tables = await art.locator('.article-table table').count(), refs = await art.locator('li', { hasText: 'Fire Technology' }).count();
    if (!tables) { await art.locator('a, button').filter({ hasText: /read|open|more/i }).first().click().catch(() => {}); await p.waitForTimeout(1500); }
    const body = await p.locator('body').innerText(); assert.match(body, /Verification \(RQ1\)/); assert.match(body, /Ronchi, E\., Reneke, P\. A\. and Peacock, R\. D\. \(2014\)/); assert.match(body, /18 tests pass|All 18 tests pass/);
    const nT = await p.locator('.article-table table').count(); assert(nT >= 7, 'the tables render: ' + nT);
    assert(await p.evaluate(() => { const im = document.querySelector('#fire-evacuation-accuracy img'); return !im || (im.complete && im.naturalWidth > 600); }), 'the image loads');
    for (const f of ['research/egress-verification.json', 'research/egress-hospital-case.json', 'research/fire-evacuation-accuracy.md']) { const r = await p.request.get(base + '/mvp/' + f); assert.equal(r.status(), 200, f); }
    await p.screenshot({ path: (process.env.SHOT_DIR || require('os').tmpdir()) + '/blog-evac.png', fullPage: false });
    console.log('PASS the research note on the blog:', nT, 'tables,', refs, 'list items citing Fire Technology'); assert.deepEqual(errs, []);
  } finally { await b.close(); } })().catch((e) => { console.error(e); process.exit(1); });
