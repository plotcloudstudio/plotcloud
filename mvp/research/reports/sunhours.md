---
id: report-sunhours
sim: sunhours
published: 2026-11-20
publishedText: 20 November 2026
auditText: 20 November 2026
title: Direct sun hours on ground, roofs and facades: a ray-cast method checked step for step against Ladybug
type: Method and data report
summary: How SimuSite counts hours of direct sun, where every input comes from (the NOAA/Meeus solar position, the Ladybug Direct Sun Hours procedure), and the checks against NREL SPA, an exact shadow solution and ladybug-core.
image: img/home/sunhours.webp
imageAlt: Sun hours on the ground around a building, warmer colours for more hours of direct sun
code: emb/sunhours.html, emb/modeler.html
tests: tests/validation/sun_position.py, tests/validation/sun_shadow.py, tests/validation/lb_sunhours.py, tests/sun-period.cjs, tests/sunshine-share.test.mjs
keywords:
- Direct sun hours
- Solar position
- Ray casting
- Overshadowing
- Ladybug
- Verification
highlights:
- Sun hours counts the time steps in which a ray from a point to the sun meets no geometry.
- Solar position follows the NOAA implementation of Meeus; it differs from NREL SPA by at most 0.015°.
- Against an exact shadow solution the ground hours agree to 0.000 h on 44,686 samples.
- Against ladybug-core's Direct Sun Hours procedure every point agrees to 32-bit precision.
- The result depends on the chosen day, time step and grid; no weather or cloud is involved.
---
# Abstract

Direct sun hours, the number of hours a point receives unobstructed beam sunlight on a chosen day, is one of the oldest and most widely used overshadowing metrics in architecture and planning [1, 2]. SimuSite's Sun hours study computes it on ground cells, roofs and facades by casting a ray from each sample point towards the sun at regular time steps and counting the steps in which the ray is not blocked by the model or its surroundings. This report sets out the model, lists every parameter with its source, and summarises the verification. The solar position (NOAA's implementation of Meeus's algorithms [3, 4]) was compared with the NREL Solar Position Algorithm [5] at 17,014 positions: the largest error is 0.015° in altitude. Shadow casting was compared with an exact ray–box solution for a 200 m wall at Vancouver on 44,686 ground samples (difference 0.000 h), and the whole procedure was reproduced with ladybug-core's Direct Sun Hours [6] in four scenes, where every point agrees to the 32-bit floating-point precision in which results are stored. The metric itself has known limits: it is weather-independent, it weights a minute of low winter sun the same as a minute of high summer sun, and its value depends on the time step and grid spacing chosen by the user.

# Body

## 1. Introduction

Access to direct sunlight is regulated or recommended in many jurisdictions. In the United Kingdom, BRE Report 209 recommends that at least half of an amenity area receive two hours of sun on 21 March [1]; Chinese residential codes set minimum hours of sunlight on the "great cold day" or winter solstice for dwellings [2]. Architects also use sun hours informally, to place gardens, terraces and play areas or to compare massing options. The metric is simple to state: for a point and a day, count the time during which the sun is above the horizon and the line from the point to the sun is not obstructed.

This report documents how SimuSite computes it, where the numbers come from, and how far the implementation can be trusted. It is one of a series of reports, one per SimuSite simulation, written after an audit of each engine's inputs on 20 November 2026.

## 2. Method

### 2.1. Solar position

For each time step the sun's altitude and azimuth are computed with the algorithm published by NOAA's Global Monitoring Laboratory, which implements the low-precision formulae of Meeus [3, 4]: the Julian century from the date and local standard time, the geometric mean longitude and anomaly of the sun, the equation of centre, apparent longitude with nutation and aberration corrections, the obliquity of the ecliptic, the solar declination and the equation of time. The hour angle follows from true solar time, and altitude and azimuth from the usual spherical-trigonometry relations. Atmospheric refraction is not applied. Times are local standard time; daylight saving is not applied, so that a day's result does not change with a clock change.

