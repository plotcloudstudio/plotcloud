"""Daylight factor of the Daylight engine (emb/daylight.html) against Radiance (rtrace, CIE standard overcast sky from gensky)
and an independent numerical integral of the CIE overcast sky seen through the window.

Test room: 5 m wide, 6 m deep, 2.7 m high, one 3 m wide window, sill 0.9 m, head 2.1 m; work plane 0.8 m; points on the
centre line 0.5 to 5.5 m from the window. Checks at every point, tolerances fixed before running:
  sky through the glass (no reflections): within max(0.2 points, 10 %) of Radiance with a black room behind the same glass;
  daylight factor (glass tau 0.6, floor 0.2, walls 0.5, ceiling 0.8, ground 0.15): within max(0.5 points, 25 %) of Radiance;
  the two references (Radiance and the integral, open opening) agree within max(0.05 points, 3 %).
Two cases: an open view, and a building 10 m opposite, 8 m high.
Needs pyradiance (Radiance binaries), Playwright and the static server on 8765."""
import json, os, subprocess, sys, tempfile, pathlib, math, numpy as np, pyradiance
HERE = pathlib.Path(__file__).parent
BIN = pathlib.Path(pyradiance.__file__).parent / 'bin'
env = dict(os.environ, PATH=f"{BIN}:{os.environ['PATH']}", RAYPATH=str(pathlib.Path(pyradiance.__file__).parent / 'lib'))
R = dict(width=5.0, depth=6.0, ceil=2.7, win=[1.0, 4.0], sill=0.9, head=2.1, wp=0.8, tau=0.6, rf=0.2, rw=0.5, rc=0.8, ground=0.15)
pts = [[2.5, y] for y in [0.5, 1.5, 2.5, 3.5, 4.5, 5.5]]
R['points'] = pts

# ---- Radiance: window in the wall y = 0 looking to -y; room x 0..5, y 0..6, z 0..2.7
def poly(mat, name, P): return f"{mat} polygon {name}\n0\n0\n{3*len(P)} " + " ".join(f"{a:.4f} {b:.4f} {c:.4f}" for a, b, c in P) + "\n"
def scene(black, glass):
    W, D, H, (x0, x1), s, h = R['width'], R['depth'], R['ceil'], R['win'], R['sill'], R['head']
    rf, rw, rc = (0, 0, 0) if black else (R['rf'], R['rw'], R['rc'])
    t = R['tau'] / 1.0895 * 1.0  # Radiance glass: transmissivity tn from transmittance tau (normal incidence)
    tn = (math.sqrt(0.8402528435 + 0.0072522239 * R['tau'] ** 2) - 0.9166530661) / 0.0036261119 / R['tau'] if R['tau'] > 0 else 0
    s_ = f"void plastic floor 0 0 5 {rf} {rf} {rf} 0 0\nvoid plastic wallm 0 0 5 {rw} {rw} {rw} 0 0\nvoid plastic ceilm 0 0 5 {rc} {rc} {rc} 0 0\n"
    s_ += f"void plastic groundm 0 0 5 {0 if black else R['ground']} {0 if black else R['ground']} {0 if black else R['ground']} 0 0\n"
    if glass: s_ += f"void glass glazing 0 0 3 {tn:.4f} {tn:.4f} {tn:.4f}\n"
    s_ += poly('floor', 'fl', [(0, 0, 0), (W, 0, 0), (W, D, 0), (0, D, 0)]) + poly('ceilm', 'cl', [(0, 0, H), (0, D, H), (W, D, H), (W, 0, H)])
    s_ += poly('wallm', 'back', [(0, D, 0), (W, D, 0), (W, D, H), (0, D, H)]) + poly('wallm', 'left', [(0, 0, 0), (0, D, 0), (0, D, H), (0, 0, H)]) + poly('wallm', 'right', [(W, 0, 0), (W, 0, H), (W, D, H), (W, D, 0)])
    for i, P in enumerate([[(0, 0, 0), (x0, 0, 0), (x0, 0, H), (0, 0, H)], [(x1, 0, 0), (W, 0, 0), (W, 0, H), (x1, 0, H)], [(x0, 0, 0), (x1, 0, 0), (x1, 0, s), (x0, 0, s)], [(x0, 0, h), (x1, 0, h), (x1, 0, H), (x0, 0, H)]]):
        s_ += poly('wallm', f'front{i}', P)
    if glass: s_ += poly('glazing', 'pane', [(x0, 0, s), (x1, 0, s), (x1, 0, h), (x0, 0, h)])
    if R.get('opposite'):
        d, hh = R['opposite']['d'], R['opposite']['h']
        s_ += f"void plastic oppm 0 0 5 {0 if black else 0.15} {0 if black else 0.15} {0 if black else 0.15} 0 0\n" + poly('oppm', 'opp', [(-200, -d, 0), (-200, -d, hh), (200, -d, hh), (200, -d, 0)])
    s_ += poly('groundm', 'ground', [(-500, -500, -0.001), (500, -500, -0.001), (500, -0.01, -0.001), (-500, -0.01, -0.001)])  # ground outside, in front of the window
    return s_
