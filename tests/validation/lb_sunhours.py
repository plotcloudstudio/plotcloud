"""Sun hours and Sky view in PlotCloud (emb/modeler.html) against Ladybug (ladybug-core, the library behind the LB Grasshopper components).

1. Sun positions: PlotCloud's lbSun against ladybug.sunpath.Sunpath.calculate_sun_from_date_time, for 9 latitudes, 3
   longitudes, every 5th day of the year and every 5 minutes. Pass: the same to 1e-9 degrees.
2. Direct sun hours on the ground, the facades and the roofs: PlotCloud's sunGrid and surfaceHours (the code Sun hours runs) against LB Direct Sun Hours, step for step
   (ladybug_grasshopper/src/LB Direct Sun Hours.py). The test points are the cell centres moved 0.1 m along the ground's
   normal (_offset_dist_); on the facades and roofs a vector more than 90° from the normal counts 0 (geo_block_). The vectors are the Ladybug sun path's for the day at the timestep, kept while Sun.is_during_day.
   A ray is clear when it meets no triangle of the masses' meshes. The result is the clear count divided by the timestep.
   Rhino's MeshRay is not available here, so an exact ray-triangle test (Moller-Trumbore) stands in for it. The masses
   are placed off any grid line so that no ray grazes an edge. Pass: every point's hours are the same (to the 32-bit floats
   PlotCloud stores them in, about 1e-7 h; a single sun step is at least 1/12 h).
3. Sky view: PlotCloud's sky view on the same ground and squares against LB View Percent (Sky View) at resolution 1, 2 and 3.
   Pass: the same patches as view_sphere, and every point the same (ground to the 32-bit floats it is stored in).
Needs: a python with ladybug-core and ladybug-geometry (pip install ladybug-core); node with playwright; the site
served on 8765 (TEST_BASE to change it).
"""
import json, os, subprocess, sys, pathlib, math
import numpy as np
from ladybug.sunpath import Sunpath
from ladybug.dt import DateTime
from ladybug.analysisperiod import AnalysisPeriod
from ladybug_geometry.geometry3d import Point3D, Face3D, Polyface3D

ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).parent
fail = False

# ---- 1 · sun positions
cases = []
for lat in [-60, -33.9, -10, 0, 22.3, 35.7, 49.2448, 60, 70]:
    for lon in [-123.0071, 0.5, 139.7]:
        tz = round(lon / 15)
        for doy in range(1, 366, 5):
            for minute in range(0, 1440, 5):
                cases.append((lat, lon, tz, doy, minute))
js = r"""
const fs = require('fs'), src = fs.readFileSync(process.argv[1], 'utf8'), pre = ['LB_TIE', 'LB_MDAYS'].map((n) => src.match(new RegExp('const ' + n + ' = [^;]+;'))[0]).join('\n');
const f = require('./engine_fn.cjs')(process.argv[1], ['lbSun'], pre), cases = JSON.parse(fs.readFileSync(0, 'utf8')), out = [];
const MD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
for (const [lat, lon, tz, doy, minute] of cases) { let m = 0, d = doy; while (d > MD[m]) d -= MD[m++]; const s = f.lbSun(m + 1, d, minute, lat, lon, tz); out.push([s.alt, s.az]); }
process.stdout.write(JSON.stringify(out));"""
eng = json.loads(subprocess.run(['node', '-e', js, str(ROOT / 'emb/modeler.html')], input=json.dumps(cases), capture_output=True, text=True, cwd=HERE, check=True).stdout)
worst_alt = worst_az = 0.0
sps = {}
for (lat, lon, tz, doy, minute), (alt, az) in zip(cases, eng):
    sp = sps.get((lat, lon, tz)) or sps.setdefault((lat, lon, tz), Sunpath(lat, lon, tz))
    dt = DateTime.from_hoy((doy - 1) * 24 + minute / 60.0)
    dt = DateTime(dt.month, dt.day, minute // 60, minute % 60)
    s = sp.calculate_sun_from_date_time(dt)
    worst_alt = max(worst_alt, abs(s.altitude - alt))
    if s.altitude > -5:
        worst_az = max(worst_az, abs((s.azimuth - az + 540) % 360 - 180))
ok = worst_alt < 1e-9 and worst_az < 1e-9
fail |= not ok
print(json.dumps({'check': 'sun position', 'cases': len(cases), 'worst_altitude_deg': worst_alt, 'worst_azimuth_deg': worst_az, 'pass': ok}))

# ---- 2 · direct sun hours on the ground, the facades and the roofs
def inside(x, y, P):
    c = False; j = len(P) - 1
    for i in range(len(P)):
        if (P[i][1] > y) != (P[j][1] > y) and x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]: c = not c
        j = i
    return c


