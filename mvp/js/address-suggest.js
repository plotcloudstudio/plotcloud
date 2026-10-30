// Type-ahead address suggestions for the new-project map. No single free service completes partial input well, so three are
// asked at once and merged: Photon (OpenStreetMap, prefix matching, biased to a point), Esri World Geocoding "suggest"
// (places, many countries, CJK) and Nominatim (complete addresses). A choice is resolved to coordinates only when picked.
// If the typed text starts with a house number and the chosen suggestion is a street without one, the number is looked up
// again on that street (Esri address points, then OpenStreetMap); when it is not found, the street location is used and the caller is told.
const ESRI = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
const jget = async (url, signal) => { const r = await fetch(url, { signal, headers: { Accept: 'application/json' } }); if (!r.ok) throw Error('HTTP ' + r.status); return r.json(); };
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9㐀-鿿]+/g, ' ').trim();

function photonRow(f) {
  const p = f.properties || {}, street = p.street || (p.type === 'street' ? p.name : ''), num = p.housenumber || '';
  const title = num && street ? `${street} ${num}` : p.name || street || p.city || p.country;
  const place = [num && street ? `${num} ${street}` : street && p.name !== street ? street : '', p.city || p.town || p.village || p.county, [p.state, p.postcode].filter(Boolean).join(' '), p.country].filter(Boolean).join(', ');
  const [lon, lat] = f.geometry?.coordinates || [];
  return { title, place: place || title, lat, lon, source: 'OpenStreetMap', parts: { country: p.country, region: p.state, city: p.city || p.town || p.village || p.county, street, number: num } };
}
export async function suggest(text, { near, signal } = {}) {
  const q = String(text || '').trim(); if (q.length < 3) return [];
  const bias = near && Number.isFinite(near.lat) ? near : null;
  const jobs = [
    jget(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6${bias ? `&lat=${bias.lat}&lon=${bias.lon}` : ''}`, signal).then((d) => (d.features || []).map(photonRow)).catch(() => []),
    jget(`${ESRI}/suggest?f=json&maxSuggestions=5&text=${encodeURIComponent(q)}${bias ? `&location=${bias.lon},${bias.lat}` : ''}`, signal).then((d) => (d.suggestions || []).map((s) => { const [a, ...b] = s.text.split(','); return { title: a.trim(), place: s.text, magicKey: s.magicKey, source: 'Esri' }; })).catch(() => []),
    jget(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=4&q=${encodeURIComponent(q)}`, signal).then((d) => d.map((r) => { const a = r.address || {}; const street = a.road || ''; return { title: a.house_number && street ? `${street} ${a.house_number}` : r.name || r.display_name.split(',')[0], place: r.display_name, lat: +r.lat, lon: +r.lon, source: 'OpenStreetMap', parts: { country: a.country, region: a.state || a.province, city: a.city || a.town || a.village || a.municipality, street, number: a.house_number || '' } }; })).catch(() => []),
  ];
  const [ph, es, no] = await Promise.all(jobs), seen = new Set(), out = [];
  const typedNum = (q.match(/^\s*(\d+[a-z]?)\b/i) || [])[1];
  // words typed (street abbreviations expanded); a suggestion whose title holds more of them ranks first, then nearness to
  // the bias point, then an exact house number, then source order
  const ABBR = { st: 'street', rd: 'road', ave: 'avenue', av: 'avenue', blvd: 'boulevard', dr: 'drive', hwy: 'highway', ln: 'lane', pl: 'place', cres: 'crescent', ct: 'court' };
  const words = norm(q).split(' ').filter((w) => w && !/^\d+[a-z]?$/.test(w)).map((w) => ABBR[w] || w);
  const textScore = (r) => { const t = norm(r.title).split(' ').map((w) => ABBR[w] || w), p = norm(r.place); return words.reduce((n, w) => n + (t.some((x) => x.startsWith(w)) ? 2 : p.includes(w) ? 1 : 0), 0) - (/\bat\b|\(nb\)|\(sb\)|\(eb\)|\(wb\)/i.test(r.title) ? 3 : 0); };
  const km = (r) => (bias && Number.isFinite(r.lat) ? Math.hypot((r.lat - bias.lat) * 111, (r.lon - bias.lon) * 111 * Math.cos(bias.lat * Math.PI / 180)) : null);
  const nearRank = (r) => { const d = km(r); return d === null ? 1 : d < 300 ? 0 : 2; }, num = (r) => (typedNum && (r.parts?.number === typedNum || new RegExp(`\\b${typedNum}\\b`).test(r.place)) ? 0 : 1);
  const all = [...no, ...ph, ...es].map((r, i) => ({ r, i, t: textScore(r) })).sort((a, b) => b.t - a.t || (bias ? nearRank(a.r) - nearRank(b.r) : 0) || num(a.r) - num(b.r) || a.i - b.i).map((x) => x.r);
  for (const r of all) { const k = norm(r.place).slice(0, 60); if (!k || seen.has(k)) continue; seen.add(k); out.push(r); if (out.length >= 6) break; }
  // typed "4371 fir st…" and the best match is the street without that number: check the number once, show it if it exists
  const top = out[0];
  if (typedNum && top?.parts?.street && !top.parts.number) { try { const r = await resolve(top, q); if (r.parts.number === typedNum) out.unshift({ ...r, title: `${r.parts.street} ${typedNum}` }); } catch { } }
  return out;
}
// Coordinates and address parts for a picked suggestion.
export async function resolve(row, typed = '') {
  let r = { ...row };
  if (r.magicKey) { const d = await jget(`${ESRI}/findAddressCandidates?f=json&outFields=City,Region,CntryName,AddNum,StName,StType&maxLocations=1&magicKey=${encodeURIComponent(r.magicKey)}&SingleLine=${encodeURIComponent(r.place)}`); const c = d.candidates?.[0]; if (!c) throw Error('That place could not be located. Try another suggestion.'); const a = c.attributes || {}; r = { ...r, lat: c.location.y, lon: c.location.x, parts: { country: a.CntryName, region: a.Region, city: a.City, street: [a.StName, a.StType].filter(Boolean).join(' '), number: a.AddNum || '' } }; }
  const typedNum = (String(typed).match(/^\s*(\d+[a-z]?)\b/i) || [])[1];
  if (typedNum && r.parts?.street && !r.parts.number) {   // the house number on that street, if it exists in OpenStreetMap
    const q = [`${typedNum} ${r.parts.street}`, r.parts.city, r.parts.region, r.parts.country].filter(Boolean).join(', ');
    try {
      const e = await jget(`${ESRI}/findAddressCandidates?f=json&maxLocations=3&outFields=Addr_type,AddNum,City,Region,CntryName&SingleLine=${encodeURIComponent(q)}`);
      const c = (e.candidates || []).find((x) => String(x.attributes?.AddNum || '').toLowerCase() === typedNum.toLowerCase() && x.score >= 90);
      let hit = c && { lat: c.location.y, lon: c.location.x, place: `${c.address}, ${c.attributes.CntryName || ''}`.replace(/, $/, ''), source: 'Esri' };
      if (!hit) { const d = await jget(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=3&q=${encodeURIComponent(q)}`); const h = d.find((x) => String(x.address?.house_number || '').toLowerCase() === typedNum.toLowerCase()); hit = h && { lat: +h.lat, lon: +h.lon, place: h.display_name, source: 'OpenStreetMap' }; }
      if (hit) r = { ...r, ...hit, title: `${r.parts.street} ${typedNum}`, parts: { ...r.parts, number: typedNum } };
      else r.note = `House number ${typedNum} was not found on ${r.parts.street}; the street location is used. Drag the pin to the exact spot.`;
    } catch { r.note = 'The house number could not be checked; drag the pin to the exact spot.'; }
  }
  if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon)) throw Error('That place has no coordinates.');
  return r;
}
// "Country, Region, City" as on the project-location card.
export const placeLine = (parts = {}) => [parts.country, parts.region, parts.city].filter(Boolean).join(', ');
