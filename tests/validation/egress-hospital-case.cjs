// Case study for the research note: the PlotCloud example hospital (three storeys, 52 single patient rooms, two exit stairs, two
// smoke compartments per inpatient floor), run through the evacuation engine in the browser. Writes mvp/research/egress-hospital-case.json.
// Needs the local server (python3 -m http.server 8765) and network access (the project weather).
const { chromium } = require('playwright'), fs = require('node:fs');
(async () => { const b = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    await p.evaluate(async () => { const S = await import('./js/store.js'); S.reset(); S.account().user = { name: 'QA', email: 'qa@x.test' }; S.save(); });
    await p.goto(base + '/mvp/#/home'); await p.waitForSelector('[data-hospital]'); await p.click('.ph-thumb[data-hospital]');
    await p.waitForFunction(() => window.__ws2?.inst.persp.ready && window.__ws2?.inst.plan.ready, null, { timeout: 400000 }); await p.waitForTimeout(2500);
    const res = await p.evaluate(async () => { const EGX = await import('./js/interior/egress.js?case=' + Date.now()), bs = __ws2.inst.persp.ws.buildingScene(), m = (v) => Math.round(v / 6) / 10, out = { hospital: [], everyone: [] };
      for (const [name, o] of [['Day staffing 1:4', {}], ['Night staffing 1:8', { ratio: 8 }], ['Day, no preparation times', { prep: false }], ['Day, no incidents', { incidents: false }], ['Day, 0.25 m grid', { cell: 0.25 }]]) {
        const t0 = performance.now(), r = await EGX.run(bs, { strategy: 'down', runs: 50, seed: 1, ...o }), t1 = r.runs.map((x) => x.t1).filter(Number.isFinite).sort((a, c) => a - c);
        out.hospital.push({ name, runs: r.runs.length, patients: r.pop.pats.length, staff: r.pop.staff.length, p10: m(r.p10), p50: m(r.med), p90: m(r.p90), stage1P50: m(t1[Math.floor(t1.length / 2)]), unfinished: r.runs.reduce((s, x) => s + x.unfinished, 0), seconds: Math.round((performance.now() - t0) / 100) / 10 }); }
      for (const [name, o] of [['Clinic use, alarm 60 s', { use: 'retail', detect: 60 }], ['Clinic use, alarm 60 s, no incidents', { use: 'retail', detect: 60, incidents: false }], ['Clinic use, alarm 60 s, 0.25 m grid', { use: 'retail', detect: 60, cell: 0.25 }], ['Clinic use, alarm 3 min', { use: 'retail', detect: 180 }]]) {
        const t0 = performance.now(), r = await EGX.run(bs, { strategy: 'all', runs: 50, seed: 1, ...o }), inc = r.runs.map((x) => x.incidents.length);
        out.everyone.push({ name, runs: r.runs.length, people: r.rep.n, p10: m(r.p10), p50: m(r.med), p90: m(r.p90), incidentsPerRun: Math.round(10 * inc.reduce((s, v) => s + v, 0) / inc.length) / 10, blockedRuns: r.runs.filter((x) => x.blocked).length, unfinished: r.runs.reduce((s, x) => s + x.unfinished, 0), seconds: Math.round((performance.now() - t0) / 100) / 10 }); }
      return out; });
    res.generated = new Date().toISOString().slice(0, 10); res.model = 'PlotCloud example hospital (example-hospital-inpatient-v4)';
    fs.writeFileSync(__dirname + '/../../mvp/research/egress-hospital-case.json', JSON.stringify(res, null, 1)); console.log(JSON.stringify(res, null, 1));
  } finally { await b.close(); } })().catch((e) => { console.error(e); process.exit(1); });
