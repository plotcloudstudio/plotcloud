"""Sun position of the Sun hours engine (emb/sunhours.html, sunPos) against NREL's Solar Position Algorithm (pvlib, spa_python).
Reference: Reda & Andreas (2004), NREL/TP-560-34302, stated uncertainty ±0.0003°. The engine uses the NOAA approximation.
Grid: 9 latitudes from -60 to 70, 3 longitudes, every 7th day of 2026, every hour the sun is up. Pass: max error under 0.1°
(Sun hours works in 15 minute steps, in which the sun moves about 3.75°)."""
import json, subprocess, sys, numpy as np, pandas as pd, pvlib, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
cases = []
for lat in [-60, -33.9, -10, 0, 22.3, 35.7, 49.3, 60, 70]:
    for lon in [-123.1, 0, 139.7]:
        tz = round(lon / 15)
        for doy in range(1, 366, 7):
            for h in np.arange(0.5, 24, 1.0):
                cases.append((lat, lon, tz, doy, float(h)))
js = r"""
const f = require('./engine_fn.cjs')(process.argv[1], ['julian0', 'sunPos'], 'const D2R = Math.PI / 180;');
const cases = JSON.parse(require('fs').readFileSync(0, 'utf8')), out = [];
for (const [lat, lon, tz, doy, h] of cases) { const d = new Date(Date.UTC(2026, 0, doy)); out.push(f.sunPos(2026, d.getUTCMonth() + 1, d.getUTCDate(), h, lat, lon, tz)); }
process.stdout.write(JSON.stringify(out));"""
eng = json.loads(subprocess.run(['node', '-e', js, str(ROOT / 'emb/sunhours.html')], input=json.dumps(cases), capture_output=True, text=True, cwd=pathlib.Path(__file__).parent, check=True).stdout)
# one SPA call per site, all its times at once; 'elevation' is the true (geometric) altitude, as the engine's
import collections
by = collections.defaultdict(list)
for i, (lat, lon, tz, doy, h) in enumerate(cases): by[(lat, lon, tz)].append(i)
alt_e, alt_r, az_e, az_r = [], [], [], []
for (lat, lon, tz), idx in by.items():
    times = pd.DatetimeIndex([pd.Timestamp('2026-01-01', tz='UTC') + pd.Timedelta(days=cases[i][3] - 1, hours=cases[i][4] - tz) for i in idx])
    r = pvlib.solarposition.spa_python(times, lat, lon, altitude=0, pressure=101325, temperature=12, delta_t=69.2)
    for k, i in enumerate(idx):
        a_ref = float(r['elevation'].iloc[k])
        if a_ref <= 0.5: continue
        alt_e.append(eng[i]['alt']); alt_r.append(a_ref); az_e.append(eng[i]['az']); az_r.append(float(r['azimuth'].iloc[k]))
alt_e, alt_r = np.array(alt_e), np.array(alt_r)
daz = (np.array(az_e) - np.array(az_r) + 180) % 360 - 180
# azimuth error matters as a direction on the sky: scale by cos(altitude)
daz_sky = daz * np.cos(np.radians(alt_r))
res = {'samples': int(len(alt_e)), 'altitude': {'mae': float(np.abs(alt_e - alt_r).mean()), 'max': float(np.abs(alt_e - alt_r).max()), 'bias': float((alt_e - alt_r).mean())},
       'azimuth_on_sky': {'mae': float(np.abs(daz_sky).mean()), 'max': float(np.abs(daz_sky).max())}, 'pass_max_deg': 0.1}
res['pass'] = res['altitude']['max'] < 0.1 and res['azimuth_on_sky']['max'] < 0.1
print(json.dumps(res, indent=1)); sys.exit(0 if res['pass'] else 1)
