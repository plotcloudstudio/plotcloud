# Engine validation: Sun hours and Daylight (2026-10-25)

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

## Limits: where not to rely on the result

- **Back of deep rooms (Daylight).** Inter-reflected light is spread evenly over a room, so where little sky is seen the daylight factor reads high by up to about 0.3 points (more than double the Radiance value at the back of a room behind a building). Treat "the back of the room reaches 2 % DF" with caution when the sky component there is under 1 %.
- **Light reflected from outside behind tall neighbours (Daylight)** reads high (about 0.5 points near the window in the test).
- **Neighbouring buildings (Daylight).** Only what is in the Plan Studio level is counted; buildings across the street do not shade the windows. Sun hours does include the site's neighbours.
- **Blinds, frames, dirt on glass, coloured or coated glass, multiple panes** are not modelled (the glass model is single clear glass scaled to the transmittance you give).
- **Not covered yet:** climate-based figures (sDA, ASE) against Radiance's annual methods (rfluxmtx / three-phase), measured data from a real building, other room shapes (L-shaped, rooflights, multiple windows), and independent expert review. These are the next steps of the validation plan.
