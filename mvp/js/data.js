// Native resource routes wrap the existing tool engines.
// Consistent interior / exterior illustration plates, rendered with analysis-art.html.
export const simImg = (id) => 'analysis-' + id;

// Analysis tools that exist today, grouped for the Simulations page.
// inputs: what the model must contain · metrics: what Results compares, read from the engine's own saved figures
// ([key, label, unit, decimals, pattern of the engine's figure label])
export const SIMS = [
  { id: 'sunhours', group: 'Climate', name: 'Sun hours', tool: 'sunhours', view: 'shaded',
    blurb: 'Hours of direct sun on ground, roofs and facades through the year.', inputs: ['Model massing', 'Site and north from Account'], metrics: [['ground', 'Ground, mean', 'h', 1, /^ground(, average)?$/i], ['ground2h', 'Ground with ≥ 2 h', '%', 0, /ground (with )?≥/i], ['roofs', 'Roofs, mean', 'h', 1, /roof/i], ['facades', 'Facades, mean', 'h', 1, /fa[cç]ade/i]] },
  // Solar radiation and Outdoor comfort run in the Sun hours engine with the project's climate file (2026-10-25)
  { id: 'radiation', group: 'Climate', name: 'Solar radiation', tool: 'radiation', view: 'shaded',
    blurb: 'Sun and sky energy on ground, roofs and facades in kWh/m² from a climate file, and where roof panels are worth a look.', inputs: ['Model massing', 'Climate file (EPW) in project conditions'],
    metrics: [['ground', 'Ground, mean', 'kWh/m²', 0, /^ground, mean/i], ['roofs', 'Roofs, mean', 'kWh/m²', 0, /^roofs, mean/i], ['facades', 'Facades, mean', 'kWh/m²', 0, /^facades, mean/i], ['pv', 'PV estimate', 'MWh', 1, /^pv estimate/i]] },
  { id: 'utci', group: 'Climate', name: 'Outdoor thermal comfort', tool: 'utci', view: 'shaded',
    blurb: 'How often the ground around the building is comfortable, too hot or too cold to stand on (UTCI), from sun, shade and a climate file.', inputs: ['Model massing and site', 'Climate file (EPW) in project conditions'],
    metrics: [['comfort', 'No thermal stress', '%', 1, /^no thermal stress/i], ['heat', 'Heat stress', '%', 1, /^heat stress/i], ['cold', 'Cold stress', '%', 1, /^cold stress/i]] },
  { id: 'daylight', group: 'Climate', name: 'Daylight', tool: 'daylight', view: 'shaded',
    blurb: 'sDA, ASE and daylight factor on the work plane, room by room.', inputs: ['Rooms with walls', 'Windows', 'Location'],
    metrics: [['sda', 'sDA 300/50%', '%', 1, /^sda/i], ['ase', 'ASE 1000/250', '%', 1, /^ase/i], ['df', 'Average daylight factor', '%', 1, /avg df|daylight factor/i]] },
  { id: 'wind', group: 'Climate', name: 'Wind flow', tool: 'wind', view: 'shaded',
    blurb: 'Where wind speeds up, slows and turns around the massing; with a climate file, where people can sit, stand or walk comfortably (Lawson).', inputs: ['Site massing', 'Wind direction and speed', 'Climate file (EPW) for comfort'],
    metrics: [['peak', 'Highest speed-up', '×', 2, /^highest/i], ['windy', 'Windy area', 'm²', 0, /^windy/i], ['sitting', 'Sitting area', '%', 1, /^sitting area/i], ['uncomf', 'Uncomfortable area', '%', 1, /^uncomfortable area/i], ['unsafe', 'Unsafe area', 'm²', 0, /^unsafe area/i]] },
  { id: 'vent', group: 'Climate', name: 'Natural ventilation', tool: 'vent', view: 'shaded',
    blurb: 'Air changes from operable openings, wind and stack effect.', inputs: ['Rooms', 'Operable windows', 'Climate'],
    metrics: [['ach', 'Air changes per hour, first room', 'ACH', 1, /./]] },
  { id: 'stormwater', group: 'Climate', name: 'Stormwater & waterlogging', tool: 'stormwater', view: 'shaded',
    blurb: 'Runoff paths, ponding and detention on the site surface.', inputs: ['Terrain or site model', 'Design storm'],
    metrics: [['peak', 'Peak depth', 'm', 3, /peak depth/i], ['flood', 'Deeper than 0.05 m', 'm²', 0, /deeper than/i]] },
  { id: 'acoustics', group: 'Acoustics', name: 'Indoor acoustics', tool: 'acoustics', view: 'plan',
    blurb: 'Reverberation time of every room by frequency, against a target for its use, and what would fix it.', inputs: ['Floor plan with rooms', 'Finishes set in Plan Studio'],
    metrics: [['rtmean', 'Mean T 500–1k', 's', 2, /^mean t 500/i], ['ontarget', 'Rooms on target', '', 0, /^rooms on target/i]] },
  { id: 'spacesyntax', group: 'Space & movement', name: 'Space syntax', tool: 'spacesyntax', view: 'plan',
    blurb: 'Integration and connectivity of the plan as a visibility graph.', inputs: ['Floor plan'], metrics: [['integration', 'Mean integration', '', 2, /^mean int/i], ['connectivity', 'Mean connectivity', '', 0, /^mean conn/i]] },
  { id: 'movementdepth', group: 'Space & movement', name: 'Movement & spatial depth', tool: 'movementdepth', view: 'plan',
    blurb: 'Steps of depth from the entrance and likely movement.', inputs: ['Floor plan', 'Entrances'], metrics: [['integration', 'Mean integration', '', 2, /^mean int/i], ['connectivity', 'Mean connectivity', '', 0, /^mean conn/i]] },
  { id: 'evac', group: 'Space & movement', name: 'Circulation', tool: 'evac', view: 'plan',
    blurb: 'Where people walk between the places they use.', inputs: ['Floor plan', 'Destinations and use'], metrics: [['walk', 'Average walk', 'm', 1, /^avg walk/i], ['pairs', 'Pairs', '', 0, /^pairs/i]] },
  { id: 'isovist', group: 'Space & movement', name: 'Isovist safety', tool: 'isovist', view: 'plan',
    blurb: 'What an observer can see at child, wheelchair or adult eye height.', inputs: ['Floor plan', 'Observer'], metrics: [['blind', 'Blind floor', '%', 1, /^blind/i], ['seen', 'Seen floor', 'm²', 0, /^seen/i]] },
  { id: 'views', group: 'Space & movement', name: 'View analysis', tool: 'views', view: 'shaded',
    blurb: 'Quality of outward views from each spot in the plan.', inputs: ['Rooms', 'Windows'], metrics: [['view', 'Floor with a view out', '%', 1, /^view out|line of sight/i], ['quality', 'Quality views', '%', 1, /quality/i]] },
  { id: 'wayfinding', group: 'Space & movement', name: 'Wayfinding', tool: 'wayfinding', view: 'plan',
    blurb: 'Where people must choose a way, whether they can see where to go, and where a sign helps.', inputs: ['Rooms', 'Doors'],
    metrics: [['signs', 'Signs suggested', '', 0, /^signs/i], ['decide', 'Decision points', '', 0, /^decision/i], ['depth', 'Mean visual depth', '', 1, /visual depth/i]] },
  { id: 'privacy', group: 'Space & movement', name: 'Privacy', tool: 'privacy', view: 'plan',
    blurb: 'What the street and the building opposite can see inside, room by room.', inputs: ['Rooms', 'Windows'],
    metrics: [['seen', 'Floor seen from outside', '%', 1, /^floor seen/i], ['private', 'Private floor seen', '%', 1, /^private floor/i]] },
  { id: 'cameras', group: 'Space & movement', name: 'Camera coverage', tool: 'cameras', view: 'plan',
    blurb: 'Where security cameras should go for the detail you need.', inputs: ['Floor plan'], metrics: [['cover', 'Floor covered', '%', 1, /^covered/i], ['cams', 'Cameras', '', 0, /^cameras$/i]] },
  { id: 'structure', group: 'Structure', name: 'Structural analysis', tool: 'structure', view: 'wire',
    blurb: 'Frame with NBC loads, member sizing and deflection checks.', inputs: ['Grid and storeys', 'Material and system'], metrics: [['ratio', 'Stress ratio', '', 2, /stress ratio/i], ['disp', 'Displacement', 'mm', 1, /displacement/i]] },
];

