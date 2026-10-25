"""Shadows of the Sun hours engine (emb/sunhours.html) against exact ray-box geometry.
A wall 200 m long (east-west), 1 m thick, 10 m high stands on open ground at Vancouver (49.28 N). For every ground sample
the engine makes, the reference sums the time weights of the engine's own sun directions whose ray from the sample misses
the wall (slab test, exact). Sun positions are checked separately (sun_position.py), so this isolates the shadow geometry.
Two dates: equinox (Mar 20) and winter solstice (Dec 21). Pass: mean |difference| under 0.05 h and 99 % of samples within
one time step. Also reported: the hours against distance north of the wall, with the analytic profile-angle answer."""
import json, subprocess, sys, pathlib, numpy as np
HERE = pathlib.Path(__file__).parent
X0, X1, Y0, Y1, H = -100.0, 100.0, -0.5, 0.5, 10.0
scene = {'format': 'plotcloud-scene', 'v': 1, 'kind': 'masses', 'name': 'validation wall', 'loc': {'lat': 49.2827, 'lon': -123.1207, 'tz': -8, 'dst': 0},
         'north': 0, 'masses': [{'id': 'wall', 'role': 'proposed', 'base': 0, 'h': H, 'outer': [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]], 'holes': []}]}
def blocked(o, d):
    t0, t1 = 1e-6, np.inf
    for a, lo, hi in ((0, X0, X1), (1, Y0, Y1), (2, 0.0, H)):
        if abs(d[a]) < 1e-12:
            if o[a] < lo or o[a] > hi: return False
            continue
        ta, tb = (lo - o[a]) / d[a], (hi - o[a]) / d[a]
        t0, t1 = max(t0, min(ta, tb)), min(t1, max(ta, tb))
        if t0 > t1: return False
    return True
out, ok = {}, True
for day in ['03-20', '12-21']:
    e = json.loads(subprocess.run(['node', str(HERE / 'sun_shadow_engine.cjs'), json.dumps(scene), day], capture_output=True, text=True, check=True, cwd=HERE).stdout)
    dx, dy = e['modelMin'][0] - X0, e['modelMin'][1] - Y0      # the engine centres the model: its frame against the scene's
    suns, w = np.array(e['suns']), np.array(e['weights']); step = e['step'] / 60
    diffs, prof = [], {}
    for x, y, z, h in e['ground']:
        o = (x - dx, y - dy, z); ref = sum(wi for d, wi in zip(suns, w) if not blocked(o, d))
        diffs.append(h - ref)
        if abs(o[0]) < 20 and o[1] > Y1: prof.setdefault(round(o[1] - Y1), []).append((h, ref))
    diffs = np.abs(np.array(diffs)); m, within = float(diffs.mean()), float((diffs <= step + 1e-6).mean())
    p = m < 0.05 and within >= 0.99; ok &= p
    out[day] = dict(date=e['date'], samples=len(diffs), grid_m=e['grid'], step_min=e['step'], suns=len(suns), mean_abs_h=round(m, 4), max_abs_h=round(float(diffs.max()), 3),
                    within_one_step=round(within, 4), passed=bool(p), north_of_wall={str(k): dict(engine=round(float(np.mean([a for a, _ in v])), 2), reference=round(float(np.mean([b for _, b in v])), 2)) for k, v in sorted(prof.items()) if k in (1, 3, 5, 10, 15, 20, 30)})
json.dump(out, open(HERE / 'sun_shadow.result.json', 'w'), indent=1); print(json.dumps(out, indent=1)); sys.exit(0 if ok else 1)
