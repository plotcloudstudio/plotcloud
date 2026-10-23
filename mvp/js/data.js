// Catalog of what PlotCloud already has. Every `tool` id opens the working tool in the production site
// (../index.html#/tool/<id>). Nothing here replaces those engines; the prototype only adds a project layer around them.

export const FULL = (id) => `../index.html#/tool/${id}`;
// holographic picture for each simulation: img/sim-<id>-day|night.jpg, rendered with holo-render.html
export const simImg = (id) => 'sim-' + id;
export const PAGE = (route) => `../index.html#/${route}`;

// Analysis tools that exist today, grouped for the Simulations page.
// inputs: what the model must contain · metrics: what the prototype preview reports (mock) and Results compares
export const SIMS = [
  { id: 'sunhours', group: 'Climate', name: 'Sun hours', tool: 'sunhours', view: 'shaded',
    blurb: 'Hours of direct sun on ground, roofs and facades through the year.', inputs: ['Site massing', 'True north', 'City'],
    settings: [{ k: 'period', label: 'Period', type: 'select', options: ['Winter solstice', 'Equinox', 'Summer solstice', 'Whole year'], v: 'Equinox' }],
    metrics: [['facadeSun', 'Mean facade sun', 'h/day', 1], ['groundSun', 'Courtyard ground ≥ 2 h', '%', 0]] },
  { id: 'daylight', group: 'Climate', name: 'Daylight', tool: 'daylight', view: 'shaded',
    blurb: 'sDA, ASE and daylight factor on the work plane, room by room.', inputs: ['Rooms with walls', 'Windows', 'Location'],
    settings: [{ k: 'plane', label: 'Work plane (m)', type: 'number', v: 0.8, step: 0.05 }],
    metrics: [['sda', 'sDA 300/50%', '%', 0], ['ase', 'ASE 1000/250', '%', 0], ['df', 'Average daylight factor', '%', 1]] },
  { id: 'wind', group: 'Climate', name: 'Wind flow', tool: 'wind', view: 'shaded',
    blurb: 'Where wind speeds up, slows and turns around the massing.', inputs: ['Site massing', 'Wind direction and speed'],
    settings: [{ k: 'dir', label: 'From (°)', type: 'number', v: 225, step: 15 }, { k: 'speed', label: 'Speed (m/s)', type: 'number', v: 5, step: 0.5 }],
    metrics: [['comfort', 'Pedestrian comfort area', '%', 0], ['peak', 'Peak speed-up', '×', 2]] },
  { id: 'vent', group: 'Climate', name: 'Natural ventilation', tool: 'vent', view: 'shaded',
    blurb: 'Air changes from operable openings, wind and stack effect.', inputs: ['Rooms', 'Operable windows', 'Climate'],
    settings: [{ k: 'open', label: 'Opening fraction', type: 'number', v: 0.5, step: 0.05 }],
    metrics: [['ach', 'Air changes per hour', 'ACH', 1]] },
  { id: 'stormwater', group: 'Climate', name: 'Stormwater & waterlogging', tool: 'stormwater', view: 'shaded',
    blurb: 'Runoff paths, ponding and detention on the site surface.', inputs: ['Terrain or site model', 'Design storm'],
    settings: [{ k: 'rain', label: 'Rain (mm/h)', type: 'number', v: 50, step: 5 }, { k: 'duration', label: 'Duration (min)', type: 'number', v: 60, step: 5 }],
    metrics: [['runoff', 'Total runoff', 'm³', 1], ['ponding', 'Ponding area', 'm²', 0]] },
  { id: 'acoustics', group: 'Acoustics', name: 'Indoor acoustics', tool: 'acoustics', view: 'wire',
    blurb: 'Reverberation by frequency and reflection wavefronts in one room.', inputs: ['One closed room', 'Surface materials'],
    settings: [{ k: 'room', label: 'Room', type: 'room' }, { k: 'band', label: 'Band', type: 'select', options: ['250 Hz', '500 Hz', '1 kHz', '2 kHz'], v: '500 Hz' }],
    metrics: [['rt60', 'RT60', 's', 2], ['c50', 'C50 (estimate)', 'dB', 1]] },
  { id: 'spacesyntax', group: 'Space & movement', name: 'Space syntax', tool: 'spacesyntax', view: 'plan',
    blurb: 'Integration and connectivity of the plan as a visibility graph.', inputs: ['Floor plan'],
    settings: [{ k: 'grid', label: 'Grid (m)', type: 'number', v: 0.5, step: 0.25 }], metrics: [['integration', 'Mean integration', '', 2]] },
  { id: 'movementdepth', group: 'Space & movement', name: 'Movement & spatial depth', tool: 'movementdepth', view: 'plan',
    blurb: 'Steps of depth from the entrance and likely movement.', inputs: ['Floor plan', 'Entrances'],
    settings: [], metrics: [['depth', 'Mean depth from entrance', 'steps', 1]] },
  { id: 'evac', group: 'Space & movement', name: 'Circulation', tool: 'evac', view: 'plan',
    blurb: 'Where people walk between the places they use.', inputs: ['Floor plan', 'Destinations and use'],
    settings: [], metrics: [['walk', 'Mean walking distance', 'm', 1]] },
  { id: 'isovist', group: 'Space & movement', name: 'Isovist safety', tool: 'isovist', view: 'plan',
    blurb: 'What an observer can see at child, wheelchair or adult eye height.', inputs: ['Floor plan', 'Observer'],
    settings: [{ k: 'eye', label: 'Eye height (m)', type: 'number', v: 1.2, step: 0.1 }], metrics: [['visible', 'Visible floor area', '%', 0]] },
  { id: 'views', group: 'Space & movement', name: 'View analysis', tool: 'views', view: 'shaded',
    blurb: 'Quality of outward views from each spot in the plan.', inputs: ['Rooms', 'Windows'],
    settings: [], metrics: [['view', 'Floor with a quality view', '%', 0]] },
  { id: 'cameras', group: 'Space & movement', name: 'Camera coverage', tool: 'cameras', view: 'plan',
    blurb: 'Where security cameras should go for the detail you need.', inputs: ['Floor plan'],
    settings: [], metrics: [['cover', 'Floor covered', '%', 0]] },
  { id: 'structure', group: 'Structure', name: 'Structural analysis', tool: 'structure', view: 'wire',
    blurb: 'Frame with NBC loads, member sizing and deflection checks.', inputs: ['Grid and storeys', 'Material and system'],
    settings: [{ k: 'system', label: 'System', type: 'select', options: ['Timber frame', 'Steel frame', 'Concrete flat slab'], v: 'Timber frame' }], metrics: [['util', 'Max member utilisation', '%', 0]] },
  { id: 'span', group: 'Structure', name: 'Structure sizer', tool: 'span', view: 'wire',
    blurb: 'First-guess depths for joists, beams and slabs from a span.', inputs: ['Span'],
    settings: [], metrics: [['depth', 'Beam depth for longest span', 'mm', 0]] },
];