The Workspace version of the study (the one most users run) uses the Ladybug sun path (ladybug-core's `Sunpath`), which also follows the NOAA formulation; the two were compared and agree to 3 × 10⁻¹³ degrees in altitude over 567,648 cases (Section 4).

### 2.2. Sampling and time steps

The analysis region is divided into square cells. Each ground cell is tested at its centre, raised 0.1 m along the surface normal so that the ray does not start inside the ground; roofs and facades are divided into squares in the same way. The day is divided into steps of 5 to 60 minutes. A sun vector more than 90° from a surface's normal counts as not received (the surface faces away from the sun), exactly as in Ladybug's Direct Sun Hours [6].

### 2.3. Shadow test

For each sample and each sun vector, a ray is cast towards the sun through a bounding-volume hierarchy of the model's triangles (three-mesh-bvh). The ray is clear if it hits nothing; the hours at the sample are the number of clear steps divided by the steps per hour. All geometry is opaque: glass, trees and translucent canopies block the sun completely unless the user removes them. Terrain and the site's surrounding buildings are included when they are part of the model.

### 2.4. Results

The study reports mean hours on the ground, the share of ground with at least two hours (the BRE amenity test [1]), and the corresponding figures for roofs and facades. A "range" mode accumulates hours over several days.

**Sunshine from the weather (added 23 November 2026).** Sun hours assumes a clear sky. To show how often the sun is actually out, the study reads the project weather file for the month of the chosen day and counts the hours with the sun above the horizon at mid-hour, and among them the hours whose direct normal irradiance is at least 120 W/m². That is the World Meteorological Organization's threshold for sunshine: sunshine duration is the time during which direct solar irradiance exceeds 120 W/m² [7, 8]. The share of sunny hours is reported, and so are expected sun hours on the ground, the clear-sky hours multiplied by that share. The product assumes that sunshine is equally likely at every hour of the day, which is a simplification: in many climates mornings are cloudier than afternoons, or the reverse. The weather file gives hourly integrated irradiance (Wh/m² in each hour [9]), so an hour counts as sunny when its mean direct irradiance reaches the threshold; the WMO definition is instantaneous, so partly sunny hours are counted all or nothing.

## 3. Parameters and their sources

Table 1. Inputs of the Sun hours study and the evidence behind each.

| Parameter | Value in SimuSite | Source | Audit status |
|---|---|---|---|
| Solar position | NOAA / Meeus formulation; Ladybug sun path in the Workspace | Meeus [3]; NOAA calculator [4]; ladybug-core [6] | Sourced and verified (Section 4) |
| Time zone, latitude, longitude | From the project site | User's site; the city list holds rounded coordinates | Input data |
| Time step | 5, 10, 15, 30 or 60 min (user) | Ladybug timestep convention [6] | User choice; affects precision |
| Ground offset | 0.1 m along the normal | Ladybug Direct Sun Hours default offset [6] | Sourced |
| Back-facing rule | Sun > 90° from normal counts 0 | Ladybug Direct Sun Hours [6] | Sourced |
| "Two hours on 21 March" | Summary threshold | BRE 209 [1] | Sourced (a UK guideline, not a universal rule) |
| Geometry | Model triangles, opaque | — | Modelling assumption |
| Refraction | Not applied | Meeus discusses it [3] | Known simplification (≤ about 0.6° near the horizon); kept off on 23 November 2026 so that results stay identical to Ladybug and the SPA comparison of Section 4 |
| Sunshine threshold | Direct normal irradiance ≥ 120 W/m², hourly EPW values, month of the chosen day | WMO definition of sunshine duration [7, 8]; EPW fields [9] | Sourced threshold; hourly values approximate the instantaneous definition; the share is applied evenly through the day (added 23 November 2026) |

No parameter of this study was found to be unsourced. The one modelling assumption with a practical effect is that all geometry is opaque.

## 4. Verification

Three independent checks are run by the scripts in `tests/validation/` and were re-run for this audit.

**Solar position against NREL SPA.** NREL's Solar Position Algorithm has a stated uncertainty of ±0.0003° [5]. Through pvlib's `spa_python`, the engine's sun was compared at 9 latitudes from 60° S to 70° N, 3 longitudes, every 7th day and every daylight hour of 2026: 17,014 positions. Mean error 0.003° in altitude and azimuth; maximum 0.015° in altitude and 0.012° in azimuth. At a 5-minute step the sun moves about 1.25°, so the position error is two orders of magnitude below the discretisation.

**Shadows against an exact solution.** A wall 200 m long, 1 m thick and 10 m high stands east–west on open ground at Vancouver (49.28° N). For every ground sample the engine produced, the reference intersects the engine's own sun rays with the wall by an exact slab test. On 20 March (17,568 samples) and 21 December (27,118 samples) the mean and maximum differences are 0.000 h. As a hand check, at the equinox the noon sun stands 40.7° high and the wall casts an 11.6 m shadow; the engine gives 0.84 h 10 m north of the wall and 11.83 h at 15 m.

**Procedure against Ladybug.** `lb_sunhours.py` rebuilds the LB Direct Sun Hours component step for step with ladybug-core, using an exact Möller–Trumbore ray–triangle test in place of Rhino's mesh ray, on a box-and-L scene in four cases (Vancouver 21 March at 15 min; 21 December at 5 min; 21 June at 1 h with north rotated 20°; Sydney 21 June at 10 min, 8:00–16:00). On 2,461 ground points and 203 surface squares per case, the largest difference is 3 × 10⁻⁷ h, the precision of the 32-bit floats in which results are stored.

**Sunshine share.** `tests/sunshine-share.test.mjs` builds a March of hourly rows at Toronto with direct normal irradiance of 119 W/m² on days 1–10, 120 W/m² on days 11–20 and 800 W/m² on days 21–31 in daylight, and 500 W/m² at night. The function counts exactly the daylit hours of days 11–31 as sunny (120 W/m² is sunshine, 119 is not), ignores the night hours and other months, and finds about twelve daylit hours a day, as expected at the equinox.

## 5. Discussion

The checks establish that SimuSite computes what the metric defines, and computes it as Ladybug does. They do not make the metric itself a measure of solar access. Sun hours ignores cloud: a site in Vancouver and one in Phoenix with the same geometry get the same answer. The sunshine share from the project weather now states how far the clear-sky hours overstate the sun a site actually gets in that month. It counts a minute of sun at 5° altitude as much as a minute at 60°, although the energy received differs by an order of magnitude; for energy, the Solar radiation study (a companion report) is the appropriate tool. Results depend on the time step: a step of Δt minutes can shift a point's hours by up to Δt at each transition between sun and shade, so a 15-minute step can put a point on either side of a two-hour threshold. Grid cells smaller than the features of interest are needed near building edges. Finally, the solar position does not include refraction, which raises the apparent sun by up to about half a degree at the horizon [3]; this mostly affects the first and last minutes of the day.

## 6. Conclusion

Sun hours in SimuSite is a direct, exact-geometry implementation of a well-defined metric. Its sun position is accurate to 0.015° against NREL SPA, its shadow test reproduces an exact solution, and its procedure matches Ladybug's to floating-point precision. Results should be reported with the day, time step and grid spacing used, and read as access to direct sun on that day, not as energy or comfort.

# References

1. P.J. Littlefair, Site layout planning for daylight and sunlight: a guide to good practice, BR 209, 2nd ed., BRE Press, Watford, 2011.
2. Ministry of Housing and Urban-Rural Development of the People's Republic of China, GB 50180-2018 Standard for urban residential area planning and design, China Architecture & Building Press, Beijing, 2018.
3. J. Meeus, Astronomical Algorithms, 2nd ed., Willmann-Bell, Richmond, VA, 1998.
4. NOAA Global Monitoring Laboratory, Solar calculation details (NOAA Solar Calculator), [gml.noaa.gov/grad/solcalc](https://gml.noaa.gov/grad/solcalc/calcdetails.html).
5. I. Reda, A. Andreas, Solar position algorithm for solar radiation applications, Sol. Energy 76 (2004) 577–589. [doi:10.1016/j.solener.2003.12.003](https://doi.org/10.1016/j.solener.2003.12.003)
6. M.S. Roudsari, M. Pak, Ladybug: a parametric environmental plugin for Grasshopper to help designers create an environmentally-conscious design, in: Proc. Building Simulation 2013, IBPSA, Chambéry, 2013, pp. 3128–3135.
7. World Meteorological Organization, Guide to Instruments and Methods of Observation (WMO-No. 8), Volume I, chapter on the measurement of sunshine duration, WMO, Geneva (definition adopted in 2003: direct solar irradiance exceeding 120 W/m²).
8. Japan Meteorological Agency, CP7 Sunshine (training material on the CIMO Guide chapter on sunshine duration). [jma.go.jp](https://www.jma.go.jp/jma/jma-eng/jma-center/ric/Our%20activities/International/CP7-Sunshine.pdf)
9. U.S. Department of Energy, EnergyPlus Auxiliary Programs: EnergyPlus Weather File (EPW) Data Dictionary (field Direct Normal Radiation, Wh/m²), EnergyPlus documentation, 2023.
