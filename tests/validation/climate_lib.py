"""Climate library (emb/lib/climate.js) used by Solar radiation, Outdoor comfort (UTCI) and Wind comfort.
1. UTCI polynomial against pythermalcomfort.models.utci (same published polynomial, written separately), 6,000 random states.
2. Short-wave MRT of a standing person against pythermalcomfort.models.solar_gain (SolarCal, ASHRAE 55 Appendix C), averaged over
   the directions a person may face, as the engine assumes.
3. Yearly irradiation on unobstructed planes (horizontal, four vertical faces, 30° south tilt) against pvlib's Perez (1990) and
   isotropic transposition, for a synthetic year of clear and cloudy hours at Toronto. The engine uses the same Perez components
   but puts the dome and the horizon band into 145 sky patches and the sun into 3° groups; the check measures what that costs.
Pass: UTCI within 0.01 °C, MRT within 0.05 K, every plane within 2 % of pvlib's Perez."""
import json, subprocess, sys, pathlib, warnings, numpy as np, pandas as pd, pvlib
warnings.filterwarnings('ignore')
from pythermalcomfort.models import utci, solar_gain
ROOT = pathlib.Path(__file__).resolve().parents[2]
rng = np.random.default_rng(7)

def run_js(job):
    js = r"""
const f = require('./engine_fn.cjs')(process.argv[1], ['julian0', 'sunPos'], 'const D2R = Math.PI / 180;');
import(require('url').pathToFileURL(process.argv[2]).href).then((C) => {
  const job = JSON.parse(require('fs').readFileSync(0, 'utf8')), out = {};
  out.utci = job.utci.map(([ta, tr, va, rh]) => C.utci(ta, tr, va, rh));
  out.mrt = job.mrt.map(([ta, alt, dnr, dhr]) => C.mrtOutdoor({ ta, tsky: ta, svf: 1, sunlit: true, alt, dnr, dhr }));
  const R = job.rad, N = 8760, E = { tz: R.tz, DNR: Float32Array.from(R.dni), DHR: Float32Array.from(R.dhi), GHR: Float32Array.from(R.ghi) };
  const hours = C.hourSet('year'), sun = C.sunHours(E, hours, { lat: R.lat, lon: R.lon, sunPos: f.sunPos }), sky = C.skySum(E, hours, sun), G = C.sunGroups(E, hours, sun, 3).groups;
  out.planes = R.planes.map(([tilt, az]) => { const n = C.enu(90 - tilt, az);
    const grouped = C.irradiation(n, () => true, () => true, G, sky, 0.2) / 1000;
    let exact = 0; for (let i = 0; i < hours.length; i++) { if (!(sun.alt[i] > 0.5) || !(E.DNR[hours[i]] > 0)) continue; const s = C.enu(sun.alt[i], sun.az[i]), c = n[0] * s[0] + n[1] * s[1] + n[2] * s[2]; if (c > 0) exact += E.DNR[hours[i]] * c; }
    let beamG = 0; for (const g of G) { const c = n[0] * g.e[0] + n[1] * g.e[1] + n[2] * g.e[2]; if (c > 0) beamG += c; }
    return { total: grouped, beamExact: exact / 1000, beamGrouped: beamG / 1000 }; });
  out.groups = G.length; out.ghr = sky.ghr / 1000;
  process.stdout.write(JSON.stringify(out)); });"""
    r = subprocess.run(['node', '-e', js, str(ROOT / 'emb/sunhours.html'), str(ROOT / 'emb/lib/climate.js')], input=json.dumps(job), capture_output=True, text=True, cwd=pathlib.Path(__file__).parent)
    if r.returncode: sys.stderr.write(r.stderr); sys.exit(1)
    return json.loads(r.stdout)

# 1 · UTCI states inside the polynomial's range (vapour pressure up to 5 kPa)
U = []
while len(U) < 6000:
    ta, dtr, va, rh = rng.uniform(-45, 48), rng.uniform(-25, 65), rng.uniform(0.5, 16), rng.uniform(5, 100)
    if np.isfinite(float(utci(ta, ta + dtr, va, rh, limit_inputs=True).utci)): U.append([ta, ta + dtr, va, rh])
