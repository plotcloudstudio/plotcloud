// Motion, the remaining items (2026-11-15), on the Fallingwater case:
// · Solar radiation played month by month: each month its own sun patches and diffuse light on the same rays, so the months add up
//   to the whole period on every cell; the legend shows the month's own scale while a month is up, the result's after ■
// · Circulation through an assumed day at home (a small flat drawn beside the house): six times, each labelled as an assumed schedule, people walking, different walks at 07:00 and 12:00
// · the motion clip names its format before recording, and the file's extension follows its type (MP4 where the browser records it)
const { chromium } = require('playwright'), assert = require('node:assert/strict'), os = require('node:os');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 }, acceptDownloads: true }), errs = []; p.on('pageerror', (e) => errs.push(e.message)); const base = process.env.TEST_BASE || 'http://127.0.0.1:8765', out = process.env.SHOT_DIR || os.tmpdir();
    const run = async (id) => { await p.evaluate((i) => window.__wsStudy.open(i), id); await p.waitForTimeout(1000); await p.evaluate(() => document.querySelector('.sp-studycard [data-st=run]').click()); await p.waitForFunction(() => { const s = window.__wsStudy.state(); return !s.busy && (s.res || s.err); }, null, { timeout: 900000 }); const e = await p.evaluate(() => window.__wsStudy.state().err); assert.equal(e, '', id + ': ' + e); await p.waitForTimeout(800); };
    const bar = () => p.evaluate(() => { const s = document.querySelector('.sp-studycard [data-tl=seek]'); return s ? { n: +s.max + 1, i: +s.value, label: document.querySelector('.sp-studycard .sp-tll')?.textContent || '' } : null; });
    const seek = async (i) => { await p.evaluate((k) => { const s = document.querySelector('.sp-studycard [data-tl=seek]'); s.value = String(k); s.dispatchEvent(new Event('input', { bubbles: true })); }, i); await p.waitForTimeout(600); return bar(); };
    const labels = () => p.$$eval('.sp-legend .sp-lblabels span', (ss) => ss.map((x) => x.textContent));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const pid = await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); const m = await import('./js/fallingwater-dashboard.js'), q = m.openCase(); try { localStorage.setItem('pc-mvp-current', q.id); localStorage.setItem('pc-unfold', '1'); } catch { } return q.id; });
    await p.goto(base + '/mvp/#/workspace/' + pid); await p.waitForFunction(() => window.__wsStudy?.open && window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 240000 });
    await p.evaluate(() => document.querySelector('.pc-start .x')?.click()); await p.waitForTimeout(1500);
    // solar radiation by month
    await run('radiation'); let B = await bar(); assert(B && B.n === 12, 'twelve months ' + JSON.stringify(B));
    const chk = await p.evaluate(() => { const r = window.__wsStudy.state().res, T = r.timeline, ms = T.mons.map((mo) => T.monthVals(mo)); let worst = 0, n = 0; const sum = (a) => { let s = 0; for (const v of a) if (Number.isFinite(v)) s += v; return s; };
      for (let c = 0; c < r.vals.length; c++) { if (!Number.isFinite(r.vals[c])) continue; n++; const t = ms.reduce((a, m) => a + m[c], 0); worst = Math.max(worst, Math.abs(t - r.vals[c]) / Math.max(1, r.vals[c])); }
      return { worst, n, jul: sum(ms[T.mons.indexOf(6)]), dec: sum(ms[T.mons.indexOf(11)]), avg: r.avg, open: r.open, lo: r.lo, hi: r.hi }; });
    assert(chk.n > 100 && chk.worst < 0.005, 'the months add up to the year: ' + JSON.stringify(chk)); assert(chk.jul > chk.dec * 1.5, 'July sunnier than December: ' + JSON.stringify(chk));
    const annual = await labels(); B = await seek(6); assert.match(B.label, /^July · kWh\/m² in the month, on the ground/); const sJul = await p.evaluate(() => __ws2.inst.persp.ws.motionState().ovSum);
    const monthL = await labels(); assert.equal(monthL.at(-1), '0'); assert.notDeepEqual(monthL, annual, 'the legend shows the month scale'); assert.match(await p.locator('.sp-legend > b').innerText(), /in the month/);
    B = await seek(11); assert.match(B.label, /^December/); const sDec = await p.evaluate(() => __ws2.inst.persp.ws.motionState().ovSum); assert(sJul > sDec, `the ground recoloured: July ${sJul} > December ${sDec}`);
    await p.screenshot({ path: `${out}/m5-radiation-dec.png` }); await seek(6); await p.screenshot({ path: `${out}/m5-radiation-jul.png` });
    await p.evaluate(() => document.querySelector('.sp-studycard [data-tl=reset]').click()); await p.waitForTimeout(500); assert.deepEqual(await labels(), annual, 'the result’s scale back after ■');
    console.log('PASS radiation by month: 12 frames, months add up (worst', (chk.worst * 100).toFixed(3) + '%), July', chk.jul.toFixed(0), '> December', chk.dec.toFixed(0), '· annual avg', chk.avg.toFixed(1), 'open', chk.open.toFixed(1));
    // circulation through an assumed day at home: a small flat (bedroom, bathroom, study, living, kitchen) drawn 80 m east of the house
    await p.evaluate(() => { const ws = __ws2.inst.plan.ws, M = JSON.parse(ws.model()), c = M.site?.at || [0, 0], lv = M.levels[0].id, X = c[0] + 80, Y = c[1] - 6, id = (k) => k + Math.random().toString(36).slice(2, 8);
      const W = (a, b2) => { const w = { id: id('w'), lv, a: [X + a[0], Y + a[1]], b: [X + b2[0], Y + b2[1]], t: 0.2, h: 3 }; M.walls.push(w); return w; }, D = (w, pos) => M.ops.push({ id: id('o'), wall: w.id, pos, w: 0.9, kind: 'door', object_type: 'door', sill: 0, head: 2.1, open: 1 });
      W([0, 0], [18, 0]); W([18, 0], [18, 12]); W([18, 12], [0, 12]); const ent = W([0, 12], [0, 0]); const c1 = W([0, 5], [18, 5]), c2 = W([0, 7], [18, 7]); W([6, 0], [6, 5]); W([12, 0], [12, 5]); W([9, 7], [9, 12]);
      D(c1, 3); D(c1, 9); D(c1, 15); D(c2, 4); D(c2, 14); D(ent, 6);
      M.names = [...(M.names || []), { lv, x: X + 3, y: Y + 2.5, name: 'Bedroom' }, { lv, x: X + 9, y: Y + 2.5, name: 'Bathroom' }, { lv, x: X + 15, y: Y + 2.5, name: 'Study' }, { lv, x: X + 4.5, y: Y + 9.5, name: 'Living' }, { lv, x: X + 13.5, y: Y + 9.5, name: 'Kitchen' }, { lv, x: X + 9, y: Y + 6, name: 'Corridor' }];
      const snap = JSON.stringify(M); ws.apply(snap, false); __ws2.hub.change('plan', snap, false); for (const k of ['plan', 'persp']) __ws2.inst[k].ws.level(lv); }); await p.waitForTimeout(3000);
    await run('evac'); B = await bar(); assert(B && B.n === 6, 'six times ' + JSON.stringify(B));
    const L0 = (await seek(0)).label; assert.match(L0, /^07:00 · morning.* · an assumed home daily schedule by room type, not measured$/, L0); await p.waitForTimeout(1200);
    const mv = await p.evaluate(() => __ws2.inst.persp.ws.motionState()); assert(mv.people, 'people walking ' + JSON.stringify(mv));
    const w0 = await p.evaluate(() => window.__wsStudy.state().res.timeline.frames[0].sub.map((x) => x.k).join(','));
    const L2 = (await seek(2)).label; assert.match(L2, /^12:00 · midday.*not measured$/, L2); const w2 = await p.evaluate(() => window.__wsStudy.state().res.timeline.frames[2].sub.map((x) => x.k).join(','));
    assert.notEqual(w0, w2, 'different walks at 07:00 and 12:00'); await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/m5-circ-noon.png` });
    const all = []; for (let i = 0; i < 6; i++) all.push((await seek(i)).label.split(' · ').slice(0, 2).join(' · ')); console.log('PASS circulation day:', JSON.stringify(all));
    console.log('  07:00', L0); console.log('  12:00', L2);
    await p.evaluate(() => document.querySelector('.sp-studycard [data-tl=reset]').click()); await p.waitForTimeout(500);
    // the motion clip: its format named, the extension following the type
    await p.evaluate(() => document.querySelector('.sp-studycard [data-st=expopen]').click()); await p.waitForTimeout(400);
    const fmtL = await p.locator('.sp-studycard .sp-flabel', { hasText: 'Motion clip' }).innerText(); const expect = await p.evaluate(() => (['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4'].some((m) => MediaRecorder.isTypeSupported(m)) ? 'MP4' : 'WebM'));
    assert.match(fmtL, new RegExp(`Motion clip \\(8 s loop, ${expect}\\)`), fmtL); if (expect === 'WebM') assert(await p.locator('.sp-clipfmt').isVisible(), 'the WebM note');
    const [d] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.click('.sp-studycard [data-st=vid][data-v="1:1"]')]); const lc = await p.evaluate(() => window.__wsStudy.state().lastClip || null);
    const fn = d.suggestedFilename(); assert.match(fn, expect === 'MP4' ? /\.mp4$/ : /\.webm$/, fn); console.log('PASS the clip:', fmtL, '→', fn, lc ? lc.type : '');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
