// The site of a new project, from open data, in the browser (no key, nothing invented):
//   OpenStreetMap   buildings (with heights where mapped), roads, water, green areas, trees
//                   Overpass first (three public servers in turn); the OpenStreetMap API itself as a last resort for small sites
//   AWS Terrain Tiles (Terrarium, zoom 15, about 4.8 m a pixel at the equator, 3.1 m at 49°; SRTM, NED and others)   the ground,
//                   read between pixel centres (bilinear, across tile edges too), so a sample is not snapped to the nearest pixel
// The data is turned into Plan Studio's site format by Plan Studio itself (window.__SITEC in emb/modeler.html).
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const D = Math.PI / 180;
export function bboxOf(lat, lon, r) { const dLat = r / 111320, dLon = r / (111320 * Math.cos(lat * D)); return [lat - dLat, lon - dLon, lat + dLat, lon + dLon]; }
async function timed(url, opt, ms) { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { return await fetch(url, { ...opt, signal: c.signal }); } finally { clearTimeout(t); } }

export async function fetchOSM(lat, lon, r, say = () => { }) {
  const [s, w, n, e] = bboxOf(lat, lon, r * 1.1), bb = `${s.toFixed(6)},${w.toFixed(6)},${n.toFixed(6)},${e.toFixed(6)}`, errs = [], at = new Date().toISOString();
  const q = `[out:json][timeout:40];(way["building"](${bb});relation["building"](${bb});way["building:part"](${bb});way["highway"](${bb});`
    + `way["natural"~"^(water|wood|scrub)$"](${bb});way["waterway"="riverbank"](${bb});way["leisure"~"^(park|garden|pitch)$"](${bb});`
    + `way["landuse"~"^(grass|forest|meadow|recreation_ground|village_green|cemetery|reservoir|basin)$"](${bb});node["natural"="tree"](${bb}););out geom;`;
  for (const url of OVERPASS) {
    const host = new URL(url).host;
    try { say(`Reading OpenStreetMap from ${host}…`); const res = await timed(url, { method: 'POST', body: new URLSearchParams({ data: q }) }, 45000);
      if (!res.ok) throw Error('HTTP ' + res.status); const text = await res.text(); if (!text.trim().startsWith('{')) throw Error('busy'); JSON.parse(text);
      return { text, provider: `OpenStreetMap via Overpass (${host})`, at }; }
    catch (er) { errs.push(`${host}: ${er.name === 'AbortError' ? 'timed out' : er.message}`); }
  }
  // the OpenStreetMap API serves small areas only (its usage policy); fine for one site of up to about 400 m
  if ((n - s) * (e - w) <= 0.25 && r <= 400) {
    try { say('Reading OpenStreetMap from api.openstreetmap.org…'); const res = await timed(`https://api.openstreetmap.org/api/0.6/map?bbox=${w.toFixed(6)},${s.toFixed(6)},${e.toFixed(6)},${n.toFixed(6)}`, {}, 60000);
      if (!res.ok) throw Error('HTTP ' + res.status); return { text: await res.text(), provider: 'OpenStreetMap API (api.openstreetmap.org)', at }; }
    catch (er) { errs.push(`api.openstreetmap.org: ${er.name === 'AbortError' ? 'timed out' : er.message}`); }
  }
  throw Error(`OpenStreetMap could not be reached (${errs.join('; ')}). Try again in a minute, or a smaller area.`);
}

// ---- terrain: Terrarium tiles decode to metres as (R × 256 + G + B / 256) − 32768
const tiles = new Map();
function tile(z, x, y) {
  const k = `${z}/${x}/${y}`; if (tiles.has(k)) return tiles.get(k);
  const p = new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); res(g.getImageData(0, 0, 256, 256).data); }; im.onerror = () => rej(Error('terrain tile ' + k)); im.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${k}.png`; });
  tiles.set(k, p); p.catch(() => tiles.delete(k)); return p;
}
// the height at a point given in tile units (zoom-level tile x, y as decimals): bilinear between the four nearest pixel centres;
// px(gx, gy) gives the height of a pixel by its whole-world pixel index, so tile edges are crossed without a seam
export function sampleAt(px, tx, ty) { const X = tx * 256 - 0.5, Y = ty * 256 - 0.5, i = Math.floor(X), j = Math.floor(Y), u = X - i, v = Y - j;
  return px(i, j) * (1 - u) * (1 - v) + px(i + 1, j) * u * (1 - v) + px(i, j + 1) * (1 - u) * v + px(i + 1, j + 1) * u * v; }
// the tiles sampleAt reads for a point
const tilesFor = (tx, ty) => { const X = tx * 256 - 0.5, Y = ty * 256 - 0.5, out = []; for (const gx of [Math.floor(X), Math.floor(X) + 1]) for (const gy of [Math.floor(Y), Math.floor(Y) + 1]) out.push(`${Math.floor(gx / 256)}/${Math.floor(gy / 256)}`); return out; };
// a grid of ground heights over a square of half-size r around the frame's origin, every `step` metres, heights relative to the origin
export async function fetchTerrain(F, r, step = 10) {
  const z = 15, N = 2 ** z, nx = Math.round(2 * r / step) + 1, ny = nx, x0 = -(nx - 1) * step / 2, y0 = x0, want = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const [lat, lon] = F.inv(x0 + i * step, y0 + j * step), tx = (lon + 180) / 360 * N, la = lat * D, ty = (1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * N; want.push([tx, ty]); }
  const need = [...new Set(want.flatMap(([tx, ty]) => tilesFor(tx, ty)))]; if (need.length > 81) throw Error('The area is too large for the terrain tiles.');
  const data = new Map(await Promise.all(need.map(async (k) => [k, await tile(z, ...k.split('/').map(Number))])));
  const px = (gx, gy) => { const tx = Math.floor(gx / 256), ty = Math.floor(gy / 256), d = data.get(`${tx}/${ty}`), o = ((gy - ty * 256) * 256 + (gx - tx * 256)) * 4; return d[o] * 256 + d[o + 1] + d[o + 2] / 256 - 32768; };
  const abs = want.map(([tx, ty]) => sampleAt(px, tx, ty)), c = (ny >> 1) * nx + (nx >> 1), e0 = abs[c];
  const zz = abs.map((v) => Math.round((v - e0) * 100) / 100), lo = Math.min(...zz), hi = Math.max(...zz);
  return { provider: 'AWS Terrain Tiles (Terrarium, zoom 15, bilinear; SRTM, NED and other public elevation data)', res: step, elev0: Math.round(e0 * 10) / 10, relief: Math.round((hi - lo) * 10) / 10, grid: { x0, y0, step, nx, ny, z: zz } };
}
// Is terrain available at a point? Reads the one zoom-12 Terrarium tile under it and returns the ground height there (m).
export async function terrainAt(lat, lon) {
  const z = 12, n = 2 ** z, tx = (lon + 180) / 360 * n, s = Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)), ty = (1 - s / Math.PI) / 2 * n;
  const d = await tile(z, Math.floor(tx), Math.floor(ty)), px = Math.min(255, Math.floor((tx % 1) * 256)), py = Math.min(255, Math.floor((ty % 1) * 256)), i = (py * 256 + px) * 4;
  return Math.round((d[i] * 256 + d[i + 1] + d[i + 2] / 256) - 32768);   // tile() resolves to the RGBA pixel array
}
