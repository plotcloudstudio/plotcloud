// The analysis model is a traceable, study-specific proxy derived from an imported authoring model.
// It never claims that a display mesh is a room or a BIM element without a source mapping or user confirmation.

export const SEMANTICS = [
  ['ignore', 'Exclude from analysis'], ['building', 'Building envelope / mass'], ['context', 'Context building'],
  ['wall', 'Wall'], ['window', 'Window / glazing'], ['slab', 'Floor slab'], ['roof', 'Roof'],
  ['room', 'Room boundary / volume'], ['furniture', 'Furniture / obstacle'],
];

export const STUDY_REQUIREMENTS = {
  sunhours: 'mass', radiation: 'mass', utci: 'mass', wind: 'mass', noise: 'mass', stormwater: 'terrain', structure: 'building',
  daylight: 'rooms', vent: 'rooms', acoustics: 'rooms', spacesyntax: 'plan', movementdepth: 'plan', evac: 'plan',
  isovist: 'plan', views: 'rooms', wayfinding: 'plan', privacy: 'rooms', cameras: 'plan',
};

const RULES = [
  [/context|neighbou?r|existing|surround|adjacent|周边|邻/i, 'context'],
  [/window|glaz|glass|curtain|窗|玻璃|幕墙/i, 'window'],
  [/wall|partition|墙|隔断/i, 'wall'], [/slab|floor|deck|楼板|地板/i, 'slab'], [/roof|canopy|屋顶|雨棚/i, 'roof'],
  [/room|space|zone|房间|空间/i, 'room'], [/furn|chair|table|desk|sofa|bed|cabinet|家具|桌|椅|床|柜/i, 'furniture'],
  [/building|envelope|massing|mass|建筑|体量/i, 'building'],
];
const TYPE = { building: ['wall', 'Walls', 'Concrete'], context: ['mass', 'Context', 'Context'], wall: ['wall', 'Walls', 'Plaster'],
  window: ['window', 'Glazing', 'Glass'], slab: ['slab', 'Structure', 'Concrete'], roof: ['roof', 'Roof', 'Concrete'],
  room: ['room', 'Rooms', 'Room'], furniture: ['furniture', 'Furniture', 'Timber'] };

export function suggestedSemantic(text, studyId = '') {
  const hit = RULES.find(([re]) => re.test(String(text || ''))); if (hit) return hit[1];
  return ['sunhours', 'radiation', 'utci', 'wind', 'noise', 'structure'].includes(studyId) ? 'building' : 'ignore';
}

const levelNumber = (s) => {
  const m = String(s || '').match(/(?:^|[^a-z])(level|lvl|floor|storey|story|l)[ _-]*0*(\d{1,3})(?:\b|_)/i); return m ? +m[2] : null;
};
const close = (a, b, tol = 0.18) => Math.abs(a - b) <= tol;
export function inferLevels(components, mapping = {}) {
  const explicit = new Map(), slabZ = [];
  for (const c of components || []) {
    const source = c.srcLayer || c.name || '', sem = mapping[c.srcLayer || ''] || suggestedSemantic(source);
    const n = levelNumber(source); if (n) { const z = c.g?.z || 0, a = explicit.get(n) || []; a.push(z); explicit.set(n, a); }
    if (sem === 'slab' || (c.g && c.g.h <= 0.6 && c.g.w > 2 && c.g.d > 2)) slabZ.push((c.g?.z || 0) + (c.g?.h || 0));
  }
  const levels = [...explicit].sort((a, b) => a[0] - b[0]).map(([n, zs]) => ({ id: `L${n}`, name: `Level ${n}`, elevation: median(zs), source: 'Rhino layer/name', confidence: 'high', confirmed: false }));
  const zs = [...new Set(slabZ.map((z) => +z.toFixed(2)))].sort((a, b) => a - b);
  for (const z of zs) if (!levels.some((l) => close(l.elevation, z))) levels.push({ id: '', name: '', elevation: z, source: 'Horizontal slab', confidence: 'medium', confirmed: false });
  levels.sort((a, b) => a.elevation - b.elevation); levels.forEach((l, i) => { if (!l.id) l.id = `L${i + 1}`; if (!l.name) l.name = `Level ${i + 1}`; });
  return levels.length ? levels : [{ id: 'L1', name: 'Level 1', elevation: 0, source: 'Model base', confidence: 'low', confirmed: false }];
}
const median = (xs) => { const a = xs.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };

