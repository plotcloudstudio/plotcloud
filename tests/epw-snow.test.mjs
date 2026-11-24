// EPW snow and precipitation fields (2026-11-24), EnergyPlus EPW Data Dictionary 9.6: N30 snow depth (cm, missing 999) is the
// 31st column, N31 days since last snowfall (missing 99) the 32nd, N33 liquid precipitation depth (mm, missing 999) the 34th.
// A synthetic year: values and missing codes read back at the right hours; a file whose lines stop before these columns reads NaN.
import assert from 'node:assert/strict';
import { parseEPW } from '../emb/lib/climate.js';
const head = ['LOCATION,Test,ON,CAN,TMYx,000000,43.6,-79.4,-5.0,77', 'DESIGN CONDITIONS,0', 'TYPICAL/EXTREME PERIODS,0', 'GROUND TEMPERATURES,0', 'HOLIDAYS/DAYLIGHT SAVINGS,No,0,0,0', 'COMMENTS 1,', 'COMMENTS 2,', 'DATA PERIODS,1,1,Data,Sunday, 1/ 1,12/31'];
const MD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function year(cols, at) { const L = []; let k = 0; for (let m = 1; m <= 12; m++) for (let d = 1; d <= MD[m - 1]; d++) for (let h = 1; h <= 24; h++, k++) {
  const c = [2020, m, d, h, 60, 'A7', -5, -8, 80, 101000, 0, 0, 300, 0, 0, 0, 0, 0, 0, 0, 270, 4, 5, 5, 16, 1000, 0, 999999999, 5, 0.1, 0, 88, 0.2, 0, 0];
  at(k, c); L.push(c.slice(0, cols).join(',')); } return [...head, ...L].join('\n'); }
const E = parseEPW(year(35, (k, c) => { if (k === 10) { c[30] = 12; c[31] = 0; c[33] = 1.4; } if (k === 11) { c[30] = 999; c[31] = 99; c[33] = 999; } if (k === 12) { c[30] = ''; c[33] = ''; } }));
assert.equal(E.SND[10], 12, 'snow depth, column 31'); assert.equal(E.DSS[10], 0, 'days since last snowfall, column 32'); assert(Math.abs(E.PRC[10] - 1.4) < 1e-6, 'precipitation, column 34');
assert(Number.isNaN(E.SND[11]) && Number.isNaN(E.DSS[11]) && Number.isNaN(E.PRC[11]), 'missing codes 999 / 99 read as missing');
assert(Number.isNaN(E.SND[12]) && Number.isNaN(E.PRC[12]), 'blank fields read as missing');
assert.equal(E.SND[0], 0); assert.equal(E.DSS[0], 88); assert.equal(E.PRC[0], 0); assert(Math.abs(E.ALB[0] - 0.2) < 1e-6, 'albedo still column 33');
const short = parseEPW(year(30, () => {})); assert(Number.isNaN(short.SND[0]) && Number.isNaN(short.PRC[0]), 'a file without these columns: missing');
console.log('PASS EPW snow depth (col 31), days since snowfall (col 32), precipitation (col 34): values, missing codes 999/99, blank fields, short lines');