SCENES = [
    {'name': 'box and L, Vancouver, 21 March, 15 min', 'lat': 49.2448, 'lon': -123.0071, 'tz': -8, 'north': 0, 'day': '03-21', 'step': 15, 'h0': 0, 'h1': 24},
    {'name': 'box and L, Vancouver, 21 December, 5 min', 'lat': 49.2448, 'lon': -123.0071, 'tz': -8, 'north': 0, 'day': '12-21', 'step': 5, 'h0': 0, 'h1': 24},
    {'name': 'box and L, north 20 deg, 21 June, 1 h', 'lat': 49.2448, 'lon': -123.0071, 'tz': -8, 'north': 20, 'day': '06-21', 'step': 60, 'h0': 0, 'h1': 24},
    {'name': 'box and L, Sydney, 21 June, 10 min, 8:00-16:00', 'lat': -33.87, 'lon': 151.21, 'tz': 10, 'north': 0, 'day': '06-21', 'step': 10, 'h0': 8, 'h1': 16},
]
MASSES = [
    {'outer': [[-7.13, -4.37], [8.91, -4.37], [8.91, 5.29], [-7.13, 5.29]], 'h': 12.3},
    {'outer': [[13.17, 9.41], [27.83, 9.41], [27.83, 15.07], [19.29, 15.07], [19.29, 26.63], [13.17, 26.63]], 'h': 7.7},
]
def samples():   # squares on the facades (every 1.7 m along, 3 heights) and roofs, 0.1 m out along the normal (_offset_dist_)
    out = []
    for m in MASSES:
        P = m['outer']; area = sum(P[i][0] * P[(i + 1) % len(P)][1] - P[(i + 1) % len(P)][0] * P[i][1] for i in range(len(P)))
        for i in range(len(P)):
            a, b = P[i], P[(i + 1) % len(P)]; L = math.hypot(b[0] - a[0], b[1] - a[1]); d = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
            n = (d[1], -d[0]) if area > 0 else (-d[1], d[0])
            k = max(1, int(L / 1.7))
            for u in range(k):
                t = (u + 0.5) * L / k
                for z in (0.9, m['h'] / 2 + 0.13, m['h'] - 0.7):
                    out.append({'p': [a[0] + d[0] * t + n[0] * 0.1, a[1] + d[1] * t + n[1] * 0.1, z], 'n': [n[0], n[1], 0]})
        xs, ys = [q[0] for q in P], [q[1] for q in P]
        for fx in (0.23, 0.51, 0.77):
            for fy in (0.19, 0.48, 0.81):
                x, y = min(xs) + fx * (max(xs) - min(xs)), min(ys) + fy * (max(ys) - min(ys))
                if inside(x, y, P): out.append({'p': [x, y, m['h'] + 0.1], 'n': [0, 0, 1]})
    return out


BOX = {'X0': -30.0, 'Y0': -32.0, 'cell': 1.5, 'nx': 52, 'ny': 50}
SAMPLES = samples()
base = os.environ.get('TEST_BASE', 'http://127.0.0.1:8765')
runner = r"""
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--no-sandbox'] }); const p = await b.newPage();
  await p.goto(process.argv[1] + '/emb/modeler.html'); await p.waitForFunction(() => window.__sunp, null, { timeout: 60000 });
  const job = JSON.parse(require('fs').readFileSync(0, 'utf8'));
  const out = await p.evaluate((job) => job.scenes.map((sc) => { const Mx = { north: sc.north, site: { origin: { lat: sc.lat, lon: sc.lon }, tz: sc.tz, buildings: [], terrain: null, at: [0, 0] } };
    const g = window.__sunp.sunGrid(Mx, job.masses, { day: sc.day, step: sc.step, h0: sc.h0, h1: sc.h1, box: job.box }), d = window.__sunp.sunDirs({ lat: sc.lat, lon: sc.lon, tz: sc.tz }, sc.day, sc.north, sc.step, sc.h0, sc.h1);
    const S = window.__sunp.surfaceHours(job.samples, d, job.masses.map((m) => window.__sunp.prismOf(m.outer, m.h)), null);
    return { H: Array.from(g.H, (v) => (Number.isNaN(v) ? null : v)), minutes: d.map((x) => x.m), S }; }), job);
  process.stdout.write(JSON.stringify(out)); await b.close(); })().catch((e) => { console.error(e); process.exit(1); });"""
pc = json.loads(subprocess.run(['node', '-e', runner, base], input=json.dumps({'scenes': SCENES, 'masses': MASSES, 'box': BOX, 'samples': SAMPLES}), capture_output=True, text=True, cwd=ROOT, check=True).stdout)

