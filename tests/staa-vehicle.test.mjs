// The STAA design vehicle preset (2026-11-24) against its source, Caltrans Highway Design Manual Figure 404.5A (page 400-19):
// dimensions in feet × 0.3048, 72 ft overall, steering lock 26.3°; the outside front wheel at full lock on the figure's
// 56.16 ft radius within 1 %; it drives a 30 m circle in the swept-path engine with the trailer axle on √(R² − Lt²).
import assert from 'node:assert/strict';
import * as V from '../mvp/js/vehicles.js';
import * as S from '../mvp/js/swept-path.js';
const ft = 0.3048, v = V.byId('staa'), near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
assert(v && v.kind === 'artic', 'the preset exists'); assert.deepEqual(V.check(v), [], 'it can be simulated');
near(v.frontOverhang, 4 * ft, 5e-4, 'front overhang 4 ft'); near(v.wheelbase, 23 * ft, 5e-4, 'tractor wheelbase 23 ft'); near(v.width, 8.5 * ft, 5e-4, 'width 8.5 ft'); near(v.track, 8.5 * ft, 5e-4, 'track 8.5 ft');
assert.equal(v.steer, 26.3); assert.equal(v.lockTime, 6); assert.equal(v.trailer.maxArticulation, 70); assert.equal(v.trailer.hitch, 0);
near(v.trailer.wheelbase, 41 * ft, 5e-4, 'kingpin to rear axle 41 ft'); near(v.trailer.frontOverhang, 3 * ft, 5e-4, 'trailer ahead of the kingpin 3 ft'); near(v.trailer.rearOverhang, 4 * ft, 5e-4, 'behind the axle 4 ft');
near(v.trailer.frontOverhang + v.trailer.wheelbase + v.trailer.rearOverhang, 48 * ft, 1e-3, 'trailer 48 ft'); near(V.overallLength(v), 72 * ft, 1e-3, 'overall 72 ft');
const rOut = Math.hypot(V.rMin(v) + v.track / 2, v.wheelbase);   // the outside front wheel at full lock
near(rOut / (56.16 * ft), 1, 0.01, 'outside wheel radius vs the figure\'s 56.16 ft');
const arc = (R, n) => [...Array(n + 1)].map((_, i) => { const a = (i / n) * 1.5 * Math.PI; return [R * Math.sin(a), R - R * Math.cos(a)]; });
const R = 30, run = S.simulate(v, { pts: arc(R, 720) }, { quality: 'standard' }); assert(run.ok, run.error);
const Lt = v.trailer.wheelbase, want = Math.sqrt(R * R - Lt * Lt);
const tail = run.poses.filter((p) => p.s > run.length - 20 && p.s < run.length - 3).map((p) => { const w = S.shapesAt(v, p).wheels; return Math.hypot((w.TL[0] + w.TR[0]) / 2, (w.TL[1] + w.TR[1]) / 2 - R); });   /* the circle's centre is (0, R) */
const err = Math.max(...tail.map((r) => Math.abs(r - want))); assert(tail.length > 5 && err < 0.02, 'trailer axle radius off by ' + err); const ta = tail.at(-1);
console.log(`PASS STAA design vehicle (Caltrans HDM Fig. 404.5A): 72 ft overall, outside front wheel ${(rOut / ft).toFixed(2)} ft at full lock vs 56.16 ft in the figure (${((rOut / (56.16 * ft) - 1) * 100).toFixed(1)} %); drives a ${R} m circle; trailer axle at ${ta.toFixed(3)} m vs √(R² − Lt²) = ${want.toFixed(3)} m`);