def rad(black, glass):
    with tempfile.TemporaryDirectory() as d:
        sky = subprocess.run(['gensky', '3', '21', '12', '-c', '-B', '1'], capture_output=True, text=True, env=env, check=True).stdout
        # unit zenith radiance is enough: daylight factor is a ratio. Sky glow only; the ground's light comes from the ground plane.
        sky += "skyfunc glow skyglow 0 0 4 1 1 1 0\nskyglow source sky 0 0 4 0 0 1 180\n"
        open(f'{d}/s.rad', 'w').write(sky + scene(black, glass))
        oct_ = subprocess.run(['oconv', f'{d}/s.rad'], capture_output=True, env=env, check=True).stdout; open(f'{d}/s.oct', 'wb').write(oct_)
        rays = "".join(f"{x} {y} {R['wp']} 0 0 1\n" for x, y in pts) + "2.5 -400 0.5 0 0 1\n"   # last: unobstructed horizontal outside
        o = subprocess.run(['rtrace', '-h', '-I+', '-w', '-ab', '1' if black else '6', '-ad', '20000', '-as', '0', '-aa', '0', '-lw', '1e-5', '-dj', '0', f'{d}/s.oct'], input=rays, capture_output=True, text=True, env=env, check=True).stdout
        E = [179 * (0.265 * float(a) + 0.670 * float(b) + 0.065 * float(c)) for a, b, c in (l.split()[:3] for l in o.strip().splitlines())]
        return [100 * e / E[-1] for e in E[:-1]]

# ---- independent integral: CIE overcast L(theta) = Lz (1 + 2 sin theta) / 3, through the opening (sill..head, x0..x1) in y = 0
def sky_numeric(x, y, n=600):
    (x0, x1), zl, zh, Lz = R['win'], R['sill'] - R['wp'], R['head'] - R['wp'], 1.0
    if R.get('opposite'):   # the sky above the opposite roof only: what is seen through the opening above the line to its top
        pass
    xs = x0 + (np.arange(n) + 0.5) * (x1 - x0) / n - x; zs = zl + (np.arange(n) + 0.5) * (zh - zl) / n
    X, Z = np.meshgrid(xs, zs); r2 = X ** 2 + y ** 2 + Z ** 2; r = np.sqrt(r2); dA = (x1 - x0) / n * (zh - zl) / n
    L = Lz * (1 + 2 * Z / r) / 3
    if R.get('opposite'):   # a ray through the opening reaches the opposite wall unless it passes above its top
        d, hh = R['opposite']['d'], R['opposite']['h'] - R['wp']; L = np.where(Z / y * (y + d) > hh, L, 0.0)
    E = np.sum(L * (Z / r) * (y / r) * dA / r2)
    return 100 * E / (7 * math.pi / 9 * Lz)   # unobstructed horizontal illuminance under the CIE overcast sky is 7 pi Lz / 9
CASES = [('room, open view', {}), ('room, building 10 m opposite, 8 m high', {'opposite': {'d': 10.0, 'h': 8.0}})]
report, ok = [], True
base = dict(R)
for name, extra in CASES:
    R.clear(); R.update(base); R.update(extra)
    eng = json.loads(subprocess.run(['node', str(HERE / 'daylight_engine.cjs'), json.dumps(R)], capture_output=True, text=True, check=True, cwd=HERE).stdout)
    if isinstance(eng, dict): sys.exit(f'{name} · engine: ' + eng['error'])
    sc_rad, sg_rad, df_rad = rad(True, False), rad(True, True), rad(False, True)
    rows = []
    for i, (x, y) in enumerate(pts):
        e = eng[i]; ex, ey = e['x'], e['y']
        # 1 sky through the glass: the engine's direct sky part against Radiance with a black room behind the same glass
        tg_e, tg_r = e['sky'], sg_rad[i]; tol_g = max(0.2, 0.10 * tg_r); p_g = abs(tg_e - tg_r) <= tol_g
        # 2 daylight factor against Radiance with the room's reflectances and the ground
        tol_df = max(0.5, 0.25 * df_rad[i]); p_df = abs(e['df'] - df_rad[i]) <= tol_df
        # 3 the references agree with each other: Radiance against the integral, open opening, at the target point
        sc_num = sky_numeric(x, y); ref = abs(sc_rad[i] - sc_num) <= max(0.05, 0.03 * sc_num)
        ok &= p_g and p_df and ref
        rows.append(dict(depth=y, engine_point=[round(ex, 2), round(ey, 2)],
            sky_through_glass=dict(engine=round(tg_e, 3), radiance=round(tg_r, 3), error_pct=round(100 * (tg_e - tg_r) / tg_r, 1) if tg_r > 1e-3 else None, passed=bool(p_g)),
            df=dict(engine=round(e['df'], 3), radiance=round(df_rad[i], 3), error_points=round(e['df'] - df_rad[i], 3), error_pct=round(100 * (e['df'] - df_rad[i]) / df_rad[i], 1), passed=bool(p_df)),
            reflected=dict(engine=round(e['outside'] + e['inside'], 3), radiance=round(df_rad[i] - sg_rad[i], 3)),
            references=dict(radiance_open=round(sc_rad[i], 3), integral_open=round(sc_num, 3), agree=bool(ref))))
    report.append(dict(case=name, settings={k: v for k, v in R.items() if k != 'points'}, grid=dict(spacing=eng[0]['spacing'], bearings=eng[0]['bearings']), rows=rows))
out = dict(tolerances=dict(sky_through_glass='max(0.2 points, 10 %) against Radiance, black room, same glass', df='max(0.5 points, 25 %) against Radiance', references='Radiance and the integral within max(0.05 points, 3 %)'), cases=report, passed=bool(ok))
json.dump(out, open(HERE / 'daylight_df.result.json', 'w'), indent=1)
print(json.dumps(out, indent=1)); sys.exit(0 if ok else 1)