# the masses as Ladybug meshes: each mass a closed Polyface3D (footprint offset up by its height), every face triangulated
tris = []
for m in MASSES:
    solid = Polyface3D.from_offset_face(Face3D([Point3D(x, y, 0) for x, y in m['outer']]), m['h'])
    for f in solid.faces:
        mesh = f.triangulated_mesh3d
        for fc in mesh.faces:
            tris.append([[mesh.vertices[i].x, mesh.vertices[i].y, mesh.vertices[i].z] for i in fc[:3]])
            if len(fc) == 4:
                tris.append([[mesh.vertices[i].x, mesh.vertices[i].y, mesh.vertices[i].z] for i in (fc[0], fc[2], fc[3])])
T = np.array(tris)
V0, E1, E2 = T[:, 0], T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]


def blocked(o, d):   # does the ray from o along d meet any triangle (t > 0)? Moller-Trumbore over all triangles at once
    p = np.cross(d, E2); det = np.einsum('ij,ij->i', E1, p); ok = np.abs(det) > 1e-12
    inv = np.where(ok, 1.0 / np.where(ok, det, 1), 0); s = o - V0; u = np.einsum('ij,ij->i', s, p) * inv
    q = np.cross(s, E1); v = (q @ d) * inv; t = np.einsum('ij,ij->i', E2, q) * inv
    return bool(np.any(ok & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 1e-9)))


for sc, res in zip(SCENES, pc):
    timestep = 60 // sc['step']
    sp = Sunpath(sc['lat'], sc['lon'], sc['tz'], north_angle=sc['north'])
    mm, dd = map(int, sc['day'].split('-'))
    end = 23 if sc['h1'] >= 24 else sc['h1']
    ap = AnalysisPeriod(mm, dd, sc['h0'], mm, dd, end, timestep)
    suns = [sp.calculate_sun_from_hoy(h) for h in ap.hoys]
    suns = [s for s in suns if s.is_during_day]                      # LB SunPath: vectors only while the sun is up
    lb_minutes = [s.datetime.hour * 60 + s.datetime.minute for s in suns]
    rev = [np.array([s.sun_vector_reversed.x, s.sun_vector_reversed.y, s.sun_vector_reversed.z]) for s in suns]
    worst, n, total_pc, total_lb, cells = 0.0, 0, 0.0, 0.0, 0
    for j in range(BOX['ny']):
        for i in range(BOX['nx']):
            x, y = BOX['X0'] + (i + 0.5) * BOX['cell'], BOX['Y0'] + (j + 0.5) * BOX['cell']
            v = res['H'][j * BOX['nx'] + i]
            if any(inside(x, y, m['outer']) for m in MASSES):
                if v is not None: worst = max(worst, 99)
                continue
            pt = np.array([x, y, 0.1])                                 # face centroid moved 0.1 m along the normal (0, 0, 1)
            lb = sum(0 if blocked(pt, d) else 1 for d in rev) / timestep  # LB: sum(int_list) / _timestep_
            worst = max(worst, abs(lb - v)); total_pc += v; total_lb += lb; cells += 1
    # the facades and roofs (geo_block_): a vector more than 90° from the normal counts 0, else the ray test
    fworst, fsum_pc, fsum_lb = 0.0, 0.0, 0.0
    for smp, v in zip(SAMPLES, res['S']):
        pt, nrm = np.array(smp['p']), np.array(smp['n'])
        lb = sum(0 if (np.dot(nrm, d) < 0 or blocked(pt, d)) else 1 for d in rev) / timestep
        fworst = max(fworst, abs(lb - v)); fsum_pc += v; fsum_lb += lb
    ok = worst < 1e-5 and fworst < 1e-9 and lb_minutes == res['minutes']   # PlotCloud keeps the hours as 32-bit floats (about 1e-7 h); one sun step is 1/12 h or more
    fail |= not ok
    print(json.dumps({'check': 'direct sun hours', 'scene': sc['name'], 'points': cells, 'sun_vectors': len(rev), 'same_instants': lb_minutes == res['minutes'],
                      'mean_hours_plotcloud': round(total_pc / cells, 4), 'mean_hours_ladybug': round(total_lb / cells, 4), 'worst_point_difference_h': worst,
                      'surface_squares': len(SAMPLES), 'mean_surface_hours_plotcloud': round(fsum_pc / len(SAMPLES), 4), 'mean_surface_hours_ladybug': round(fsum_lb / len(SAMPLES), 4), 'worst_surface_difference_h': fworst, 'pass': ok}))

