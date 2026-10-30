// Local-only parameter schemas for every PlotCloud simulation (ids match mvp/js/data.js SIMS).
// Global/project parameters — location, true north, time zone, EPW weather, use template, account defaults — are NOT here:
// they live only in the Dashboard "Overview" tab. A schema describes what one study asks for, its animation axis and legend.
//
// field: { key, label, type: 'number'|'select'|'toggle'|'date'|'time', unit?, min?, max?, step?, options?, default, help? }
// animation: { axis, label, min, max, step, format(v) } — or null when the study has no time/direction dimension
// legend: { label, unit, ramp: 'sun'|'heat'|'cool'|'diverging'|'categorical', min?, max?, categories? }

const hh = (v) => `${String(Math.floor(v)).padStart(2, '0')}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const month = (v) => MONTHS[Math.round(v) - 1] || '';
const deg = (v) => `${Math.round(v)}°`;

const grid = (d = 1, min = 0.25, max = 5) => ({ key: 'gridSize', label: 'Grid size', type: 'number', unit: 'm', min, max, step: 0.25, default: d });
const context = { key: 'contextGeometry', label: 'Context geometry', type: 'select', options: [['include', 'Include as obstruction'], ['exclude', 'Ignore context']], default: 'include' };
const height = (key, label, d) => ({ key, label, type: 'number', unit: 'm', min: 0, max: 5, step: 0.05, default: d });
const hours = (from, to) => ({ axis: 'hour', label: 'Time of day', min: from, max: to, step: 0.25, format: hh });
const months = { axis: 'month', label: 'Month', min: 1, max: 12, step: 1, format: month };

export const SCHEMAS = {
  sunhours: { name: 'Sun hours', category: 'building',
    groups: [
      { title: 'Analysis surface', fields: [
        { key: 'tiltAngle', label: 'Tilt angle', type: 'number', unit: '°', min: 0, max: 90, step: 1, default: 0, help: '0° = horizontal ground or roof; 90° = facade.' },
        { key: 'azimuthAngle', label: 'Azimuth angle', type: 'number', unit: '°', min: 0, max: 360, step: 1, default: 180, help: 'Direction the tilted surface faces, clockwise from north.' },
        grid(1)] },
      { title: 'Obstruction', fields: [context] },
      { title: 'Period and threshold', fields: [
        { key: 'date', label: 'Date', type: 'date', default: '2026-03-20' },
        { key: 'startTime', label: 'From', type: 'time', default: '09:00' },
        { key: 'endTime', label: 'Until', type: 'time', default: '15:00' },
        { key: 'exposureThreshold', label: 'Exposure threshold', type: 'number', unit: 'h', min: 0, max: 12, step: 0.5, default: 2 }] }],
    animation: { ...hours(5, 21), label: 'Sun position' }, legend: { label: 'Direct sun', unit: 'h', ramp: 'sun', min: 0, max: 8 } },
  radiation: { name: 'Solar radiation', category: 'building',
    groups: [{ title: 'Surfaces', fields: [grid(1), { key: 'offset', label: 'Sensor offset', type: 'number', unit: 'm', min: 0, max: 1, step: 0.05, default: 0.1 }, context] },
      { title: 'Sky', fields: [{ key: 'period', label: 'Period', type: 'select', options: [['annual', 'Annual'], ['summer', 'Summer (Jun–Aug)'], ['winter', 'Winter (Dec–Feb)']], default: 'annual' }, { key: 'groundReflectance', label: 'Ground reflectance', type: 'number', min: 0, max: 0.9, step: 0.05, default: 0.2 }] }],
    animation: months, legend: { label: 'Cumulative irradiation', unit: 'kWh/m²', ramp: 'heat' } },
  utci: { name: 'Outdoor thermal comfort', category: 'building',
    groups: [{ title: 'Evaluation', fields: [grid(2, 0.5, 10), height('evaluationHeight', 'Evaluation height', 1.1), context] },
      { title: 'Period', fields: [{ key: 'period', label: 'Season', type: 'select', options: [['summer', 'Summer'], ['winter', 'Winter'], ['annual', 'Annual']], default: 'summer' }, { key: 'sunUpOnly', label: 'Daytime hours only', type: 'toggle', default: true }] }],
    animation: hours(0, 23), legend: { label: 'UTCI stress', unit: '', ramp: 'categorical', categories: [['#2c7bb6', 'Cold stress'], ['#abd9e9', 'Slight cold'], ['#7fbf7b', 'No stress'], ['#fdae61', 'Heat stress'], ['#d7191c', 'Strong heat']] } },
  daylight: { name: 'Daylight', category: 'interior',
    groups: [
      { title: 'Sensor grid', fields: [{ key: 'sensorGrid', label: 'Sensor spacing', type: 'number', unit: 'm', min: 0.25, max: 2, step: 0.05, default: 0.5 }, height('workPlaneHeight', 'Work-plane height', 0.8)] },
      { title: 'Materials', fields: [
        { key: 'glazingTransmittance', label: 'Glazing transmittance (Tv)', type: 'number', min: 0, max: 0.95, step: 0.01, default: 0.6 },
        { key: 'wallReflectance', label: 'Wall reflectance', type: 'number', min: 0, max: 0.95, step: 0.05, default: 0.5 },
        { key: 'floorReflectance', label: 'Floor reflectance', type: 'number', min: 0, max: 0.95, step: 0.05, default: 0.2 },
        { key: 'ceilingReflectance', label: 'Ceiling reflectance', type: 'number', min: 0, max: 0.95, step: 0.05, default: 0.8 }] },
      { title: 'Shading', fields: [{ key: 'shadingState', label: 'Shading state', type: 'select', options: [['open', 'Open'], ['closed', 'Closed'], ['dynamic', 'Dynamic (glare-controlled)']], default: 'open' }] }],
    animation: hours(6, 20), legend: { label: 'Illuminance', unit: 'lux', ramp: 'sun', min: 0, max: 3000 } },
  wind: { name: 'Wind flow', category: 'building',
    groups: [{ title: 'Inflow', fields: [{ key: 'windDirection', label: 'Wind from', type: 'number', unit: '°', min: 0, max: 359, step: 1, default: 225 }, { key: 'windSpeed', label: 'Reference speed', type: 'number', unit: 'm/s', min: 0.5, max: 30, step: 0.5, default: 5 }, height('referenceHeight', 'Reference height', 10)] },
      { title: 'Domain', fields: [grid(1, 0.5, 5), height('evaluationHeight', 'Evaluation height', 1.5), context] }],
    animation: { axis: 'direction', label: 'Wind direction', min: 0, max: 337.5, step: 22.5, format: deg }, legend: { label: 'Wind speed ratio', unit: '×', ramp: 'cool', min: 0, max: 2 } },
  vent: { name: 'Natural ventilation', category: 'interior',
    groups: [{ title: 'Openings', fields: [{ key: 'openingFraction', label: 'Operable fraction', type: 'number', min: 0, max: 1, step: 0.05, default: 0.5 }, { key: 'dischargeCoefficient', label: 'Discharge coefficient', type: 'number', min: 0.3, max: 1, step: 0.01, default: 0.6 }] },
      { title: 'Scenario', fields: [{ key: 'windSpeed', label: 'Wind speed', type: 'number', unit: 'm/s', min: 0, max: 20, step: 0.5, default: 3 }, { key: 'windDirection', label: 'Wind from', type: 'number', unit: '°', min: 0, max: 359, step: 1, default: 225 }, { key: 'indoorTemp', label: 'Indoor temperature', type: 'number', unit: '°C', min: 10, max: 35, step: 0.5, default: 24 }, { key: 'outdoorTemp', label: 'Outdoor temperature', type: 'number', unit: '°C', min: -20, max: 40, step: 0.5, default: 18 }] }],
    animation: hours(0, 23), legend: { label: 'Air changes', unit: 'ACH', ramp: 'cool', min: 0, max: 20 } },
  stormwater: { name: 'Stormwater & waterlogging', category: 'building',
    groups: [{ title: 'Design storm', fields: [{ key: 'rainfallIntensity', label: 'Rainfall intensity', type: 'number', unit: 'mm/h', min: 1, max: 300, step: 1, default: 50 }, { key: 'duration', label: 'Duration', type: 'number', unit: 'min', min: 5, max: 1440, step: 5, default: 60 }] },
      { title: 'Surfaces', fields: [{ key: 'roofRunoff', label: 'Roof runoff coefficient', type: 'number', min: 0, max: 1, step: 0.05, default: 0.9 }, { key: 'groundRunoff', label: 'Ground runoff coefficient', type: 'number', min: 0, max: 1, step: 0.05, default: 0.35 }, grid(1)] }],
    animation: { axis: 'minute', label: 'Storm time', min: 0, max: 120, step: 5, format: (v) => `${Math.round(v)} min` }, legend: { label: 'Ponding depth', unit: 'mm', ramp: 'cool', min: 0, max: 100 } },
  acoustics: { name: 'Indoor acoustics', category: 'interior',
    groups: [{ title: 'Room', fields: [{ key: 'frequencyBand', label: 'Frequency band', type: 'select', options: [['125', '125 Hz'], ['250', '250 Hz'], ['500', '500 Hz'], ['1000', '1 kHz'], ['2000', '2 kHz'], ['4000', '4 kHz']], default: '500' }, { key: 'occupied', label: 'Occupied room', type: 'toggle', default: false }] },
      { title: 'Source and receiver', fields: [{ key: 'sourceLevel', label: 'Source level', type: 'number', unit: 'dB', min: 40, max: 120, step: 1, default: 70 }, height('receiverHeight', 'Receiver height', 1.2)] }],
    animation: null, legend: { label: 'Reverberation time', unit: 's', ramp: 'heat', min: 0, max: 3 } },
  spacesyntax: { name: 'Space syntax', category: 'interior',
    groups: [{ title: 'Graph', fields: [grid(0.5, 0.25, 2), { key: 'measure', label: 'Measure', type: 'select', options: [['integration', 'Visual integration'], ['connectivity', 'Connectivity'], ['clustering', 'Clustering']], default: 'integration' }, { key: 'radius', label: 'Radius', type: 'select', options: [['n', 'Global (n)'], ['3', '3 steps']], default: 'n' }] }],
    animation: null, legend: { label: 'Integration', unit: '', ramp: 'heat' } },
  movementdepth: { name: 'Movement & spatial depth', category: 'interior',
    groups: [{ title: 'Depth', fields: [grid(0.5, 0.25, 2), { key: 'depthType', label: 'Depth', type: 'select', options: [['topological', 'Topological (steps)'], ['metric', 'Metric (m)']], default: 'topological' }] }],
    animation: null, legend: { label: 'Depth from origin', unit: 'steps', ramp: 'cool' } },
  evac: { name: 'Circulation', category: 'interior',
    groups: [{ title: 'People', fields: [{ key: 'walkingSpeed', label: 'Walking speed', type: 'number', unit: 'm/s', min: 0.3, max: 2, step: 0.05, default: 1.2 }, { key: 'occupantDensity', label: 'Occupant density', type: 'number', unit: 'm²/person', min: 0.5, max: 50, step: 0.5, default: 10 }] },
      { title: 'Grid', fields: [grid(0.5, 0.25, 2)] }],
    animation: { axis: 'second', label: 'Elapsed time', min: 0, max: 180, step: 5, format: (v) => `${Math.round(v)} s` }, legend: { label: 'Walking time', unit: 's', ramp: 'heat', min: 0, max: 180 } },
  isovist: { name: 'Isovist safety', category: 'interior',
    groups: [{ title: 'Observer', fields: [height('observerHeight', 'Eye height', 1.6), { key: 'fieldOfView', label: 'Field of view', type: 'number', unit: '°', min: 30, max: 360, step: 5, default: 360 }, { key: 'range', label: 'Range', type: 'number', unit: 'm', min: 2, max: 200, step: 1, default: 50 }] }],
    animation: { axis: 'bearing', label: 'View bearing', min: 0, max: 355, step: 5, format: deg }, legend: { label: 'Visible area', unit: 'm²', ramp: 'cool' } },
  views: { name: 'View analysis', category: 'interior',
    groups: [{ title: 'Viewers', fields: [height('viewHeight', 'Eye height', 1.2), grid(0.5, 0.25, 2)] },
      { title: 'Targets', fields: [{ key: 'target', label: 'View target', type: 'select', options: [['sky', 'Sky'], ['landscape', 'Landscape layer'], ['any', 'Any outside view']], default: 'any' }, { key: 'viewAngle', label: 'Horizontal angle', type: 'number', unit: '°', min: 30, max: 360, step: 5, default: 360 }] }],
    animation: null, legend: { label: 'View to outside', unit: '%', ramp: 'cool', min: 0, max: 100 } },
  wayfinding: { name: 'Wayfinding', category: 'interior',
    groups: [{ title: 'Signs and decisions', fields: [height('eyeHeight', 'Eye height', 1.6), { key: 'signRange', label: 'Sign legibility range', type: 'number', unit: 'm', min: 2, max: 60, step: 1, default: 20 }, { key: 'decisionAngle', label: 'Decision angle', type: 'number', unit: '°', min: 15, max: 90, step: 5, default: 30 }] }],
    animation: null, legend: { label: 'Signs visible', unit: '', ramp: 'cool' } },
  privacy: { name: 'Privacy', category: 'interior',
    groups: [{ title: 'Observers', fields: [height('observerHeight', 'Outside eye height', 1.6), { key: 'distanceThreshold', label: 'Overlooking distance', type: 'number', unit: 'm', min: 2, max: 100, step: 1, default: 18 }] }],
    animation: null, legend: { label: 'Exposure to outside view', unit: '%', ramp: 'heat', min: 0, max: 100 } },
  cameras: { name: 'Camera coverage', category: 'interior',
    groups: [{ title: 'Cameras', fields: [{ key: 'fov', label: 'Field of view', type: 'number', unit: '°', min: 20, max: 180, step: 5, default: 90 }, { key: 'range', label: 'Range', type: 'number', unit: 'm', min: 2, max: 60, step: 1, default: 15 }, height('mountHeight', 'Mount height', 2.7)] }],
    animation: { axis: 'pan', label: 'Camera pan', min: -90, max: 90, step: 5, format: deg }, legend: { label: 'Cameras covering', unit: '', ramp: 'cool', min: 0, max: 4 } },
  structure: { name: 'Structural analysis', category: 'building',
    groups: [{ title: 'Loads', fields: [{ key: 'deadLoad', label: 'Superimposed dead load', type: 'number', unit: 'kN/m²', min: 0, max: 20, step: 0.1, default: 1.5 }, { key: 'liveLoad', label: 'Live load', type: 'number', unit: 'kN/m²', min: 0, max: 20, step: 0.1, default: 2.4 }, { key: 'loadCase', label: 'Combination', type: 'select', options: [['uls', 'Ultimate (ULS)'], ['sls', 'Serviceability (SLS)']], default: 'uls' }] },
      { title: 'Checks', fields: [{ key: 'deflectionLimit', label: 'Deflection limit L/', type: 'number', min: 120, max: 600, step: 10, default: 360 }] }],
    animation: { axis: 'scale', label: 'Deflection scale', min: 0, max: 100, step: 5, format: (v) => `×${Math.round(v)}` }, legend: { label: 'Utilisation', unit: '', ramp: 'diverging', min: 0, max: 1.5 } },
  climate: { name: 'Climate Analysis', category: 'table',
    groups: [{ title: 'Chart', fields: [{ key: 'chart', label: 'Show', type: 'select', options: [['temperature', 'Temperature'], ['humidity', 'Humidity'], ['windrose', 'Wind rose'], ['radiation', 'Radiation']], default: 'temperature' }] },
      { title: 'Filter', fields: [{ key: 'startMonth', label: 'From month', type: 'number', min: 1, max: 12, step: 1, default: 1 }, { key: 'endMonth', label: 'To month', type: 'number', min: 1, max: 12, step: 1, default: 12 }, { key: 'comfortLow', label: 'Comfort band low', type: 'number', unit: '°C', min: 10, max: 25, step: 0.5, default: 18 }, { key: 'comfortHigh', label: 'Comfort band high', type: 'number', unit: '°C', min: 18, max: 32, step: 0.5, default: 26 }] }],
    animation: months, legend: { label: 'Dry-bulb temperature', unit: '°C', ramp: 'diverging', min: -20, max: 40 } },
  passive: { name: 'Passive Design Strategies', category: 'table',
    groups: [{ title: 'Strategies', fields: [{ key: 'thermalMass', label: 'Thermal mass', type: 'toggle', default: true }, { key: 'nightFlush', label: 'Night flushing', type: 'toggle', default: true }, { key: 'evaporative', label: 'Evaporative cooling', type: 'toggle', default: false }, { key: 'passiveSolar', label: 'Passive solar heating', type: 'toggle', default: true }] },
      { title: 'Comfort band', fields: [{ key: 'comfortLow', label: 'Low', type: 'number', unit: '°C', min: 10, max: 25, step: 0.5, default: 20 }, { key: 'comfortHigh', label: 'High', type: 'number', unit: '°C', min: 18, max: 32, step: 0.5, default: 26 }] }],
    animation: months, legend: { label: 'Hours helped', unit: '%', ramp: 'cool', min: 0, max: 100 } },
  skyview: { name: 'Sky Exposure & Solar Mask', category: 'building',
    groups: [{ title: 'Samples', fields: [grid(1.34, 0.25, 5), height('sampleHeight', 'Sample height', 0.78), { key: 'rayCount', label: 'Rays per point', type: 'select', options: [['96', '96'], ['192', '192'], ['384', '384']], default: '192' }, context] },
      { title: 'Solar mask', fields: [{ key: 'maskDate', label: 'Mask date', type: 'date', default: '2026-06-21' }] }],
    animation: { ...hours(4, 22), label: 'Sun on mask' }, legend: { label: 'Sky exposure', unit: '%', ramp: 'cool', min: 0, max: 100 } },
  shadebenefit: { name: 'Shade Benefit', category: 'building',
    groups: [{ title: 'Evaluation', fields: [grid(1), height('sampleHeight', 'Sample height', 0.8), context] },
      { title: 'Temperature weighting', fields: [{ key: 'balanceTemp', label: 'Balance temperature', type: 'number', unit: '°C', min: 10, max: 30, step: 0.5, default: 18 }, { key: 'startMonth', label: 'From month', type: 'number', min: 1, max: 12, step: 1, default: 1 }, { key: 'endMonth', label: 'To month', type: 'number', min: 1, max: 12, step: 1, default: 12 }] }],
    animation: months, legend: { label: 'Shade benefit', unit: '°C·h', ramp: 'diverging' } },
  solarenvelope: { name: 'Solar Envelope', category: 'building',
    groups: [{ title: 'Protected sun', fields: [{ key: 'date', label: 'Protected date', type: 'date', default: '2026-12-21' }, { key: 'startTime', label: 'From', type: 'time', default: '10:00' }, { key: 'endTime', label: 'Until', type: 'time', default: '14:00' }] },
      { title: 'Envelope', fields: [grid(2, 0.5, 10), { key: 'maxHeight', label: 'Height cap', type: 'number', unit: 'm', min: 3, max: 300, step: 1, default: 45 }] }],
    animation: { ...hours(8, 16), label: 'Protected hour' }, legend: { label: 'Allowed height', unit: 'm', ramp: 'heat' } },
};

export const STUDY_IDS = Object.keys(SCHEMAS);
export const defaultsFor = (simId) => Object.fromEntries((SCHEMAS[simId]?.groups || []).flatMap((g) => g.fields).map((f) => [f.key, f.default]));
// Global parameters are rejected at this boundary so they can never render in a simulation panel.
export const GLOBAL_KEYS = ['lat', 'lon', 'latitude', 'longitude', 'north', 'trueNorth', 'tz', 'timeZone', 'epw', 'weather', 'site', 'address', 'program', 'useTemplate', 'projectDefaults'];
export function localOnly(params = {}) { return Object.fromEntries(Object.entries(params).filter(([k]) => !GLOBAL_KEYS.includes(k))); }
