// Site data around the world (2026-10-25): the map flow's real data for several city centres, 150 m round each point: how many
// buildings, how many with a mapped height or floor count (the rest are estimated), roads, trees, and the terrain.
// Needs the network (OpenStreetMap, AWS Terrain Tiles) and the static server on 8765. Writes tests/site-cities.out.json.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const CITIES = [['Vancouver · Robson St', 49.2805, -123.1203], ['London · Soho', 51.5136, -0.1365], ['New York · Midtown', 40.7549, -73.9840], ['Tokyo · Shibuya', 35.6595, 139.7005],
  ['Sydney · CBD', -33.8688, 151.2093], ['Berlin · Mitte', 52.5200, 13.4050], ['São Paulo · Paulista', -23.5614, -46.6559], ['Nairobi · CBD', -1.2864, 36.8172]];
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); await p.goto((process.env.TEST_BASE || 'http://127.0.0.1:8765') + '/emb/modeler.html'); await p.waitForFunction(() => window.__SITEC, null, { timeout: 30000 });
  const out = [];
  for (const [name, lat, lon] of CITIES) {
    const r = await p.evaluate(async ([lat, lon]) => { const t0 = performance.now(), D = await import('/mvp/js/sitedata.js'), SC = window.__SITEC;
      try { const osm = await D.fetchOSM(lat, lon, 150), o = { lat, lon }, site = SC.siteFromOSM(osm.text, o, { kind: 'radius', r: 150 }, { provider: osm.provider }), B = site.buildings.filter((x) => !x.excluded && x.valid);
        let terr = null; try { terr = await D.fetchTerrain(SC.frame(o), 150, 10); site.terrain = terr; SC.groundFromOpen(site); } catch (e) { terr = { error: e.message }; }
        const n = (f) => B.filter(f).length, hs = B.filter((x) => x.h != null).map((x) => x.h);
        return { provider: osm.provider, buildings: B.length, height: n((x) => x.hSource === 'source'), levels: n((x) => x.hSource === 'levels'), none: n((x) => x.h == null), roads: site.roads.length, trees: site.trees.length, areas: site.areas.length,
          medianH: hs.length ? hs.sort((a, c) => a - c)[hs.length >> 1] : null, relief: terr && terr.relief, reliefRaw: terr && terr.reliefRaw, filled: terr && terr.filled, n: terr && terr.grid ? terr.grid.nx * terr.grid.ny : 0, elev: terr && terr.elev0, terrErr: terr && terr.error, s: Math.round((performance.now() - t0) / 100) / 10 }; }
      catch (e) { return { error: e.message }; } }, [lat, lon]);
    out.push({ name, lat, lon, ...r }); const pc = (k) => r.buildings ? Math.round(r[k] / r.buildings * 100) + ' %' : '—';
    console.log(`${name.padEnd(24)} ${r.error ? 'ERROR ' + r.error : `${String(r.buildings).padStart(4)} buildings · height ${pc('height')} · floors ${pc('levels')} · none ${pc('none')} · ${r.roads} roads · ${r.trees} trees · terrain ${r.reliefRaw ?? '—'} → ${r.relief ?? '—'} m relief, ${r.filled ?? 0}/${r.n} under buildings (${r.elev ?? '—'} m) · ${r.s} s · ${r.provider}`}`);
    await p.waitForTimeout(1500);   // the OpenStreetMap API asks for light use
  }
  fs.writeFileSync(path.join(__dirname, 'site-cities.out.json'), JSON.stringify(out, null, 1)); await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