# ---- 3 · sky view (LB View Percent, Sky View) at resolution 1, 2 and 3: Ladybug's dome patches (mvp/js/environment/lb-dome.js,
# written from view_sphere by gen_lb_dome.py, checked here against view_sphere itself); a clear patch within 90° of the normal
# counts 2·cos(angle)·weight, and the sum ·100 / the patch count
from ladybug.viewsphere import view_sphere
sky_runner = r"""
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--no-sandbox'] }); const p = await b.newPage();
  await p.goto(process.argv[1] + '/emb/modeler.html'); await p.waitForFunction(() => window.__sunp, null, { timeout: 60000 });
  const job = JSON.parse(require('fs').readFileSync(0, 'utf8'));
  const out = await p.evaluate(async (job) => { const { LB_DOME } = await import('/mvp/js/environment/lb-dome.js'), S = window.__sunp, r = {};
    const Mx = { north: 0, site: { origin: { lat: 49.2448, lon: -123.0071 }, tz: -8, buildings: [], terrain: null, at: [0, 0] } }, pr = job.masses.map((m) => S.prismOf(m.outer, m.h));
    for (const res of [1, 2, 3]) { const dome = LB_DOME[res], N = dome.length;
      const g = S.sunGrid(Mx, job.masses, { box: job.box, dirs: dome.map(([x, y, z, k]) => S.rayDir({ vec: [x, y, z], w: 2 * z * k * 100 / N }, 0)) });
      const sv = S.surfaceHours(job.samples, dome.map(([x, y, z, k]) => S.rayDir({ vec: [x, y, z], w: 2 * k * 100 / N }, 0)), pr, null, { cos: true });
      r[res] = { H: Array.from(g.H, (v) => (Number.isNaN(v) ? null : v)), S: sv, dome }; }
    return r; }, job);
  process.stdout.write(JSON.stringify(out)); await b.close(); })().catch((e) => { console.error(e); process.exit(1); });"""
sky = json.loads(subprocess.run(['node', '-e', sky_runner, base], input=json.dumps({'masses': MASSES, 'box': BOX, 'samples': SAMPLES}), capture_output=True, text=True, cwd=ROOT, check=True).stdout)
for res in (1, 2, 3):
    _, vecs = view_sphere.dome_patches(res); wts = view_sphere.dome_patch_weights(res); N = len(vecs)
    same_dome = all(abs(a[0] - v.x) + abs(a[1] - v.y) + abs(a[2] - v.z) + abs(a[3] - k) == 0 for a, v, k in zip(sky[str(res)]['dome'], vecs, wts)) and len(sky[str(res)]['dome']) == N
    V = [np.array([v.x, v.y, v.z]) for v in vecs]

    def lb_sky(pt, nrm):
        tot = 0.0
        for d, k in zip(V, wts):
            c = float(np.dot(nrm, d))
            if c < 0: continue                       # VectorAngle > 90°: 0
            if not blocked(pt, d): tot += 2 * c * k  # ival * 2 * cos(ang) * patch weight
        return tot * 100 / N
    res_pc = sky[str(res)]; gw = 0.0; cells = 0; mpc = mlb = 0.0
    for j in range(0, BOX['ny'], 3):
        for i in range(0, BOX['nx'], 3):
            x, y = BOX['X0'] + (i + 0.5) * BOX['cell'], BOX['Y0'] + (j + 0.5) * BOX['cell']
            if any(inside(x, y, m['outer']) for m in MASSES): continue
            v = res_pc['H'][j * BOX['nx'] + i]; lb = lb_sky(np.array([x, y, 0.1]), np.array([0.0, 0.0, 1.0]))
            gw = max(gw, abs(lb - v)); mpc += v; mlb += lb; cells += 1
    sw = 0.0; spc = slb = 0.0
    for smp, v in zip(SAMPLES, res_pc['S']):
        lb = lb_sky(np.array(smp['p']), np.array(smp['n'], dtype=float)); sw = max(sw, abs(lb - v)); spc += v; slb += lb
    ok = same_dome and gw < 1e-3 and sw < 1e-9
    fail |= not ok
    print(json.dumps({'check': 'sky view', 'resolution': res, 'patches': N, 'same_patches_as_view_sphere': same_dome, 'points': cells, 'mean_plotcloud': round(mpc / cells, 4), 'mean_ladybug': round(mlb / cells, 4),
                      'worst_point_difference_pct': gw, 'surface_squares': len(SAMPLES), 'mean_surface_plotcloud': round(spc / len(SAMPLES), 4), 'mean_surface_ladybug': round(slb / len(SAMPLES), 4), 'worst_surface_difference_pct': sw, 'pass': ok}))
sys.exit(1 if fail else 0)
