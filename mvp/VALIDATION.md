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

The two daylight references agree with each other within 0.04 DF points (within 2.5 %, largest at the back of the room where values are smallest) at every point, which is the evidence that the Radiance set-up is right.

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

### What the first run found

- **The engine's sky geometry is right.** The sky seen through the opening matched the independent integral within ±0.5 % (1.7 % at 5.5 m), and with the building opposite it found exactly where the sky disappears (0 % from 2.5 m back, as both references).
- **The glass was the main error.** The engine used one transmittance for every angle; real clear glass passes less light at oblique angles. Near the window this put the daylight factor 25 % high (18.30 against 14.64).
- **Inter-reflected light is spread evenly.** The engine's split-flux method gives the whole room one value (0.63 points here); Radiance has about 0.6 near the window falling to 0.37 at the back.
- **Buildings outside the scene are ignored.** A first set-up with a narrow scene let oblique rays leave the scene before reaching the building opposite, so the engine saw sky that is not there. Real projects from Plan Studio send the building plus 1 m, so neighbouring buildings are not part of a Daylight run (see Limits).

### What was changed

Clear glass now transmits by angle of incidence (Fresnel reflection at both faces, multiple reflections, longer path; n = 1.52, scaled to the glass transmittance at normal incidence, as Radiance's `glass`). It applies to the sky, to the sun (ASE) and to LEED Option 2. Geometry is unchanged.

### Results after the change (open view)

| Depth | Sky through glass, engine / Radiance | Error | DF engine / Radiance | Error | Reflected, engine / Radiance | DF before the change |
|---|---|---|---|---|---|---|
| 0.5 m | 14.73 / 14.15 | +4.1 % | 15.36 / 14.67 | +0.68 pts (+5 %) | 0.63 / 0.52 | 18.30 (+25 %) |
| 1.5 m | 4.46 / 4.18 | +6.6 % | 5.08 / 4.79 | +0.30 pts | 0.63 / 0.60 | 5.30 |
| 2.5 m | 1.42 / 1.34 | +5.5 % | 2.05 / 1.91 | +0.14 pts | 0.63 / 0.56 | 2.08 |
| 3.5 m | 0.57 / 0.54 | +6.5 % | 1.20 / 1.00 | +0.20 pts | 0.63 / 0.46 | 1.21 |
| 4.5 m | 0.27 / 0.25 | +9.6 % | 0.90 / 0.65 | +0.25 pts | 0.63 / 0.40 | 0.91 |
| 5.5 m | 0.15 / 0.14 | +6.8 % | 0.78 / 0.51 | +0.27 pts | 0.63 / 0.37 | 0.78 |

### Building 10 m opposite, 8 m high

| Depth | Sky through glass, engine / Radiance | DF engine / Radiance | Error |
|---|---|---|---|
| 0.5 m | 11.65 / 10.98 (+6.1 %) | 12.73 / 11.66 | +1.07 pts (+9 %) |
| 1.5 m | 1.95 / 1.76 (+10.8 %) | 2.92 / 2.38 | +0.54 pts |
| 2.5 m | 0 / 0 | 0.74 / 0.49 | +0.25 pts |
| 3.5 m | 0 / 0 | 0.56 / 0.33 | +0.23 pts |
| 4.5 m | 0 / 0 | 0.49 / 0.23 | +0.26 pts |
| 5.5 m | 0 / 0 | 0.47 / 0.18 | +0.28 pts |

All points are within the tolerances: **passed**. The remaining bias is one-sided: the engine reads **high**.

## Limits: where not to rely on the result

- **Back of deep rooms (Daylight).** Inter-reflected light is spread evenly over a room, so where little sky is seen the daylight factor reads high by up to about 0.3 points (more than double the Radiance value at the back of a room behind a building). Treat "the back of the room reaches 2 % DF" with caution when the sky component there is under 1 %.
- **Sky through glass reads 4–11 % high (Daylight).** Consistent across both cases; sDA and average DF are slightly optimistic.
- **Neighbouring buildings (Daylight).** Only what is in the Plan Studio level is counted; buildings across the street do not shade the windows. Sun hours does include the site's neighbours.
- **Blinds, frames, dirt on glass, coloured or coated glass, multiple panes** are not modelled (the glass model is single clear glass scaled to the transmittance you give).
- **Not covered yet:** climate-based figures (sDA, ASE) against Radiance's annual methods (rfluxmtx / three-phase), measured data from a real building, other room shapes (L-shaped, rooflights, multiple windows), and independent expert review. These are the next steps of the validation plan.
