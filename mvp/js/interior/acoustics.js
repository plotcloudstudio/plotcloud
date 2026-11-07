// Indoor acoustics in the Workspace (2026-11-06): the physics of the Indoor acoustics study page (emb/roomacoustics.html), the
// same functions as they ship there: each room's reverberation time in six octave bands from its volume and the absorption of
// every surface (the finishes set in Plan Studio), furniture, people and the air; the DIN 18041 target for the room's use; and a
// speech clarity estimate from reverberation alone. run(scene, opt) takes Plan Studio's 'acoustics' scene of one level.
export const BANDS = [125, 250, 500, 1000, 2000, 4000], BN = ['125', '250', '500', '1k', '2k', '4k'];
// the finishes, as in Plan Studio (a scene from Plan Studio brings its own copy, which wins)
export const MATS0 = {
  plaster: { n: 'Plaster on masonry, painted', a: [0.01, 0.02, 0.02, 0.03, 0.04, 0.05] }, gypsum: { n: 'Gypsum board on studs', a: [0.29, 0.10, 0.05, 0.04, 0.07, 0.09] },
  concrete: { n: 'Concrete, painted', a: [0.01, 0.01, 0.02, 0.02, 0.02, 0.02] }, brick: { n: 'Brick, bare', a: [0.03, 0.03, 0.03, 0.04, 0.05, 0.07] },
  timberpanel: { n: 'Timber panelling', a: [0.42, 0.21, 0.10, 0.08, 0.06, 0.06] }, absorber: { n: 'Acoustic panel, 50 mm mineral wool', a: [0.20, 0.55, 0.95, 1.00, 0.95, 0.90] },
  tileceiling: { n: 'Suspended mineral-fibre ceiling', a: [0.50, 0.55, 0.65, 0.80, 0.85, 0.80] }, curtain: { n: 'Heavy curtain, draped', a: [0.07, 0.31, 0.49, 0.75, 0.70, 0.60] },
  timberfloor: { n: 'Timber floor on joists', a: [0.15, 0.11, 0.10, 0.07, 0.06, 0.07] }, parquet: { n: 'Parquet on concrete', a: [0.04, 0.04, 0.07, 0.06, 0.06, 0.07] },
  vinyl: { n: 'Vinyl or linoleum on concrete', a: [0.02, 0.03, 0.03, 0.03, 0.03, 0.02] }, carpet: { n: 'Carpet on concrete', a: [0.02, 0.06, 0.14, 0.37, 0.60, 0.65] },
  tile: { n: 'Ceramic tile', a: [0.01, 0.01, 0.01, 0.02, 0.02, 0.02] } };
export const GLAZ0 = { single: { n: 'Single glazing', a: [0.18, 0.06, 0.04, 0.03, 0.02, 0.02] }, double: { n: 'Double glazing', a: [0.10, 0.07, 0.05, 0.03, 0.02, 0.02] }, lowe: { n: 'Double glazing, low-e', a: [0.10, 0.07, 0.05, 0.03, 0.02, 0.02] }, triple: { n: 'Triple glazing', a: [0.08, 0.05, 0.04, 0.03, 0.02, 0.02] } };
export const DEF0 = { wall: 'plaster', floor: 'timberfloor', ceiling: 'plaster', glazing: 'double' };
const DOOR = { n: 'Door, timber, closed', a: [0.14, 0.10, 0.06, 0.08, 0.10, 0.10] }, OPENING = { n: 'Opening to the next space', a: [1, 1, 1, 1, 1, 1] };
// equivalent absorption area of a piece of furniture or a person (m², per band): typical values for early design
const FURN_A = [[/sofa|couch|settee/i, 'Upholstered sofa', [0.40, 0.70, 0.95, 1.10, 1.15, 1.15]], [/armchair|lounge chair|recliner/i, 'Armchair', [0.15, 0.25, 0.35, 0.40, 0.40, 0.40]],
  [/bed\b|bed[_ ]|mattress|bunk|crib/i, 'Bed with bedding', [0.30, 0.55, 0.80, 0.90, 0.90, 0.90]], [/office chair|desk chair|task chair/i, 'Upholstered chair', [0.05, 0.10, 0.15, 0.20, 0.20, 0.20]],
  [/book|shelf|shelves/i, 'Filled bookshelf', [0.10, 0.15, 0.20, 0.25, 0.25, 0.25]], [/rug|carpet/i, 'Rug', [0.02, 0.08, 0.20, 0.40, 0.55, 0.60]]];
