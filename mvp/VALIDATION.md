# Engine validation: Sun hours, Daylight, Outdoor noise and Indoor acoustics (2026-10-25)

What was checked, against what, how far off the engines are, what was fixed, and where the results should not be trusted.
Every number below is produced by the scripts in `tests/validation/` (run `tests/validation/run_all.sh`; the GitHub workflow
`engine-validation.yml` runs them when an engine changes and keeps the result files). The engines are tested as they ship:
the scripts either pull the engine's own functions out of the page or drive the engine page in a real browser.

## References (none of them is PlotCloud code)

| What | Reference | Why it can be trusted |
|---|---|---|
| Sun position | NREL Solar Position Algorithm (Reda & Andreas 2004, NREL/TP-560-34302) via `pvlib.solarposition.spa_python` | Published uncertainty ±0.0003° |
| Daylight | Radiance 5 (`gensky -c` CIE standard overcast sky, `oconv`, `rtrace`), via `pyradiance` | The research and industry reference for daylight; physically based backward ray tracing |
| Daylight, cross-check | Independent numerical integral of the CIE overcast sky through the opening (600 × 600 elements) | Closed-form physics; written separately from both the engine and Radiance |
| Sun hours shadows | Exact ray–box intersection (slab test) | Geometry with an exact answer |
| Air absorption (Indoor acoustics) | ISO 9613-1:1993 table values | The international standard the engine's formula comes from |
| Reverberation time (Indoor acoustics) | Stochastic ray tracing of the room's energy decay, written for the check (`room_acoustics.cjs`) | Independent of the diffuse-field formulas it checks; seeded, so repeatable |

The two daylight references agree with each other within 0.04 DF points (within 5 %, largest at the back of the room where the values are smallest) at every point, which is the evidence that the Radiance set-up is right.

## 1. Sun position (`sun_position.py`)

Engine: `sunPos` in `emb/sunhours.html` (NOAA approximation), also used by Daylight.
Grid: 9 latitudes from 60° S to 70° N, 3 longitudes, every 7th day of 2026, every hour with the sun up: **17,014 positions**.

| | Mean error | Max error |
|---|---|---|
| Altitude | 0.003° | 0.015° |
| Azimuth (as an angle on the sky) | 0.003° | 0.012° |

Tolerance 0.1°: **passed**. The engine's own time step (Sun hours: 5–15 minutes, the sun moves 1.25–3.75°) is a far larger effect than its sun position error.

## 2. Sun hours shadows (`sun_shadow.py`)

Test: a wall 200 m long (east–west), 1 m thick, 10 m high on open ground at Vancouver (49.28° N). The engine is run as a person runs it (file in, date, Calculate). For every ground sample it makes, the reference sums the time weights of the engine's own sun directions whose ray misses the wall.

| Date | Ground samples | Mean \|difference\| | Max \|difference\| |
|---|---|---|---|
| Mar 20 | 17,568 | 0.000 h | 0.000 h |
| Dec 21 | 27,118 | 0.000 h | 0.000 h |

**Passed.** Plausibility against hand calculation: at the equinox the noon sun is 40.7° up, so the 10 m wall casts an 11.6 m shadow; the engine gives 0.84 h 10 m north of the wall (only the early and late sun gets in) and 11.83 h at 15 m (outside the noon shadow). On Dec 21 the ground within 15 m north of the wall gets no sun.

What this does not cover: the accuracy of the sun hours *distribution* depends on the time step and the grid spacing the person chooses; the geometry itself is exact.

## 3. Daylight factor (`daylight_df.py`)

Test room: 5 m wide, 6 m deep, 2.7 m high; one window 3 m wide, sill 0.9 m, head 2.1 m; work plane 0.8 m; points on the centre line 0.5–5.5 m from the window. Glass transmittance 0.6, floor 0.2, walls 0.5, ceiling 0.8, ground 0.15. Two cases: open view, and a building 10 m opposite, 8 m high.

Tolerances fixed before running: sky through the glass within max(0.2 points, 10 %) of Radiance; daylight factor within max(0.5 points, 25 %) of Radiance.

### What was found