ref_u = np.array([float(utci(*u, limit_inputs=False, round_output=False).utci) for u in U])
# 2 · sunlit standing person, open sky (sky view 1), diffuse 0.2 × beam (as solar_gain), floor reflectance 0.2
M = [[float(rng.uniform(-10, 40)), float(rng.uniform(1, 89)), float(rng.uniform(50, 1000))] for _ in range(400)]
def mrt_ref(ta, alt, dnr):
    d = [float(solar_gain(sol_altitude=alt, sharp=s, sol_radiation_dir=dnr, sol_transmittance=1, f_svv=1, f_bes=1, asw=0.7, posture='standing', floor_reflectance=0.2).delta_mrt) for s in range(0, 181, 15)]
    w = np.ones(13); w[0] = w[-1] = 0.5
    return ta + float((np.array(d) * w).sum() / w.sum())
ref_m = np.array([mrt_ref(*m) for m in M])
# 3 · a synthetic year at Toronto: Ineichen clear sky, a cloud fraction that wanders day to day, overcast diffuse added
lat, lon, tz = 43.65, -79.38, -5
times = pd.date_range('2026-01-01 00:30', periods=8760, freq='h', tz=f'Etc/GMT+{-tz}')
loc = pvlib.location.Location(lat, lon, tz=f'Etc/GMT+{-tz}')
sp = loc.get_solarposition(times); cs = loc.get_clearsky(times, model='ineichen', solar_position=sp)
cloud = np.clip(np.repeat(rng.beta(1.2, 1.5, 365), 24) + rng.normal(0, 0.08, 8760), 0, 1)
up = sp['apparent_zenith'].values < 89.5
dni = np.where(up, cs['dni'].values * (1 - cloud) ** 1.5, 0); dhi = np.where(up, cs['dhi'].values * (1 - cloud) + cloud * 0.3 * cs['ghi'].values, 0)
ghi = dni * np.cos(np.radians(sp['zenith'].values)).clip(0) + dhi
planes = [[0, 180], [90, 180], [90, 90], [90, 270], [90, 0], [30, 180]]
job = {'utci': U, 'mrt': [[m[0], m[1], m[2], 0.2 * m[2]] for m in M], 'rad': {'lat': lat, 'lon': lon, 'tz': tz, 'dni': dni.tolist(), 'dhi': dhi.tolist(), 'ghi': ghi.tolist(), 'planes': planes}}
eng = run_js(job)
du = np.abs(np.array(eng['utci']) - ref_u); dm = np.abs(np.array(eng['mrt']) - ref_m)
dni_extra = pvlib.irradiance.get_extra_radiation(times); am = pvlib.atmosphere.get_relative_airmass(sp['apparent_zenith'])
rows = []
for (tilt, az), e in zip(planes, eng['planes']):
    ref = {}
    for model in ['perez', 'isotropic']:
        t = pvlib.irradiance.get_total_irradiance(tilt, az, sp['apparent_zenith'], sp['azimuth'], dni, ghi, dhi, dni_extra=dni_extra, airmass=am, albedo=0.2, model=model)
        ref[model] = float(np.nansum(t['poa_global'])) / 1000
    rows.append({'tilt': tilt, 'azimuth': az, 'engine_kwh': round(e['total'], 1), 'perez_kwh': round(ref['perez'], 1), 'isotropic_kwh': round(ref['isotropic'], 1),
                 'vs_perez_pct': round((e['total'] / ref['perez'] - 1) * 100, 2), 'vs_isotropic_pct': round((e['total'] / ref['isotropic'] - 1) * 100, 2),
                 'sun_grouping_pct': round((e['beamGrouped'] / e['beamExact'] - 1) * 100, 3) if e['beamExact'] else 0})
res = {'utci': {'states': len(U), 'max_abs_c': float(du.max()), 'mean_abs_c': float(du.mean())},
       'mrt_shortwave': {'states': len(M), 'max_abs_k': float(dm.max()), 'mean_abs_k': float(dm.mean())},
       'irradiation': {'site': 'Toronto (synthetic year)', 'sun_groups': eng['groups'], 'ghi_kwh': round(eng['ghr'], 1), 'planes': rows}}
res['pass'] = res['utci']['max_abs_c'] < 0.01 and res['mrt_shortwave']['max_abs_k'] < 0.05 and all(abs(r['vs_perez_pct']) < 2 for r in rows)
print(json.dumps(res, indent=1)); sys.exit(0 if res['pass'] else 1)