const HARD_A = [0.03, 0.03, 0.04, 0.04, 0.05, 0.05], PERSON_A = [0.15, 0.25, 0.35, 0.42, 0.45, 0.45];
const STI_W = [0.13, 0.14, 0.11, 0.12, 0.19, 0.17, 0.14];   // octave weights 125 Hz–8 kHz (Houtgast & Steeneken), 8 kHz taken as 4 kHz here
export const TARGET_SHORT = { A1: 'Music', A2: 'Talks', A3: 'Teaching', A4: 'Inclusive', home: 'Home, office', none: 'None' };
export const TARGET_NAME = { A1: 'Music (DIN 18041 A1)', A2: 'Talks (DIN 18041 A2)', A3: 'Teaching, meetings (DIN 18041 A3)', A4: 'Inclusive teaching (DIN 18041 A4)', home: 'Home and office (rule of thumb)', none: 'No target (circulation, storage)' };

// ---- the physics: pure functions (tests/validation/room_acoustics.cjs pulls them out of this page)
// the sound power attenuation of air (1/m) at frequency f, temperature tC (°C), relative humidity rh (%), sea-level pressure: ISO 9613-1:1993 eqs. 3–5
export function airM(f, tC, rh) {
  const T = tC + 273.15, T0 = 293.15, T01 = 273.16, pr = 1, pa = 1, C = -6.8346 * Math.pow(T01 / T, 1.261) + 4.6151, h = rh * Math.pow(10, C) / pa;
  const frO = pa / pr * (24 + 4.04e4 * h * (0.02 + h) / (0.391 + h)), frN = pa / pr * Math.pow(T / T0, -0.5) * (9 + 280 * h * Math.exp(-4.170 * (Math.pow(T / T0, -1 / 3) - 1)));
  const aDBm = 8.686 * f * f * (1.84e-11 * (pr / pa) * Math.sqrt(T / T0) + Math.pow(T / T0, -2.5) * (0.01275 * Math.exp(-2239.1 / T) / (frO + f * f / frO) + 0.1068 * Math.exp(-3352.0 / T) / (frN + f * f / frN)));
  return aDBm / (10 * Math.LOG10E);   // dB/m → 1/m (power)
}
// one room: { vol, surf: [{ area, a: [6] }], extra: [6] (furniture and people, m²) } → per band: A (m²), Sabine and Eyring T (s)
export function roomRT(room, air, tC) {
  const c = 331.3 * Math.sqrt(1 + tC / 273.15), K = 24 * Math.LN10 / c, S = room.surf.reduce((s, q) => s + q.area, 0), out = [];
  for (let b = 0; b < 6; b++) { const As = room.surf.reduce((s, q) => s + q.area * q.a[b], 0), Ax = room.extra ? room.extra[b] : 0, m4V = 4 * air[b] * room.vol, A = As + Ax;
    const ab = Math.min(0.99, A / S); out.push({ A, As, Ax, Aair: m4V, sabine: K * room.vol / (A + m4V), eyring: K * room.vol / (-S * Math.log(1 - ab) + m4V), abar: ab }); }
  return out;
}
// DIN 18041:2016 target reverberation time (occupied, mean of 500 Hz and 1 kHz) for a room group and volume; null outside its range
export function dinTarget(group, V) {
  const L = Math.log10(V); if (group === 'A1') return V >= 30 && V <= 1000 ? 0.45 * L + 0.07 : null; if (group === 'A2') return V >= 50 && V <= 5000 ? 0.37 * L - 0.14 : null;
  if (group === 'A3') return V >= 30 && V <= 5000 ? 0.32 * L - 0.17 : null; if (group === 'A4') return V >= 30 && V <= 500 ? 0.26 * L - 0.14 : null; if (group === 'home') return 0.5; return null;
}
// speech transmission index from reverberation alone (diffuse field, no noise, no direct sound): IEC 60268-16 modulation transfer, octaves 125 Hz–8 kHz
export function stiRev(T6) {
  const F = [0.63, 0.8, 1, 1.25, 1.6, 2, 2.5, 3.15, 4, 5, 6.3, 8, 10, 12.5], T = T6.concat([T6[5]]);
  let sti = 0; T.forEach((t, k) => { let ti = 0; for (const f of F) { const m = 1 / Math.sqrt(1 + Math.pow(2 * Math.PI * f * t / 13.8, 2)), snr = Math.max(-15, Math.min(15, 10 * Math.log10(m / (1 - m)))); ti += (snr + 15) / 30; } sti += STI_W[k] * ti / F.length; });
  return sti;
}