// Tools that build or prepare a model; the Workspace hands off to them for detailed work.
export const MODEL_TOOLS = [
  { name: 'Site Planner', route: 'site', blurb: 'Pick a place on the map and generate surrounding massing.' },
  { name: 'Plan Studio', route: 'studio', blurb: 'Draw walls, rooms, doors, windows and furniture across levels.' },
  { name: 'Plan tracer', tool: 'tracer', blurb: 'Trace a plan image to scale, then open it in Plan Studio.' },
  { name: '3D model generator', tool: 'furniture', blurb: 'Parametric furniture and fittings.' },
  { name: 'Facade studio', tool: 'facade', blurb: 'Parametric facade studies.' },
  { name: 'DetailLab', tool: 'detaillab', blurb: 'Construction details in 3D.' },
];

// Resources: free tools and files that bring people in.
export const RESOURCES = {
  ai: [
    { name: 'Image toolkit', tool: 'cutout', blurb: 'Cut-outs, depth, line drawings, upscaling, sky replacement and object removal.' },
    { name: 'Architectural drawing', tool: 'architectural-render', blurb: 'Material and single-colour drawings from model views or uploads.' },
    { name: 'Color palettes', tool: 'palette', blurb: 'Palettes for boards, renders and materials.' },
    { name: 'Pin-up composer', tool: 'composer', blurb: 'Lay out renders, plans and diagrams on crit boards.' },
    { name: 'Board studio', tool: 'studio', blurb: 'Presentation boards from your project images.' },
    { name: 'Exploded site axon', tool: 'axon', blurb: 'Layered site axonometric diagrams.' },
    { name: 'Physical model', tool: 'topo', blurb: 'Contour models ready for laser cutting.' },
  ],
  files: [
    ['CAD Resources', 'Stair & railing blocks, residential furniture plan blocks'], ['Rhino Resources', 'Furniture, lamps, benches'],
    ['Revit Resources', 'Families'], ['Grasshopper & Parametric', 'Scripts'], ['3D & Case Study Models', 'Villa Savoye, plants, trees'],
    ['Diagrams & Graphics', 'Scale figures, materials, axon kits'], ['Site & Urban Design', 'City context kits'],
    ['Presentation Templates', 'Crit boards'], ['Portfolio & Job Application', 'Portfolio templates'],
  ],
  refs: [
    { name: 'Building code finder', tool: 'code-bc', blurb: 'BC and Ontario code sections by topic.' },
    { name: 'Accessibility finder', tool: 'access-bc', blurb: 'Ramps, landings, clearances.' },
    { name: 'LEED v5 finder', tool: 'leed', blurb: 'Plan credits and points.' },
    { name: 'Ergonomics cheat sheet', tool: 'ergo', blurb: 'Interior dimensions that work.' },
    { name: 'Scale & sheets', tool: 'scale', blurb: 'Scales, sheet sizes and units.' },
  ],
};

