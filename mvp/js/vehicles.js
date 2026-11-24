// Vehicles for the swept-path study (2026-11-18). Reference presets with typical dimensions for early design: they are NOT
// manufacturer specifications or a jurisdiction's design vehicles; check the vehicle the project must serve and edit the values.
// Metres and degrees. A rigid vehicle: wheelbase (front axle to the rear axle, or the centre of a tandem), front and rear
// overhang, width, track (wheel centre to wheel centre), maximum steering angle, lock-to-lock time (s) and speed (km/h) for the
// steering rate. An articulated one adds the trailer: hitch offset (fifth wheel ahead of the tractor's rear axle, +), kingpin to
// trailer axle, trailer front overhang (ahead of the kingpin), trailer rear overhang (behind its axle), width, maximum articulation.
export const PRESETS = [
  { id: 'car', name: 'Passenger car', kind: 'rigid', length: 4.9, width: 1.85, wheelbase: 2.9, frontOverhang: 0.95, rearOverhang: 1.05, track: 1.6, steer: 35, lockTime: 4, speed: 8, clearance: 0.3 },
  { id: 'suv', name: 'SUV', kind: 'rigid', length: 5.0, width: 2.0, wheelbase: 3.0, frontOverhang: 0.95, rearOverhang: 1.05, track: 1.7, steer: 33, lockTime: 4, speed: 8, clearance: 0.3 },
  { id: 'pickup', name: 'Pickup truck', kind: 'rigid', length: 5.9, width: 2.03, wheelbase: 3.7, frontOverhang: 0.95, rearOverhang: 1.25, track: 1.72, steer: 33, lockTime: 4, speed: 8, clearance: 0.3 },
  { id: 'van', name: 'Delivery van', kind: 'rigid', length: 6.0, width: 2.05, wheelbase: 3.66, frontOverhang: 0.95, rearOverhang: 1.39, track: 1.75, steer: 34, lockTime: 4, speed: 8, clearance: 0.3 },
  { id: 'box', name: 'Box truck', kind: 'rigid', length: 7.5, width: 2.45, wheelbase: 4.3, frontOverhang: 1.2, rearOverhang: 2.0, track: 2.0, steer: 38, lockTime: 6, speed: 8, clearance: 0.3 },
  { id: 'mrv', name: 'Medium rigid truck', kind: 'rigid', length: 8.8, width: 2.5, wheelbase: 5.0, frontOverhang: 1.5, rearOverhang: 2.3, track: 2.0, steer: 38, lockTime: 6, speed: 8, clearance: 0.3 },
  { id: 'hrv', name: 'Heavy rigid truck', kind: 'rigid', length: 12.5, width: 2.5, wheelbase: 6.5, frontOverhang: 1.5, rearOverhang: 4.5, track: 2.0, steer: 38, lockTime: 6, speed: 8, clearance: 0.3 },
  { id: 'mixer', name: 'Concrete mixer', kind: 'rigid', length: 8.28, width: 2.44, wheelbase: 5.38, frontOverhang: 1.32, rearOverhang: 1.58, track: 2.44, steer: 35.4, lockTime: 6, speed: 8, clearance: 0.3, note: 'after the mixer in the reference drawing' },
  { id: 'fire', name: 'Fire truck', kind: 'rigid', length: 10.0, width: 2.5, wheelbase: 5.0, frontOverhang: 1.8, rearOverhang: 3.2, track: 2.1, steer: 40, lockTime: 5, speed: 8, clearance: 0.3 },
  { id: 'bus', name: 'Bus', kind: 'rigid', length: 12.2, width: 2.55, wheelbase: 7.6, frontOverhang: 2.7, rearOverhang: 1.9, track: 2.1, steer: 42, lockTime: 6, speed: 8, clearance: 0.3 },
  { id: 'semi', name: 'Semi-trailer (WB-20 type)', kind: 'artic', length: 22.7, width: 2.6, wheelbase: 6.2, frontOverhang: 0.8, rearOverhang: 1.0, track: 2.6, steer: 28.2, lockTime: 6, speed: 8, clearance: 0.3,
    trailer: { hitch: 0.0, wheelbase: 12.4, frontOverhang: 1.3, rearOverhang: 3.3, width: 2.6, track: 2.6, maxArticulation: 70 }, note: 'after the WB-20 shown in the reference drawing: tractor 6.20, trailer 12.40 kingpin to axle, 17.00 long' },
  // (2026-11-24) a jurisdiction's published design vehicle: the STAA Design Vehicle of the Caltrans Highway Design Manual, Topic 404,
  // Figure 404.5A (page 400-19, July 1, 2020; chapter 400 as updated 29 Sep 2023), feet × 0.3048: front overhang 4', tractor
  // wheelbase 23', kingpin 0' ahead of the tractor's rear axle, trailer 48' long (3' ahead of the kingpin, 41' kingpin to the rear
  // axle, 4' behind it), widths and tracks 8.5', steering lock angle 26.3°, lock-to-lock 6 s, articulating angle 70°. Not dimensioned
  // in the figure: the tractor's frame behind its rear axle (0.6 m assumed, under the trailer). Index 404.4(1)(b) gives a 43' KPRA
  // where the figure draws 41': the figure is used, since its parts add up to the 48' trailer.
  { id: 'staa', name: 'STAA design vehicle (Caltrans HDM Fig. 404.5A)', kind: 'artic', length: 21.946, width: 2.591, wheelbase: 7.010, frontOverhang: 1.219, rearOverhang: 0.6, track: 2.591, steer: 26.3, lockTime: 6, speed: 8, clearance: 0.3,
    trailer: { hitch: 0.0, wheelbase: 12.497, frontOverhang: 0.914, rearOverhang: 1.219, width: 2.591, track: 2.591, maxArticulation: 70 }, source: 'Caltrans Highway Design Manual, Figure 404.5A (STAA Design Vehicle)', note: 'a published design vehicle: Caltrans HDM Figure 404.5A, 72 ft overall; check the vehicle your jurisdiction requires' },
];
export const CUSTOM_BASE = { id: 'custom', name: 'Custom vehicle', kind: 'rigid', length: 7.0, width: 2.4, wheelbase: 4.0, frontOverhang: 1.2, rearOverhang: 1.8, track: 2.0, steer: 36, lockTime: 5, speed: 8, clearance: 0.3 };
export const PRESET_NOTE = 'Reference presets with typical dimensions for early design, not manufacturer specifications or a jurisdiction’s design vehicles.';