// a room's use, from its name unless the person chose one for every room or for this room
const SKIP = /corridor|hallway|passage|circulation|landing|stair|lobby|走廊|楼梯/i;
export function groupOf(r, o) { if (o.own && o.own[r.name]) return o.own[r.name]; if (o.target && o.target !== 'auto') return o.target;
  if (SKIP.test(r.name) || /store|storage|utility|wc|toilet|bath|shower|laundry|plant|garage|closet|储|厕|卫/i.test(r.name)) return 'none';
  if (/class|lecture|seminar|meeting|conference|training|教室|会议/i.test(r.name)) return 'A3'; if (/hall|auditorium|theatre|theater|church|礼堂/i.test(r.name)) return 'A2'; if (/music|rehears|band|choir|音乐/i.test(r.name)) return 'A1'; return 'home'; }
export const stiWord = (v) => (v >= 0.75 ? 'excellent' : v >= 0.6 ? 'good' : v >= 0.45 ? 'fair' : v >= 0.3 ? 'poor' : 'bad');
// o: { target ('auto' | group), own ({ room name: group }), people (m² per person, 0 = none), tC, rh, formula ('eyring' | 'sabine') }
export function run(sc, o = {}) {
  const MATS = sc.materials || MATS0, GLAZ = sc.glazing || GLAZ0, DEF = sc.defaults || DEF0;
  o = { target: 'auto', people: 0, tC: 20, rh: 50, formula: 'eyring', ...o };
const matOf = (q) => q.kind === 'window' ? (GLAZ[q.mat] || GLAZ[DEF.glazing]) : q.kind === 'door' ? DOOR : q.kind === 'opening' ? OPENING : (MATS[q.mat] || MATS[DEF[q.kind]] || MATS.plaster);
  const furnA = (f) => { const hit = FURN_A.find(([re]) => re.test(f.name || '') || re.test(f.type || '')); return hit ? { n: hit[1], a: hit[2] } : { n: 'Hard furniture', a: HARD_A }; };

  function calcRoom(r, o, air) {
    const surf = r.surf.map((q) => { const m = matOf(q); return { kind: q.kind, mat: q.mat, name: m.n, area: q.area, a: m.a, set: !!q.mat || q.kind === 'door' || q.kind === 'opening' }; });
    const furn = r.furn.map((f) => ({ ...f, abs: furnA(f) })), nP = o.people ? Math.max(1, Math.round(r.area / o.people)) : 0;
    const extra = BANDS.map((_, b) => furn.reduce((s, f) => s + f.abs.a[b], 0) + nP * PERSON_A[b]);
    const B = roomRT({ vol: r.vol, surf, extra }, air, o.tC), T = B.map((x) => x[o.formula]), mid = (T[2] + T[3]) / 2, grp = groupOf(r, o), tgt = dinTarget(grp, r.vol);
    const status = tgt == null ? 'none' : mid > tgt * 1.2 ? 'hi' : mid < tgt * 0.8 ? 'lo' : 'ok';
    return { r, surf, furn, nP, B, T, mid, grp, tgt, status, sti: stiRev(T), S: surf.reduce((s, q) => s + q.area, 0) };
}

  const air = BANDS.map((f) => airM(f, o.tC, o.rh)), rooms = (sc.rooms || []).filter((r) => r.surf && r.vol > 0).map((r) => calcRoom(r, o, air));
  // what it would take: for a room too live, the extra absorption (m², mean of 500 Hz and 1 kHz) to reach its target by Sabine,
  // and that as acoustic panel (α about 0.97 at 500 Hz–1 kHz) replacing plaster
  const c = 331.3 * Math.sqrt(1 + o.tC / 273.15), K = 24 * Math.LN10 / c;
  for (const x of rooms) { x.needA = 0; x.panel = 0; if (x.status !== 'hi' || x.tgt == null) continue; const Anow = (x.B[2].A + x.B[3].A) / 2 + (x.B[2].Aair + x.B[3].Aair) / 2, Aneed = K * x.r.vol / x.tgt; x.needA = Math.max(0, Aneed - Anow); x.panel = x.needA / (0.975 - 0.025); }
  const judged = rooms.filter((x) => x.tgt != null), tot = rooms.reduce((s, x) => s + x.r.vol, 0);
  return { rooms, air, o, judged: judged.length, ok: judged.filter((x) => x.status === 'ok').length, mean: tot ? rooms.reduce((s, x) => s + x.mid * x.r.vol, 0) / tot : 0,
    longest: rooms.slice().sort((a, b) => b.mid - a.mid)[0] || null, low: rooms.filter((x) => x.grp !== 'none').sort((a, b) => a.sti - b.sti)[0] || null };
}
