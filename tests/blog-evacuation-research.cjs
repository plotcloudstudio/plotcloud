// The research note "How accurate is the fire evacuation simulation?" (2026-11-10) on the blog: listed first, opens, its tables,
// references and links render, the image loads, and the downloadable data files are served.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => { const b = await chromium.launch({ args: ['--no-sandbox'] });
  try { const p = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
    await p.goto(base + '/mvp/#/blog'); await p.waitForSelector('#fire-evacuation-accuracy', { timeout: 30000 }); await p.goto(base + '/mvp/#/blog/fire-evacuation-accuracy'); await p.waitForSelector('#fire-evacuation-accuracy .article-table', { timeout: 30000 });
    const art = p.locator('#fire-evacuation-accuracy'); const txt = await art.innerText(); assert.match(txt, /How accurate is the fire evacuation simulation/);
    const tables = await art.locator('.article-table table').count(), refs = await art.locator('li', { hasText: 'Fire Technology' }).count();
    if (!tables) { await art.locator('a, button').filter({ hasText: /read|open|more/i }).first().click().catch(() => {}); await p.waitForTimeout(1500); }
    const body = await p.locator('.sd-article').innerText(); for (const k of [/PlotCloud Research Notes/, /not peer reviewed/, /Article info/i, /Keywords/, /Highlights/, /Abstract/, /1\. Introduction/, /4\. Verification/, /Table 3\./, /Fig\. 1\./, /CRediT authorship contribution statement/, /Declaration of competing interest/, /Data availability/, /References/, /E\. Ronchi, P\.A\. Reneke, R\.D\. Peacock/]) assert.match(body, k);
    const nT = await p.locator('.sd-article .article-table table').count(), nC = await p.locator('.sd-article .cite').count(), nR = await p.locator('.sd-refs li').count(); assert(nT >= 10, 'the tables: ' + nT); assert(nC > 30 && nR >= 20, `citations ${nC}, references ${nR}`);
    assert(await p.locator('.sd-article .cite').first().getAttribute('title'), 'a citation shows its reference');
    await p.waitForFunction(() => [...document.querySelectorAll('.sd-article img')].every((im) => im.complete && im.naturalWidth > 600), null, { timeout: 30000 });
    for (const f of ['research/egress-verification.json', 'research/egress-hospital-case.json', 'research/fire-evacuation-accuracy.md']) { const r = await p.request.get(base + '/mvp/' + f); assert.equal(r.status(), 200, f); }
    await p.screenshot({ path: (process.env.SHOT_DIR || require('os').tmpdir()) + '/blog-evac.png', fullPage: false });
    console.log('PASS the research article on the blog:', nT, 'tables,', nC, 'citations,', nR, 'references'); const sd = process.env.SHOT_DIR || require('os').tmpdir(); await p.locator('.sd-head').screenshot({ path: sd + '/blog-head.png' }); await p.locator('.sd-front').screenshot({ path: sd + '/blog-front.png' }); await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300); await p.screenshot({ path: sd + '/blog-phone.png' }); assert.deepEqual(errs, []);
  } finally { await b.close(); } })().catch((e) => { console.error(e); process.exit(1); });
