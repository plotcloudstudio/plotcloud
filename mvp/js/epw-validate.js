// EPW structure and field checks (replan item 07, plan §6.6, AC06). Pure: the same checks run in the browser and in tests.
// Follows the EnergyPlus EPW data dictionary: 8 header lines, DATA PERIODS gives records per hour, data rows are local standard
// time with hour 1–24, and each field has its own "missing" value. Nothing is filled or truncated here: a leap year stays 8784
// hours, a missing value stays missing, and each study is blocked only by the fields it needs.
export const FIELDS = {
  dryBulb: { col: 6, missing: (v) => v >= 99.9, min: -70, max: 70, unit: '°C' },
  dewPoint: { col: 7, missing: (v) => v >= 99.9, min: -70, max: 70, unit: '°C' },
  relHumidity: { col: 8, missing: (v) => v >= 999, min: 0, max: 110, unit: '%' },
  pressure: { col: 9, missing: (v) => v >= 999999, min: 31000, max: 120000, unit: 'Pa' },
  ghi: { col: 13, missing: (v) => v >= 9999, min: 0, max: 1500, unit: 'Wh/m²' },
  dni: { col: 14, missing: (v) => v >= 9999, min: 0, max: 1500, unit: 'Wh/m²' },
  dhi: { col: 15, missing: (v) => v >= 9999, min: 0, max: 1000, unit: 'Wh/m²' },
  windDir: { col: 20, missing: (v) => v >= 999, min: 0, max: 360, unit: '°' },
  windSpeed: { col: 21, missing: (v) => v >= 999, min: 0, max: 40, unit: 'm/s' },
};
// The fields each existing study reads from the file (engines in emb/ and mvp/js/environment).
export const STUDY_FIELDS = {
  climate: ['dryBulb', 'relHumidity', 'windDir', 'windSpeed', 'ghi'], passive: ['dryBulb', 'relHumidity'],
  radiation: ['ghi', 'dni', 'dhi'], utci: ['dryBulb', 'relHumidity', 'windSpeed', 'ghi', 'dni', 'dhi'],
  wind: ['windDir', 'windSpeed'], vent: ['dryBulb', 'windDir', 'windSpeed'], daylight: ['ghi', 'dni', 'dhi'], shadebenefit: ['dryBulb'],
};
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function validateEpw(text) {
  const errors = [], warnings = [], lines = String(text).replace(/\s+$/, '').split(/\r?\n/);
  const head = (lines[0] || '').split(',');
  if (head[0] !== 'LOCATION' || head.length < 10) return { ok: false, errors: ['The first line must be an EPW LOCATION record.'], warnings };
  const location = { city: head[1], region: head[2], country: head[3], source: head[4], wmo: head[5], lat: +head[6], lon: +head[7], utcOffset: +head[8], elevation: +head[9] };
  if (![location.lat, location.lon, location.utcOffset, location.elevation].every(Number.isFinite) || Math.abs(location.lat) > 90 || Math.abs(location.lon) > 180 || Math.abs(location.utcOffset) > 14) errors.push('LOCATION coordinates, time zone or elevation are invalid.');
  const dp = lines.slice(1, 8).find((l) => l.startsWith('DATA PERIODS'));
  let perHour = 1, periods = null;
  if (dp) { const a = dp.split(','); perHour = +a[2] || 1; periods = { count: +a[1], perHour, label: a[3], startDay: a[4], start: a[5], end: a[6] }; }
  else warnings.push('No DATA PERIODS header line; one record per hour assumed.');
  const rows = lines.slice(8).filter((l) => l.trim() !== '');
  if (perHour !== 1) return { ok: false, errors: [`This file has ${perHour} records per hour. Hourly studies need a 60-minute file; the original was not resampled.`], warnings, location, periods, records: rows.length };
  const hours = rows.length, leap = hours === 8784;
  if (hours !== 8760 && hours !== 8784) return { ok: false, errors: [`A full year needs 8760 or 8784 hourly records; this file has ${hours}. Partial-year files are not run.`], warnings, location, periods, records: hours };
  const fields = Object.fromEntries(Object.keys(FIELDS).map((k) => [k, { missing: 0, outOfRange: 0, firstMissing: null }]));
  const seen = new Set(); let gaps = 0, dupes = 0, badRows = 0, i = 0, firstGap = null;
  // expected calendar: Jan 1 hour 1 … Dec 31 hour 24, with Feb 29 only in an 8784-hour file
  const days = leap ? DAYS.map((d, m) => (m === 1 ? 29 : d)) : DAYS;
  for (let m = 0; m < 12; m++) for (let d = 1; d <= days[m]; d++) for (let h = 1; h <= 24; h++) {
    const a = rows[i].split(','), mm = +a[1], dd = +a[2], hh = +a[3];
    if (a.length < 22) badRows++;
    const key = mm + '/' + dd + '/' + hh;
    if (seen.has(key)) dupes++; seen.add(key);
    if (mm !== m + 1 || dd !== d || hh !== h) { gaps++; if (!firstGap) firstGap = `record ${i + 9}: expected ${m + 1}/${d} hour ${h}, found ${mm}/${dd} hour ${hh}`; }
    for (const [k, f] of Object.entries(FIELDS)) {
      const raw = a[f.col], v = raw === undefined || raw.trim() === '' ? NaN : +raw, s = fields[k];
      if (!Number.isFinite(v) || f.missing(v)) { s.missing++; if (!s.firstMissing) s.firstMissing = i + 9; }
      else if (v < f.min || v > f.max) s.outOfRange++;
    }
    i++;
  }
  if (badRows) errors.push(`${badRows} records have fewer than 22 fields.`);
  if (dupes) errors.push(`${dupes} duplicate date/hour records.`);
  if (gaps) errors.push(`The hourly sequence is not continuous (${gaps} records out of place; first at ${firstGap}).`);
  const years = new Set(rows.map((r) => r.split(',')[0])); if (years.size > 1) warnings.push(`Records come from ${years.size} source years (typical-year files mix months); dates are read as month/day/hour.`);
  for (const [k, s] of Object.entries(fields)) { if (s.missing) warnings.push(`${k}: ${s.missing} of ${hours} hours missing (kept missing, never set to zero).`); if (s.outOfRange) warnings.push(`${k}: ${s.outOfRange} values outside ${FIELDS[k].min}–${FIELDS[k].max} ${FIELDS[k].unit}.`); }
  const blocked = {};
  for (const [study, need] of Object.entries(STUDY_FIELDS)) { const miss = need.filter((k) => fields[k].missing === hours || fields[k].missing / hours > 0.1); if (miss.length) blocked[study] = miss; }
  return { ok: !errors.length, errors, warnings, location, periods, hours, leap, fields, blocked };
}
// A compact record kept with the project's weather (no per-hour data).
export const qualitySummary = (r) => ({ hours: r.hours, leap: r.leap, periods: r.periods, fields: Object.fromEntries(Object.entries(r.fields).map(([k, s]) => [k, { missing: s.missing, outOfRange: s.outOfRange }])), blocked: r.blocked, warnings: r.warnings.slice(0, 12), checker: 'plotcloud-epw-validate@2026-10-30' });