- **The engine's sky geometry is right.** The sky seen through the opening matches the independent integral and Radiance within ±3 % at the engine's own points, and with the building opposite it finds exactly where the sky disappears (none from 2.5 m back, as both references).
- **The glass was the main error.** The engine used one transmittance for every angle; real clear glass passes less light at oblique angles. Near the window this put the daylight factor 20 % high in the open case (18.30 against 15.29) and 26 % high behind the building (15.50 against 12.28): **outside the tolerance**.
- **Inter-reflected light is spread evenly.** The engine's split-flux method gives the whole room one value (0.63 points here); Radiance has about 0.6 near the window falling to 0.38 at the back. Behind the building the engine also counts more light reflected from outside than Radiance (1.08 against 0.59 near the window).
- **Buildings outside the scene are ignored.** A first set-up with a narrow scene let oblique rays leave the scene before reaching the building opposite, so the engine saw sky that is not there. Real projects from Plan Studio send the building plus 1 m, so neighbouring buildings are not part of a Daylight run (see Limits).
- **A lesson for the test itself.** The engine reads its grid points, which sit 5 cm closer to the window than the target points. Close behind an obstruction the light changes by about 13 % over those 5 cm, so every reference is now evaluated at the engine's own points; and the black-room Radiance runs use 200,000 ambient samples, so its own noise (about ±1.5 % at 20,000) no longer decides a result.

### What was changed