function fingerprint(source, result) {
  const s = [source?.name, source?.bytes, result.sourceTriangles, ...result.components.map((c) => `${c.name}:${c.g.x},${c.g.y},${c.g.z},${c.g.w},${c.g.d},${c.g.h}`)].join('|');
  let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return `fnv1a-${(h >>> 0).toString(16).padStart(8, '0')}`;
}

export function prepareAnalysisModel(result, { studyId, mapping = {}, levels = [], north = 0 } = {}) {
  const components = [], meshes = {}, layerNames = new Set();
  for (const original of result.components || []) {
    const sourceLayer = original.srcLayer || 'Unclassified', semantic = mapping[sourceLayer] || suggestedSemantic(`${sourceLayer} ${original.name}`, studyId);
    if (semantic === 'ignore') continue;
    const [type, layer, mat] = TYPE[semantic], id = `import-${components.length + 1}`;
    components.push({ ...original, id, srcLayer: sourceLayer, sourceName: original.name, semantic, type, layer, mat });
    meshes[id] = original.mesh; delete components.at(-1).mesh; layerNames.add(layer);
  }
  const source = { ...result.source, fingerprint: fingerprint(result.source, result) }, generatedAt = new Date().toISOString();
  const model = { layers: [...layerNames].map((name) => ({ name, color: '#999999', visible: true, locked: false })), components, meshes,
    analysisModel: { schema: 1, id: `am-${source.fingerprint.slice(-8)}-${Date.now().toString(36)}`, studyId, source, generatedAt,
      proxy: { method: result.simplified ? 'deterministic triangle sampling' : 'source render meshes', sourceTriangles: result.sourceTriangles, triangles: result.triangles, simplified: !!result.simplified },
      levels: levels.map((l, i) => ({ ...l, id: l.id || `L${i + 1}`, confirmed: !!l.confirmed })), north, contextIncluded: components.some((c) => c.semantic === 'context'), assumptions: [] } };
  model.analysisModel.readiness = inspectAnalysisModel(model, studyId); return model;
}

export function inspectAnalysisModel(model, studyId) {
  const c = model?.components || [], count = (t) => c.filter((x) => x.type === t).length, need = STUDY_REQUIREMENTS[studyId] || 'plan';
  const hasMass = count('wall') + count('slab') + count('roof') > 0, hasPlan = count('wall') >= 3, hasRooms = count('room') > 0 || hasPlan;
  const issues = [], limits = [];
  if (need === 'mass' && !hasMass) issues.push('Map at least one layer as Building envelope / mass.');
  if ((need === 'plan' || need === 'rooms') && !hasPlan) issues.push('Map at least three wall objects or provide room boundaries.');
  if (need === 'rooms' && !hasRooms) issues.push('No room or closed wall layout is available.');
  if (need === 'terrain' && !c.some((x) => x.type === 'terrain' || x.semantic === 'slab')) issues.push('Map a ground or floor surface before this study.');
  if (!(model.analysisModel?.levels || []).some((l) => l.confirmed)) limits.push('Levels are inferred and have not been confirmed.');
  if (!model.analysisModel?.contextIncluded && ['sunhours', 'radiation', 'utci', 'wind', 'noise'].includes(studyId)) limits.push('Surrounding context is omitted.');
  if (need === 'rooms' && count('room') === 0) limits.push('Closed rooms will be checked by the simulation engine; wall names alone do not prove enclosure.');
  return { state: issues.length ? 'not-ready' : limits.length ? 'limited' : 'ready', requirement: need, issues, limits,
    counts: { objects: c.length, walls: count('wall'), windows: count('window'), slabs: count('slab'), rooms: count('room'), context: count('mass') } };
}