// Spatial scope is independent of discipline: Climate contains both indoor and outdoor studies.
for(const sim of SIMS) sim.scope=['sunhours','radiation','utci','wind','stormwater','noise'].includes(sim.id)?'Exterior':sim.id==='structure'?'Building':'Interior';

// Tools that build or prepare a model; the Workspace hands off to them for detailed work.
export const MODEL_TOOLS = [
  { name: '3D model generator', tool: 'furniture', blurb: 'Parametric furniture and fittings.' },
  { name: 'Facade studio', tool: 'facade', blurb: 'Parametric facade studies.' },
  { name: 'DetailLab', tool: 'detaillab', blurb: 'Construction details in 3D.' },
];

// Resources: free tools and files that bring people in.
export const RESOURCES = {
  utilities: [
    { name: 'Color palettes', tool: 'palette', blurb: 'Palettes for boards, renders and materials.' },
    { name: 'Exploded site axon', tool: 'axon', blurb: 'Layered site axonometric diagrams.' },
    { name: 'Physical model', tool: 'topo', blurb: 'Contour models ready for laser cutting.' },
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
export const LAYER_COLORS = { Site: '#c9c6bf', Masses: '#e9c39e', Context: '#bdb9b0', Structure: '#8f8b84', Walls: '#ecebe6', Glazing: '#8fb4d1', Roof: '#d9d6cf', Rooms: '#e8b04a', Furniture: '#cfc8bb', Imported: '#d5d2cb' };

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
    // doors are openings from the floor (the Workspace door tool arrives in Step 2); simulations read them as doors
    { name: 'Interior door', type: 'window', layer: 'Walls', g: { x: 9.98, y: 5.2, z: 0, w: 0.19, d: 0.9, h: 2.1 }, mat: 'Timber' },
    { name: 'Entrance door', type: 'window', layer: 'Walls', g: { x: 4, y: 11.73, z: 0, w: 1.0, d: 0.29, h: 2.1 }, mat: 'Timber' },
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
