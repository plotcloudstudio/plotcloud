// Prototype estimates. These are NOT the PlotCloud simulation engines: they read a few quantities from the model
// (floor area, glazing, volume, materials) and return plausible numbers so the save → compare journey can be shown.
// Real analysis runs in the full tools (data.js FULL()).

const ABS = { // Sabine absorption coefficient at 500 Hz, typical published values
  Concrete: 0.02, Plaster: 0.03, Gypsum: 0.05, Glass: 0.04, Timber: 0.10, Carpet: 0.30, 'Acoustic panel': 0.80, Grass: 0.6, Context: 0.02 };
const BANDF = { '250 Hz': 0.85, '500 Hz': 1, '1 kHz': 1.08, '2 kHz': 1.12 };

export function measure(model) {
  const on = model.components;
  const area = (c) => c.g.w * c.g.d;
  const rooms = on.filter((c) => c.type === 'room');
  const floor = rooms.reduce((s, c) => s + area(c), 0);
  const glz = on.filter((c) => c.type === 'window');
  const glazing = glz.reduce((s, c) => s + Math.max(c.g.w, c.g.d) * c.g.h, 0);
  const southGlazing = glz.filter((c) => c.g.d < c.g.w).reduce((s, c) => s + c.g.w * c.g.h, 0);
  const walls = on.filter((c) => c.type === 'wall');
  const wallArea = walls.reduce((s, c) => s + Math.max(c.g.w, c.g.d) * c.g.h, 0);
  const shade = on.filter((c) => c.type === 'roof' && c.g.y < -0.5).reduce((s, c) => s + c.g.w * c.g.d, 0);
  const roof = on.filter((c) => c.type === 'roof').reduce((s, c) => s + area(c), 0);
  const site = on.filter((c) => c.type === 'terrain').reduce((s, c) => s + area(c), 0);
  const ctxH = Math.max(0, ...on.filter((c) => c.type === 'mass').map((c) => c.g.h));
  return { floor, glazing, southGlazing, wallArea, wwr: wallArea ? glazing / wallArea : 0, shade, roof, site, ctxH, rooms };
}

export function rt60(room, model, band = '500 Hz') {
  const g = room.g, V = g.w * g.d * g.h, f = BANDF[band] || 1;
  const wallMat = model.components.filter((c) => c.type === 'wall')[0]?.mat || 'Plaster';
  const glass = model.components.filter((c) => c.type === 'window' && inside(c, g)).reduce((s, c) => s + Math.max(c.g.w, c.g.d) * c.g.h, 0);
  const S = { floor: g.w * g.d, ceil: g.w * g.d, walls: 2 * (g.w + g.d) * g.h - glass };
  const A = (S.floor * (ABS[room.room?.floor] || 0.1) + S.ceil * (ABS[room.room?.ceiling] || 0.05) + S.walls * (ABS[wallMat] || 0.03) + glass * ABS.Glass) * f + 2; // +2 m² sabins: people/furniture allowance
  return { t: 0.161 * V / A, V };
}
const inside = (c, g) => c.g.x + c.g.w / 2 >= g.x - 0.5 && c.g.x + c.g.w / 2 <= g.x + g.w + 0.5 && c.g.y + c.g.d / 2 >= g.y - 0.5 && c.g.y + c.g.d / 2 <= g.y + g.d + 0.5;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// more daylight and sun nearer the equator; a rough latitude factor for the preview only
const latK = (site) => (site && Number.isFinite(site.lat) ? clamp(1.25 - Math.abs(site.lat) / 110, 0.6, 1.25) : 1);

export function run(simId, model, settings = {}, site = null) {
  const m = measure(model), r = {};
  const ratio = m.floor ? m.glazing / m.floor : 0;
  switch (simId) {
    case 'daylight': r.sda = clamp(18 + ratio * 320 * latK(site), 0, 100); r.ase = clamp(m.southGlazing / Math.max(1, m.floor) * 140 - m.shade * 0.55, 0, 60); r.df = clamp(ratio * 20, 0, 12); break;
    case 'sunhours': r.facadeSun = clamp(3.4 * latK(site) - m.ctxH * 0.08 - m.shade * 0.02, 0.5, 12); r.groundSun = clamp(70 - m.ctxH * 3.1, 0, 100); break;
    case 'wind': r.comfort = clamp(88 - m.ctxH * 1.6 - (settings.speed || 5) * 2.2, 10, 100); r.peak = 1 + m.ctxH * 0.04 + (settings.speed || 5) * 0.01; break;
    case 'vent': r.ach = clamp(m.glazing * (settings.open ?? 0.5) * 1.8 / Math.max(1, m.floor * 3.2) * 60, 0.3, 20); break;
    case 'stormwater': { const P = (settings.rain || 50) * (settings.duration || 60) / 60 / 1000; r.runoff = P * (m.roof * 0.9 + Math.max(0, m.site - m.roof) * 0.35); r.ponding = Math.max(0, m.site - m.roof) * 0.04 * (settings.rain || 50) / 50; break; }
    case 'acoustics': { const room = model.components.find((c) => c.id === settings.room) || m.rooms[0]; if (!room) { r.error = 'No room in this model'; break; } const a = rt60(room, model, settings.band); r.rt60 = a.t; r.c50 = clamp(3 - a.t * 4.5, -12, 6); r.roomName = room.name; break; }
    case 'spacesyntax': r.integration = 1.2 + m.rooms.length * 0.18; break;
    case 'movementdepth': r.depth = 1 + m.rooms.length * 0.5; break;
    case 'evac': r.walk = Math.sqrt(m.floor) * 0.9; break;
    case 'isovist': r.visible = clamp(92 - m.rooms.length * 9 - (1.7 - (settings.eye || 1.2)) * 6, 10, 100); break;
    case 'views': r.view = clamp(25 + m.wwr * 160, 0, 100); break;
    case 'cameras': r.cover = clamp(100 - m.rooms.length * 6, 30, 100); break;
    case 'structure': r.util = clamp(55 + m.floor * 0.12 + (settings.system === 'Steel frame' ? -8 : settings.system === 'Concrete flat slab' ? -4 : 0), 10, 140); break;
    case 'span': r.depth = Math.round(Math.max(...m.rooms.map((c) => Math.min(c.g.w, c.g.d)), 3) / 20 * 1000); break;
  }
  return r;
}