// ---------------------------------------------------------------- sample project (mock)
// Model units: metres. z is up. Box components: x,y = min corner in plan, z = base; w (x), d (y), h (z).
export const LAYER_COLORS = { Site: '#c9c6bf', Context: '#bdb9b0', Structure: '#8f8b84', Walls: '#ecebe6', Glazing: '#8fb4d1', Roof: '#d9d6cf', Rooms: '#e8b04a', Furniture: '#cfc8bb', Imported: '#d5d2cb' };

function wallsAround(x, y, w, d, h, t, layer, prefix) {
  return [
    { name: `${prefix} south wall`, type: 'wall', layer, g: { x, y, z: 0, w, d: t, h }, mat: 'Concrete' },
    { name: `${prefix} north wall`, type: 'wall', layer, g: { x, y: y + d - t, z: 0, w, d: t, h }, mat: 'Concrete' },
    { name: `${prefix} west wall`, type: 'wall', layer, g: { x, y: y + t, z: 0, w: t, d: d - 2 * t, h }, mat: 'Plaster' },
    { name: `${prefix} east wall`, type: 'wall', layer, g: { x: x + w - t, y: y + t, z: 0, w: t, d: d - 2 * t, h }, mat: 'Plaster' },
  ];
}

export function sampleModel(variant = 'A') {
  const big = variant === 'B';
  const c = [
    { name: 'Site ground', type: 'terrain', layer: 'Site', g: { x: -8, y: -8, z: -0.3, w: 36, d: 30, h: 0.3 }, mat: 'Grass' },
    { name: 'Neighbour block east', type: 'mass', layer: 'Context', g: { x: 22, y: -2, z: 0, w: 5, d: 16, h: 9 }, mat: 'Context' },
    { name: 'Neighbour block north', type: 'mass', layer: 'Context', g: { x: -4, y: 17, z: 0, w: 22, d: 4, h: 6 }, mat: 'Context' },
    { name: 'Ground slab', type: 'slab', layer: 'Structure', g: { x: 0, y: 0, z: -0.2, w: 16, d: 12, h: 0.2 }, mat: 'Concrete' },
    ...wallsAround(0, 0, 16, 12, 3.2, 0.25, 'Walls', 'Studio'),
    { name: 'Partition', type: 'wall', layer: 'Walls', g: { x: 10, y: 0.25, z: 0, w: 0.15, d: 11.5, h: 3.2 }, mat: 'Gypsum' },
    { name: 'South window 1', type: 'window', layer: 'Glazing', g: { x: 1.5, y: -0.02, z: 0.9, w: big ? 3.2 : 2.2, d: 0.3, h: big ? 1.9 : 1.5 }, mat: 'Glass' },
    { name: 'South window 2', type: 'window', layer: 'Glazing', g: { x: 5.5, y: -0.02, z: 0.9, w: big ? 3.2 : 2.2, d: 0.3, h: big ? 1.9 : 1.5 }, mat: 'Glass' },
    { name: 'South window 3', type: 'window', layer: 'Glazing', g: { x: 11.5, y: -0.02, z: 0.9, w: 2.2, d: 0.3, h: 1.5 }, mat: 'Glass' },
    { name: 'West window', type: 'window', layer: 'Glazing', g: { x: -0.02, y: 4, z: 0.9, w: 0.3, d: 2.4, h: 1.5 }, mat: 'Glass' },
    { name: 'Roof slab', type: 'roof', layer: 'Roof', g: { x: -0.3, y: -0.3, z: 3.2, w: 16.6, d: 12.6, h: 0.3 }, mat: 'Concrete' },
    { name: 'Studio room', type: 'room', layer: 'Rooms', g: { x: 0.25, y: 0.25, z: 0, w: 9.75, d: 11.5, h: 3.2 }, mat: 'Room', room: { floor: 'Timber', ceiling: big ? 'Acoustic panel' : 'Gypsum' } },
    { name: 'Office room', type: 'room', layer: 'Rooms', g: { x: 10.15, y: 0.25, z: 0, w: 5.6, d: 11.5, h: 3.2 }, mat: 'Room', room: { floor: 'Carpet', ceiling: 'Gypsum' } },
    { name: 'Long table', type: 'furniture', layer: 'Furniture', g: { x: 3, y: 5, z: 0, w: 4, d: 1, h: 0.75 }, mat: 'Timber' },
    { name: 'Desk row', type: 'furniture', layer: 'Furniture', g: { x: 11, y: 8, z: 0, w: 4, d: 0.8, h: 0.75 }, mat: 'Timber' },
  ];
  if (big) c.push({ name: 'South overhang', type: 'roof', layer: 'Roof', g: { x: 0, y: -1.4, z: 3.2, w: 16, d: 1.1, h: 0.15 }, mat: 'Timber' });
  return {
    units: 'm', north: 0,
    layers: Object.keys(LAYER_COLORS).filter((k) => k !== 'Imported').map((name) => ({ name, color: LAYER_COLORS[name], visible: true, locked: name === 'Site' || name === 'Context' })),
    components: c.map((x, i) => ({ id: 'c' + (i + 1), ...x })),
  };
}
