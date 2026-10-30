// Use-type templates (replan item 07, plan §6.3, AC09). Each template is a fixed, versioned set of values copied into a project;
// later template versions never change a project silently (project-contract.upgradeProgram).
// Source of every value: PlotCloud concept assumptions for early design comparison. They are NOT taken from a code, standard
// or regional library and are not a compliance basis; replace them with project data or a reviewed library when available.
// Schedules are fractions 0–1 per hour (hour 1 = 00:00–01:00 local standard time, the EPW convention).
const H = (spec) => { const a = Array(24).fill(spec.base ?? 0); for (const [from, to, v] of spec.blocks || []) for (let h = from; h < to; h++) a[h] = v; return a; };
const office = { weekday: H({ base: 0, blocks: [[7, 8, 0.2], [8, 12, 0.95], [12, 13, 0.5], [13, 17, 0.95], [17, 18, 0.3], [18, 20, 0.1]] }), saturday: H({ base: 0, blocks: [[9, 13, 0.1]] }), sunday: H({ base: 0 }) };
const officeLight = { weekday: H({ base: 0.05, blocks: [[7, 8, 0.3], [8, 18, 0.9], [18, 20, 0.3]] }), saturday: H({ base: 0.05, blocks: [[9, 13, 0.3]] }), sunday: H({ base: 0.05 }) };
const officeEquip = { weekday: H({ base: 0.3, blocks: [[8, 18, 0.9], [18, 20, 0.5]] }), saturday: H({ base: 0.3, blocks: [[9, 13, 0.5]] }), sunday: H({ base: 0.3 }) };
const homeOcc = H({ base: 1, blocks: [[8, 9, 0.5], [9, 17, 0.25], [17, 18, 0.6]] }), homeWeekend = H({ base: 1, blocks: [[10, 18, 0.6]] });
const homeLight = H({ base: 0.02, blocks: [[6, 8, 0.4], [17, 23, 0.7]] }), homeEquip = H({ base: 0.35, blocks: [[6, 9, 0.6], [17, 23, 0.8]] });
const schoolOcc = { weekday: H({ base: 0, blocks: [[8, 12, 0.9], [12, 13, 0.6], [13, 15, 0.9], [15, 17, 0.2]] }), saturday: H({ base: 0 }), sunday: H({ base: 0 }) };
const schoolLight = { weekday: H({ base: 0.05, blocks: [[7, 17, 0.85]] }), saturday: H({ base: 0.05 }), sunday: H({ base: 0.05 }) };
const schoolEquip = { weekday: H({ base: 0.2, blocks: [[8, 16, 0.8]] }), saturday: H({ base: 0.2 }), sunday: H({ base: 0.2 }) };
const SOURCE = 'PlotCloud concept assumption for early design comparison — not from a code, standard or regional library';

export const USE_TEMPLATES = Object.freeze({
  office: { id: 'plotcloud-use-office', version: '2026-10-30.1', label: 'Office', source: SOURCE,
    values: { 'program.use': 'office', 'program.occupancyDensity': 0.06, 'program.lightingPowerDensity': 8, 'program.equipmentPowerDensity': 10, 'program.occupiedFrom': 8, 'program.occupiedUntil': 18 },
    schedules: { occupancy: office, lighting: officeLight, equipment: officeEquip }, holidays: [] },
  residential: { id: 'plotcloud-use-residential', version: '2026-10-30.1', label: 'Residential', source: SOURCE,
    values: { 'program.use': 'residential', 'program.occupancyDensity': 0.03, 'program.lightingPowerDensity': 5, 'program.equipmentPowerDensity': 4, 'program.occupiedFrom': 0, 'program.occupiedUntil': 24 },
    schedules: { occupancy: { weekday: homeOcc, saturday: homeWeekend, sunday: homeWeekend }, lighting: { weekday: homeLight, saturday: homeLight, sunday: homeLight }, equipment: { weekday: homeEquip, saturday: homeEquip, sunday: homeEquip } }, holidays: [] },
  school: { id: 'plotcloud-use-school', version: '2026-10-30.1', label: 'School', source: SOURCE,
    values: { 'program.use': 'school', 'program.occupancyDensity': 0.25, 'program.lightingPowerDensity': 9, 'program.equipmentPowerDensity': 6, 'program.occupiedFrom': 8, 'program.occupiedUntil': 16 },
    schedules: { occupancy: schoolOcc, lighting: schoolLight, equipment: schoolEquip },
    // concept northern-hemisphere term calendar: summer break and year-end break are unoccupied (schedule = sunday)
    holidays: [['07-01', '08-31'], ['12-22', '12-31'], ['01-01', '01-02']] },
});
// Unknown use or region: an explicit generic concept template, never silently the office one.
export const GENERIC = { id: 'plotcloud-use-generic', version: '2026-10-30.1', label: 'Generic concept', source: SOURCE + '; use unknown', values: { 'program.use': 'generic' }, schedules: null, holidays: [] };
export const templateFor = (use) => USE_TEMPLATES[use] || GENERIC;

const pad = (n) => String(n).padStart(2, '0');
// Day of week of an EPW month/day in a given calendar year (0 = Sunday). Typical-year files mix source years, so the
// project chooses the calendar year (default: a non-leap 2025, or 2024 for an 8784-hour file).
export const dayOfWeek = (year, month, day) => new Date(Date.UTC(year, month - 1, day)).getUTCDay();
const inHoliday = (t, month, day) => t.holidays.some(([a, b]) => { const k = pad(month) + '-' + pad(day); return k >= a && k <= b; });
export function scheduleValue(t, kind, year, month, day, hour) {
  if (!t.schedules?.[kind]) return null;
  const s = t.schedules[kind], dow = dayOfWeek(year, month, day), type = inHoliday(t, month, day) || dow === 0 ? 'sunday' : dow === 6 ? 'saturday' : 'weekday';
  return s[type][hour - 1];
}
// Hourly profile aligned with an EPW: 8760 or 8784 values, Feb 29 included only for a leap file. Never truncated.
export function annualProfile(t, kind, { hours = 8760, year = hours === 8784 ? 2024 : 2025 } = {}) {
  if (!t.schedules?.[kind]) return null;
  const leap = hours === 8784, out = [];
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (let m = 1; m <= 12; m++) for (let d = 1; d <= days[m - 1]; d++) for (let h = 1; h <= 24; h++) out.push(scheduleValue(t, kind, year, m, d, h));
  return out;
}
// Occupied-hour mask and its denominator (indicator denominators must use the same calendar as the weather).
export function occupiedHours(t, opts) { const occ = annualProfile(t, 'occupancy', opts); if (!occ) return null; const mask = occ.map((v) => v >= 0.5); return { mask, count: mask.filter(Boolean).length, of: mask.length }; }
// Lighting load for a room: explicit fixtures replace the template density (never both), per plan §5.3.
export function lightingLoad({ area, templateLpd, fixtures = [], mode = fixtures.length ? 'fixtures' : 'area' }) {
  if (!(area > 0)) throw Error('Room area must be positive.');
  if (mode === 'fixtures') { if (!fixtures.length) throw Error('Fixture mode needs at least one fixture with its input power.'); const w = fixtures.reduce((s, f) => { if (!(f.watts >= 0)) throw Error(`Fixture ${f.id || ''} has no input power.`); return s + f.watts; }, 0); return { mode, watts: w, lpd: w / area, source: 'explicit fixtures', templateIgnored: true }; }
  return { mode, watts: templateLpd * area, lpd: templateLpd, source: 'use template density' };
}