Clear glass now transmits by angle of incidence (Fresnel reflection at both faces, multiple reflections, longer path; n = 1.52, scaled to the glass transmittance at normal incidence, as Radiance's `glass`). It applies to the sky, to the sun (ASE) and to LEED Option 2. Geometry is unchanged.

### Results: open view

| Depth (engine point) | Sky through glass, engine / Radiance | DF engine / Radiance | DF error | Reflected, engine / Radiance | Before the change: glass error, DF error |
|---|---|---|---|---|---|
| 0.5 m (0.45 m) | 14.73 / 14.82 (-0.6 %) | 15.36 / 15.31 | +0.05 pts (+0 %) | 0.63 / 0.49 | +19.7 %, +3.01 pts — failed |
| 1.5 m (1.45 m) | 4.46 / 4.46 (-0.0 %) | 5.08 / 5.05 | +0.03 pts (+1 %) | 0.63 / 0.60 | +4.9 %, +0.23 pts |
| 2.5 m (2.45 m) | 1.42 / 1.41 (+0.3 %) | 2.05 / 1.98 | +0.07 pts (+4 %) | 0.63 / 0.56 | +2.2 %, +0.10 pts |
| 3.5 m (3.45 m) | 0.57 / 0.56 (+2.6 %) | 1.20 / 1.07 | +0.13 pts (+12 %) | 0.63 / 0.51 | +3.2 %, +0.17 pts |
| 4.5 m (4.45 m) | 0.27 / 0.27 (+2.5 %) | 0.90 / 0.66 | +0.25 pts (+37 %) | 0.63 / 0.39 | +5.6 %, +0.24 pts |
| 5.5 m (5.45 m) | 0.15 / 0.15 (+0.8 %) | 0.78 / 0.53 | +0.24 pts (+46 %) | 0.63 / 0.38 | +0.7 %, +0.24 pts |

### Results: building 10 m opposite, 8 m high

| Depth (engine point) | Sky through glass, engine / Radiance | DF engine / Radiance | DF error | Reflected, engine / Radiance | Before the change: glass error, DF error |
|---|---|---|---|---|---|
| 0.5 m (0.45 m) | 11.64 / 11.70 (-0.4 %) | 12.73 / 12.29 | +0.44 pts (+4 %) | 1.08 / 0.59 | +23.9 %, +3.23 pts — failed |
| 1.5 m (1.45 m) | 1.95 / 1.97 (-1.0 %) | 2.92 / 2.62 | +0.29 pts (+11 %) | 0.97 / 0.66 | +5.6 %, +0.41 pts |
| 2.5 m (2.45 m) | 0.00 / 0.00 (no sky) | 0.74 / 0.52 | +0.23 pts (+44 %) | 0.74 / 0.52 | no sky, +0.24 pts |
| 3.5 m (3.45 m) | 0.00 / 0.00 (no sky) | 0.56 / 0.34 | +0.23 pts (+67 %) | 0.56 / 0.34 | no sky, +0.23 pts |
| 4.5 m (4.45 m) | 0.00 / 0.00 (no sky) | 0.49 / 0.24 | +0.25 pts (+105 %) | 0.49 / 0.24 | no sky, +0.24 pts |
| 5.5 m (5.45 m) | 0.00 / 0.00 (no sky) | 0.47 / 0.18 | +0.29 pts (+162 %) | 0.47 / 0.18 | no sky, +0.28 pts |

After the change every point is within the tolerances: **passed** (before it, the points nearest the window failed in both cases). What remains is one-sided: the reflected part reads **high**, by 0.13–0.29 points at the back of the room.

## 4. Sun preview in Plan Studio (`tests/mvp-massing.cjs`, part 3)

The quick sun-hours preview on the site (Massing › Sun on) is a separate, simpler calculation, so it is checked on its own:

* **Sun position**: the preview's function against Sun hours' own `sunPos`, pulled from `emb/sunhours.html` as it ships: 60 positions
  (3 cities, 4 dates, 5 times), largest difference 1e-13°. So the NREL SPA result in §1 holds for the preview too.
* **Shadows**: a wall 200 m long, 10 m high, at Vancouver; sun hours at 16 points 5–20 m north of it against the exact ray–plane answer
  with the same sun directions: identical on 21 March and 21 December (at 10 m: 1.00 h on 21 March with 15-minute steps; Sun hours gives
  0.84 h with its own steps, §2).

The preview uses a 2–4 m grid and 15-minute steps; use Sun hours for figures you report.

## 5. Outdoor noise (`noise_engine.cjs`)

Engine: `level`, `elements` and `shield` in `emb/noise.html`, pulled out of the page as they ship. References: the exact integral of an
incoherent finite line source, and ISO 9613-2:1996 eq. 14 for screening (Dz = 10 lg(3 + C2·C3·N), N = 2δ/λ, C2 = 20; C3 for two
edges e apart; at most 20 dB for one edge, 25 dB for two), at the engine's single wavelength (λ = 0.68 m, 500 Hz). Tolerance fixed
before running: 0.1 dB.

| Case | Engine | Reference | Difference |
|---|---|---|---|
| Road (line source, 70 dB at 10 m), 5 / 10 / 20 / 50 / 100 / 200 m | 72.92 / 69.96 / 66.96 / 62.94 / 59.86 / 56.70 | the same | 0.000 dB |
| Thin wall 3 m, receiver 15 m (δ 0.67 m) | 16.29 | 16.29 | 0.00 |
| Thin wall 5 m, receiver 30 m (δ 1.96 m) | 20.00 | 20.00 (limit) | 0.00 — before: **+0.72** |
| Thin wall 10 m (δ 8.88 m) | 20.00 | 20.00 (limit) | 0.00 — before: **+5.00** |
| Building 12 m deep, 9 m high, receiver 40 m | 25.00 | 25.00 (limit) | 0.00 — before: −0.63 |
| Building 8 m deep, 6 m high, receiver 30 m | 24.79 | 24.80 | −0.01 — before: **−3.56** |
| Building 15 m deep, 4 m high, receiver 45 m | 20.38 | 20.39 | 0.00 — before: **−4.17** |

**What was found and changed.** Spreading from a road was already exact. Screening had two errors: a thin wall could screen up to
25 dB where ISO 9613-2 allows 20 dB for one edge (the engine read up to 5 dB too quiet behind tall walls), and a building was treated
as a thin edge, without the C3 term for its depth (up to about 4 dB too loud behind deep, low buildings). The path over the roof now
uses C3 with the building's depth along the path, and the limit is 20 dB for one edge, 25 dB for a building.

**Ground and air (added 2026-10-25, with the redesign that reads the site's parks).** Soft ground by ISO 9613-2 eq. 10
(A_gr = 4.8 − (2h_m/d)(17 + 300/d) ≥ 0), scaled by the share of the path over soft ground (parks and grass from the site, or what the
person picks for the rest); air 1.9 dB/km (ISO 9613-1, 500 Hz, 10 °C, 70 %); behind a building the larger of screening and ground
counts (eq. 12). Against an independent integral of the same road (0.05 m pieces), tolerance 0.1 dB:

| Case | Engine | Reference |
|---|---|---|
| Soft ground, receiver 10 / 30 / 100 / 200 m | 69.01 / 61.49 / 55.31 / 52.03 | the same |
| Half soft, 30 m | 63.33 | 63.33 |
| Hard ground with air, 100 m; soft with air, 200 m | 59.42; 51.30 | 59.42; 51.30 |
| Behind a 3 m wall on soft ground | 16.29 dB (max of screening and ground) | 16.29 |

Eq. 10 is the standard's A-weighted simplification for mostly porous ground; scaling it by the soft share of the path is this engine's
interpolation for mixed ground, not part of the standard.

**Found and fixed in the redesign: building heights.** A scene's mass carries the height of its top (`h`, as Sun hours reads it); the
previous engine added it to the base, so every storey above the ground was taken as standing that much higher (the third storey of a
9.6 m block as 16 m tall). Screening by upper storeys and neighbours on raised ground was overstated. The engine now reads `h` as the
top; the screening checks above are unaffected (they pass the building's top directly).

**What this does and does not show.** It checks that the engine computes what ISO 9613-2's screening formula says, on the paths it
takes. It does not check the model against measurements: no reflections (up to +3 dB in narrow streets), no terrain (flat ground), no
meteorological correction, one frequency instead of octave bands, road levels typical for the road type and lanes in the map data (or
entered by the person), not traffic counts. The engine remains a screening tool; it is not an ISO 9613 or CNOSSOS-EU assessment.

## 6. Wind (not validated yet)

Wind Flow is a lattice-Boltzmann solver on a coarse grid (BGK with a Smagorinsky eddy viscosity, D2Q9/D3Q15 on the GPU). It has not been
checked against wind-tunnel data. The next step is a cube in a boundary layer (surface pressure coefficients against the classic
wind-tunnel measurements, e.g. Castro & Robins 1977) and the AIJ pedestrian-wind benchmark cases. Until then its speeds show where
the wind speeds up and slows down, not values to report.

## 7. Indoor acoustics (`room_acoustics.cjs`)

Engine: `airM`, `roomRT`, `dinTarget` and `stiRev` in `emb/roomacoustics.html`, pulled out of the page as they ship. The engine gives
each room's reverberation time in six octave bands from its volume and the absorption of its surfaces (the finishes set in Plan
Studio), furniture, people and air, by Eyring (default) or Sabine, and compares the mean of 500 Hz and 1 kHz with DIN 18041:2016
targets (or 0.4–0.6 s for homes and offices, a rule of thumb). Tolerances fixed before running.

**Air absorption** against ISO 9613-1:1993 (the values reprinted in ISO 9613-2 Table 2), 6 conditions × 6 bands (125 Hz–4 kHz),
tolerance 3 % or 0.06 dB/km: all 36 within. Largest difference: 4 kHz at 15 °C / 20 % RH, 89.41 against 88.8 dB/km (+0.7 %).

**Reverberation time** against an independent stochastic ray tracing written for this check (3 000 rays from the room's centre,
Lambert-diffuse reflections, air absorption along the paths, T30 fitted from −5 to −35 dB on the room's energy decay). Tolerance
for Eyring with even absorption: 10 %.

| Room (even absorption) | Ray tracing | Eyring | Sabine |
|---|---|---|---|
| Bedroom 4 × 3.5 × 2.7 m, α 0.10, 500 Hz | 0.85 s | 0.83 s (−2.3 %) | 0.88 s (+2.9 %) |
| Office 5 × 4 × 2.7 m, α 0.20, 1 kHz | 0.46 s | 0.43 s (−4.4 %) | 0.48 s (+6.6 %) |
| Classroom 9 × 7 × 3 m, α 0.30, 1 kHz | 0.41 s | 0.38 s (−7.0 %) | 0.45 s (+10.4 %) |
| Hall 20 × 15 × 6 m, α 0.15, 4 kHz (air counts) | 1.39 s | 1.35 s (−2.7 %) | 1.43 s (+3.5 %) |
| Studio 6 × 6 × 3 m, α 0.05, 500 Hz | 2.30 s | 2.27 s (−1.2 %) | 2.33 s (+1.3 %) |

Uneven absorption, reported and not judged: an office with an absorbing ceiling (α 0.80) over hard walls and floor (α 0.03) gives
0.39 s by ray tracing, Eyring 0.43 s (+11.5 %), Sabine 0.49 s (+26 %); a room with only a carpeted floor 0.80 s, Eyring 0.82 s.

Also checked: the reverberation-only speech transmission index is 1 without reverberation and falls as it grows (0.74 at 0.5 s,
0.59 at 1 s, 0.44 at 2 s); the DIN 18041 formulas and their volume ranges.

**What this does and does not show.** It shows that the engine's formulas are the published ones and that, where a room's sound
field is diffuse, they agree with a ray-traced decay. The ray tracing uses diffuse walls, which favours the formulas: in a real room
with hard, smooth parallel walls and all the absorption on the ceiling, the decay can be much longer than either formula says (flutter
between the walls), so a room "on target" with only an absorbent ceiling should be checked by an acoustician. The absorption values
of finishes, furniture and people are typical published values, not measurements of your products. No sound insulation between rooms,
no echoes, focusing or room modes (below about 200 Hz in small rooms the 125 Hz value is indicative only), no measured data.

## Limits: where not to rely on the result

- **Back of deep rooms (Daylight).** Inter-reflected light is spread evenly over a room, so where little sky is seen the daylight factor reads high by up to about 0.3 points (more than double the Radiance value at the back of a room behind a building). Treat "the back of the room reaches 2 % DF" with caution when the sky component there is under 1 %.
- **Light reflected from outside behind tall neighbours (Daylight)** reads high (about 0.5 points near the window in the test).
- **Neighbouring buildings (Daylight).** Only what is in the Plan Studio level is counted; buildings across the street do not shade the windows. Sun hours does include the site's neighbours.
- **Blinds, frames, dirt on glass, coloured or coated glass, multiple panes** are not modelled (the glass model is single clear glass scaled to the transmittance you give).
- **Not covered yet:** climate-based figures (sDA, ASE) against Radiance's annual methods (rfluxmtx / three-phase), measured data from a real building, other room shapes (L-shaped, rooflights, multiple windows), and independent expert review. These are the next steps of the validation plan.
