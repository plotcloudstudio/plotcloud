// Worldwide site lookup for the account: address search and the site data every simulation reads.
// Sources (all free, no key, called from the browser):
//   Nominatim (OpenStreetMap)  address → coordinates            max 1 request a second
//   Open-Meteo elevation       ground elevation (Copernicus DEM)
//   Open-Meteo archive         last full year of daily ERA5 weather → rain, wind, temperature, time zone
//   Overpass (OpenStreetMap)   buildings mapped within the study radius
// Anything a source does not return stays empty and is reported as missing; nothing is filled in by guess.

let lastNom = 0;
export async function geocode(q) {
  const wait = lastNom + 1100 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); lastNom = Date.now();
  const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ q, format: 'jsonv2', limit: '6', 'accept-language': [...(navigator.languages || [navigator.language]), 'en'].filter(Boolean).join(',') });
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw Error('Address search is busy. Try again in a moment.');
  return (await r.json()).map((x) => ({ label: x.display_name, lat: +x.lat, lon: +x.lon }));
}

const SECT = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
async function json(url, opt) { const r = await fetch(url, opt); if (!r.ok) throw Error(r.status + ''); const j = await r.json(); if (j.error) throw Error(j.reason || 'error'); return j; }

export async function enrich(lat, lon, radius = 250) {
  const year = new Date().getFullYear() - 1, out = { year, status: {} };
  const tasks = {
    elev: json(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`).then((j) => { out.elev = Math.round(j.elevation[0]); }),
    climate: json('https://archive-api.open-meteo.com/v1/archive?' + new URLSearchParams({ latitude: lat, longitude: lon, start_date: `${year}-01-01`, end_date: `${year}-12-31`,
      daily: 'temperature_2m_mean,precipitation_sum,wind_speed_10m_mean,wind_direction_10m_dominant', timezone: 'auto' })).then((j) => {
      const d = j.daily, T = Array(12).fill(0), P = Array(12).fill(0), N = Array(12).fill(0), hist = Array(8).fill(0); let ws = 0, wn = 0;
      d.time.forEach((t, i) => { const m = +t.slice(5, 7) - 1; if (d.temperature_2m_mean[i] != null) { T[m] += d.temperature_2m_mean[i]; N[m]++; } if (d.precipitation_sum[i] != null) P[m] += d.precipitation_sum[i];
        if (d.wind_speed_10m_mean[i] != null) { ws += d.wind_speed_10m_mean[i]; wn++; } if (d.wind_direction_10m_dominant[i] != null) hist[Math.round(d.wind_direction_10m_dominant[i] / 45) % 8]++; });
      const Tm = T.map((v, i) => (N[i] ? v / N[i] : NaN));
      out.tz = j.timezone; out.rain = Math.round(P.reduce((a, b) => a + b, 0)); out.wind = wn ? +(ws / wn / 3.6).toFixed(1) : null;   // km/h → m/s
      out.windDir = SECT[hist.indexOf(Math.max(...hist))]; out.koppen = koppen(Tm, P, lat);
    }),
    buildings: json('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: `[out:json][timeout:25];way["building"](around:${radius},${lat},${lon});out count;` }) })
      .then((j) => { out.buildings = +(j.elements?.[0]?.tags?.ways ?? j.elements?.[0]?.tags?.total ?? NaN); if (!Number.isFinite(out.buildings)) throw Error('no count'); }),
  };
  const keys = Object.keys(tasks), res = await Promise.allSettled(Object.values(tasks));
  res.forEach((r, i) => { out.status[keys[i]] = r.status === 'fulfilled' ? 'ok' : 'missing'; });
  return out;
}

// Köppen–Geiger class from monthly mean temperature (°C) and precipitation (mm), after Peel et al. 2007.
export function koppen(T, P, lat) {
  if (T.some((v) => !Number.isFinite(v))) return null;
  const MAT = T.reduce((a, b) => a + b, 0) / 12, MAP = P.reduce((a, b) => a + b, 0), Th = Math.max(...T), Tc = Math.min(...T);
  const summer = lat >= 0 ? [3, 4, 5, 6, 7, 8] : [9, 10, 11, 0, 1, 2], winter = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((m) => !summer.includes(m));
  const Ps = summer.reduce((a, m) => a + P[m], 0), Pw = MAP - Ps, Psdry = Math.min(...summer.map((m) => P[m])), Pwdry = Math.min(...winter.map((m) => P[m]));
  const Pswet = Math.max(...summer.map((m) => P[m])), Pwwet = Math.max(...winter.map((m) => P[m])), Pdry = Math.min(...P);
  const Pth = 2 * MAT + (Pw >= 0.7 * MAP ? 0 : Ps >= 0.7 * MAP ? 28 : 14);
  const warm10 = T.filter((v) => v >= 10).length;
  let c;
  if (Th < 10) c = Th > 0 ? 'ET' : 'EF';
  else if (MAP < 10 * Pth) c = (MAP < 5 * Pth ? 'BW' : 'BS') + (MAT >= 18 ? 'h' : 'k');
  else if (Tc >= 18) c = Pdry >= 60 ? 'Af' : Pdry >= 100 - MAP / 25 ? 'Am' : 'Aw';
  else {
    const g = Tc > 0 ? 'C' : 'D', s = Psdry < 40 && Psdry < Pwwet / 3 ? 's' : Pwdry < Pswet / 10 ? 'w' : 'f';
    const t = Th >= 22 ? 'a' : warm10 >= 4 ? 'b' : g === 'D' && Tc < -38 ? 'd' : 'c';
    c = g + s + t;
  }
  return c + ' · ' + (KNAME[c] || KNAME[c.slice(0, 2)] || KNAME[c[0]]);
}
const KNAME = { Af: 'tropical rainforest', Am: 'tropical monsoon', Aw: 'tropical savanna', BWh: 'hot desert', BWk: 'cold desert', BSh: 'hot steppe', BSk: 'cold steppe',
  Csa: 'hot-summer Mediterranean', Csb: 'warm-summer Mediterranean', Csc: 'cold-summer Mediterranean', Cwa: 'monsoon humid subtropical', Cwb: 'subtropical highland', Cwc: 'cold subtropical highland',
  Cfa: 'humid subtropical', Cfb: 'temperate oceanic', Cfc: 'subpolar oceanic', Ds: 'dry-summer continental', Dw: 'dry-winter continental', Dfa: 'hot-summer humid continental', Dfb: 'warm-summer humid continental',
  Dfc: 'subarctic', Dfd: 'extremely cold subarctic', ET: 'tundra', EF: 'ice cap', C: 'temperate', D: 'continental' };

export const mapEmbed = (lat, lon, d = 0.004) => `https://www.openstreetmap.org/export/embed.html?bbox=${lon - d * 1.6},${lat - d},${lon + d * 1.6},${lat + d}&layer=mapnik&marker=${lat},${lon}`;