const DEG = Math.PI / 180;
/** the turning radius of the rear-axle centre at full lock (m) */
export const rMin = (v) => v.wheelbase / Math.tan(v.steer * DEG);
/** the radius swept by the outer front corner at full lock (m) */
export const rOuter = (v) => Math.hypot(rMin(v) + v.width / 2, v.wheelbase + v.frontOverhang);

/** problems with a profile, in words (empty when it can be simulated) */
export function check(v) { const e = [], pos = (k, n) => { if (!(+v[k] > 0)) e.push(`${n} must be more than 0`); };
  pos('width', 'Width'); pos('wheelbase', 'Wheelbase'); pos('track', 'Track'); pos('lockTime', 'Lock-to-lock time'); pos('speed', 'Speed');
  if (!(+v.frontOverhang >= 0) || !(+v.rearOverhang >= 0)) e.push('Overhangs cannot be negative');
  if (!(+v.steer > 1 && +v.steer < 70)) e.push('Steering angle must be between 1° and 70°');
  if (+v.track > +v.width + 1e-9) e.push('Track cannot be wider than the vehicle');
  if (v.kind === 'artic') { const t = v.trailer || {}; if (!(+t.wheelbase > 0)) e.push('Trailer wheelbase must be more than 0'); if (!(+t.width > 0)) e.push('Trailer width must be more than 0'); if (!(+t.maxArticulation > 5 && +t.maxArticulation < 90)) e.push('Maximum articulation must be between 5° and 90°'); }
  return e; }
/** the length implied by the parts (rigid: overhangs and wheelbase; articulated: the tractor's front to the trailer's rear) */
export function overallLength(v) { if (v.kind !== 'artic') return v.frontOverhang + v.wheelbase + v.rearOverhang; const t = v.trailer; return Math.max(v.frontOverhang + v.wheelbase + v.rearOverhang, v.frontOverhang + v.wheelbase - t.hitch + t.wheelbase + t.rearOverhang); }

// ---- the account's own vehicles, kept in this browser like the furniture library
const KEY = 'pc-vehicles';
export function loadCustom() { try { const l = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; } }
export function saveCustom(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; } }
export const all = () => [...PRESETS, ...loadCustom()];
export const byId = (id) => all().find((v) => v.id === id) || null;
export function duplicate(v, name) { return { ...JSON.parse(JSON.stringify(v)), id: 'veh_' + Math.random().toString(36).slice(2, 9), name: name || v.name + ' (copy)', custom: true }; }
