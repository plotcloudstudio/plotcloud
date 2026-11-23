---
id: report-radiation
sim: radiation
published: 2026-11-20
publishedText: 20 November 2026
auditText: 20 November 2026
title: Solar irradiation on ground, roofs and facades from an hourly weather file: Perez sky, Tregenza patches and a check against pvlib
type: Method and data report
summary: How the Solar radiation study turns an EPW weather file into kWh/m² on every surface, the sources of its sky model and constants, its agreement with pvlib's Perez model within 0.2 %, and the assumptions behind the rooftop PV estimate.
image: img/home/radiation.webp
imageAlt: Annual solar irradiation on the roofs and facades of a building, from blue for little to yellow for much
code: emb/lib/climate.js, emb/sunhours.html
tests: tests/validation/climate_lib.py, tests/climate-studies.cjs, tests/pvwatts-albedo.test.mjs
keywords:
- Solar irradiation
- Perez sky model
- Tregenza sky subdivision
- EPW weather data
- Photovoltaic potential
highlights:
- Hourly direct and diffuse irradiance from an EPW file is distributed over 145 Tregenza sky patches.
- The diffuse sky follows Perez et al. (1990): isotropic dome, circumsolar disc and horizon band.
- On six open planes the engine agrees with pvlib's Perez model within 0.2 %.
- Inter-building reflections are not modelled; ground reflection uses the weather file's hourly albedo, weighted by irradiance, and 0.2 when the file has none.
- The PV figure uses PVWatts V5's module, loss and inverter equations on the hourly weather (standard modules, about 15 %), for modules laid flat: a screening estimate.
---
# Abstract

The Solar radiation study estimates how much solar energy reaches each part of a site and building over a chosen period, in kWh/m², from an hourly weather file in EnergyPlus (EPW) format [1]. Beam irradiance is traced to the sun through the model; diffuse irradiance is split by the model of Perez et al. [2] into an isotropic part, a circumsolar part that is shaded like the sun, and a horizon band, and the sky is divided into the 145 patches of Tregenza [3]. Ground-reflected light uses an isotropic albedo of 0.2. This report describes the model and its inputs, and the verification against pvlib [4]: on a synthetic year at Toronto, irradiation on horizontal, vertical and tilted open planes agrees with pvlib's Perez transposition within 0.2 %, and grouping hourly sun positions into 415 clusters about 3° apart changes totals by less than 0.1 %. The rooftop PV estimate built on these totals rests on two assumed constants (20 % module efficiency, performance ratio 0.8) that are typical of current crystalline-silicon systems but not project-specific.

# Body

## 1. Introduction

Irradiation maps are used early in design to locate photovoltaic panels, to judge solar gains through facades and to find surfaces that need shading. The physically based way to compute them is to combine a weather record of beam and diffuse irradiance with a model of how diffuse light is distributed over the sky, and to trace both through the geometry [5]. SimuSite does this in the browser, within the Sun hours engine, so that the same sightlines that give sun hours also give energy.

## 2. Method

### 2.1. Weather data

The study reads the project's EPW file: global horizontal (GHI), direct normal (DNI) and diffuse horizontal (DHI) irradiance for each of the 8,760 hours, as defined in the EnergyPlus weather file data dictionary [1]. Hour h covers (h − 1):00 to h:00 local standard time. Short runs of missing values are filled from neighbouring hours; radiation is zero at night. The sun position for each hour is taken at the middle of the hour.

### 2.2. Sky model

The sky is divided into the 145 patches of Tregenza [3]: eight altitude bands of 12° (the last a 6° cap) with 30, 30, 24, 24, 18, 12, 6 and 1 patches. Diffuse horizontal irradiance is split with the Perez 1990 model [2] into three components whose weights depend on the hour's sky clearness ε and brightness Δ, using the "allsitescomposite1990" coefficient set as distributed with pvlib [4] and Radiance's gendaymtx: an isotropic dome (the same radiance in every patch), a circumsolar disc that travels with the sun, and a horizon band. The circumsolar part is shaded by buildings as the sun is, which matters for facades in clear climates.

### 2.3. Grouping the sun

Tracing every daylight hour (about 4,400 a year) from every sample would be slow in a browser. Beam hours are therefore grouped into sun positions about 3° apart; each group keeps the vector sum of DNI·ŝ over its hours, so the energy is conserved exactly and only the direction of the sightline is approximated.

### 2.4. Irradiation on a surface

For a sample with normal n, irradiation is the sum of (i) beam and circumsolar from the visible sun groups, projected on n; (ii) the isotropic dome through the visible sky patches; (iii) the horizon band, seen by vertical faces; and (iv) ground-reflected light from the lower half of the view at albedo ρ = 0.2, taken as unobstructed and isotropic.

### 2.5. Rooftop PV estimate

Roof samples that receive at least 80 % of what open level ground receives are summed as candidate PV area. Energy is estimated as area × irradiation × η × PR, i.e. modules laid flat on all of that area.

Until 23 November 2026, η was 0.20 and PR a fixed 0.80. Both now come from the PVWatts Version 5 manual [6]. η is 0.15, the nominal efficiency of its "standard" module type (Table 3: about 15 %, glass cover, temperature coefficient −0.47 %/°C). PR is computed for the site and period, hour by hour from the weather file, for an unshaded module laid flat:
- DC power follows the manual's eq. (8), P_dc = (I/1000) P_dc0 [1 + γ (T_cell − 25)].
- The default system losses of 14 % (Table 6, combined by eq. 9) are taken off the DC energy.
- The inverter follows eq. (10): part-load efficiency η = (η_nom/η_ref)(−0.0162 ζ − 0.0059/ζ + 0.9858), with η_nom = 0.96 and η_ref = 0.9637. Output is clipped at the AC rating, eq. (11), with the default DC-to-AC ratio of 1.1.
- PVWatts computes the cell temperature with Fuentes' transient heat-balance model and an installed nominal operating cell temperature (INOCT) of 45 °C for an open rack [6]. The study uses the steady-state relation T_cell = T_air + (INOCT − 20) · I/800 with that INOCT, the simplified form of the NOCT relation (Duffie and Beckman give it with an additional efficiency term [5]), which ignores wind and thermal lag.
- The angle-of-incidence losses of the module cover are not applied.

PR is then the period's AC energy divided by its irradiation on the plane in kWh/m², per kW of modules.

**Ground albedo (added 23 November 2026).** EPW files carry an hourly albedo field [1]. In each hour the ground-reflected irradiance is proportional to ρ × GHI, so over a period the GHI-weighted mean albedo reproduces the hour-by-hour total exactly. The study uses it when at least 90 % of the period's GHI has an albedo value, and 0.2 otherwise. Snow-covered ground in winter months then reflects as the file records rather than at 0.2.

## 3. Parameters and their sources

Table 1. Inputs of the Solar radiation study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Weather (GHI, DNI, DHI) | Project EPW | EnergyPlus data dictionary [1]; files from climate.onebuilding.org or user | Measured / typical-year data |
| Sky subdivision | 145 patches | Tregenza 1987 [3] | Sourced |
| Diffuse sky distribution | Perez 1990, allsitescomposite1990 | Perez et al. [2]; as in pvlib [4] | Sourced and verified |
| Sun grouping | ≈ 3° clusters, energy-conserving | Engine design | Verified (< 0.1 % effect) |
| Ground albedo | EPW hourly albedo, GHI-weighted; 0.2 when missing | EPW field Albedo [1]; 0.2 common default (pvlib, PVWatts [6]) | Measured / typical-year data where present (added 23 November 2026) |
| Inter-reflection between buildings | Not modelled | — | Known simplification |
| PV module efficiency | 15 % (standard module) | PVWatts V5 Table 3 [6] | Sourced (replaced 20 % on 23 November 2026) |
| Temperature coefficient | −0.47 %/°C | PVWatts V5 Table 3 [6] | Sourced |
| Cell temperature | T_air + (45 − 20)·I/800 | INOCT 45 °C from PVWatts V5 [6]; simplified NOCT relation [5] | Sourced constants; steady-state approximation of PVWatts' Fuentes model |
| System losses | 14 % | PVWatts V5 Table 6, eq. (9) [6] | Sourced default |
| Inverter | η_nom 0.96, η_ref 0.9637, eq. (10); DC/AC 1.1, clipping eq. (11) | PVWatts V5 [6] | Sourced |
| Performance ratio | Computed per site and period from the above | PVWatts V5 equations [6]; PR as defined in IEC 61724-1 [7] | Derived (replaced the fixed 0.80 on 23 November 2026) |
| "Worth a look" threshold | ≥ 80 % of open-ground irradiation | Engine heuristic | Assumption, flagged |

The audit found no fabricated constants. The PV efficiency and performance ratio, which were assumptions at the audit, now follow PVWatts V5; the "worth a look" threshold remains an assumption; the report and the interface should not present the PV figure as a yield prediction.

## 4. Verification

`tests/validation/climate_lib.py` runs the engine's own functions in Node against pvlib's `get_total_irradiance` [4] on a synthetic year at Toronto (Ineichen clear sky with day-to-day cloud), albedo 0.2.

Table 2. Annual irradiation on open planes, engine against pvlib.

| Plane | Engine (kWh/m²) | pvlib Perez | Difference | pvlib isotropic |
|---|---|---|---|---|
| Horizontal | 1,112.7 | 1,111.9 | +0.07 % | 1,112.0 |
| Vertical south | 974.6 | 974.7 | −0.01 % | 879.1 |
| Vertical east | 701.9 | 703.0 | −0.16 % | 655.4 |
| Vertical west | 700.6 | 701.8 | −0.18 % | 655.5 |
| Vertical north | 313.8 | 314.1 | −0.09 % | 344.6 |
| 30° tilt south | 1,352.0 | 1,351.6 | +0.02 % | 1,274.8 |

Every plane is within the 2 % tolerance fixed before the test. The isotropic column shows why the sky model matters: an even sky places 7–11 % less energy on sunlit facades and 9 % more on north facades. The cost of grouping the sun is at most 0.08 % (north facade). Shading by buildings uses the same ray test as Sun hours, which is verified against an exact solution and against Ladybug in the companion report.

**Albedo and PVWatts.** `tests/pvwatts-albedo.test.mjs` checks the new functions by hand:
- **Albedo:** two hours at 100 and 300 W/m² with albedos 0.2 and 0.8 give a weighted albedo of 0.65; a file with too little albedo data falls back to 0.2.
- **PVWatts at standard conditions:** with the cell at 25 °C (air at −6.25 °C under 1,000 W/m²) and 14 % losses, the AC output matches eq. (10) computed independently, with an inverter efficiency of 0.961. Without losses, the same hour clips at the AC rating of 1/1.1 kW per kW of modules.
- **PVWatts with a hot cell:** at 800 W/m² and 20 °C air the cell reaches 45 °C, the DC power is 0.8 × (1 − 0.0047 × 20) × 0.86 kW, and thin film, with its smaller temperature coefficient, yields more.

## 5. Discussion

The engine reproduces the reference transposition model on unobstructed planes, so its errors on real buildings come from what it leaves out rather than from its arithmetic. Light reflected from neighbouring facades is not modelled; in dense streets this under-predicts irradiation on lower facades, typically by a few per cent for dark facades and more for light or glazed ones [5]. The ground is taken as unobstructed for reflected light and has a fixed albedo of 0.2, which under-predicts reflection over snow. Results are only as representative as the weather file: a typical meteorological year represents long-term average conditions, not any particular year.

The PV estimate multiplies flat-plate irradiation by a PVWatts-derived efficiency and performance ratio. It now accounts for temperature, system losses and the inverter as PVWatts V5 does, with a steady-state cell temperature in place of PVWatts' transient model, but it still neglects module tilt and row spacing, cover reflection losses and the shading pattern on each module. It is useful to compare options and to judge order of magnitude; a yield estimate should use a dedicated tool such as PVWatts [6].

## 6. Conclusion

The Solar radiation study implements a standard, documented sky model and agrees with pvlib within 0.2 % on open planes. Its outputs are suitable for comparing surfaces and massing options. The rooftop PV figure rests on assumed efficiency and performance ratio and should be labelled as an estimate.

# References

1. U.S. Department of Energy, EnergyPlus Auxiliary Programs: Weather Converter Program and EnergyPlus Weather File (EPW) Data Dictionary, EnergyPlus documentation, 2023.
2. R. Perez, P. Ineichen, R. Seals, J. Michalsky, R. Stewart, Modeling daylight availability and irradiance components from direct and global irradiance, Sol. Energy 44 (1990) 271–289. [doi:10.1016/0038-092X(90)90055-H](https://doi.org/10.1016/0038-092X(90)90055-H)
3. P.R. Tregenza, Subdivision of the sky hemisphere for luminance measurements, Light. Res. Technol. 19 (1987) 13–14.
4. W.F. Holmgren, C.W. Hansen, M.A. Mikofski, pvlib python: a python package for modeling solar energy systems, J. Open Source Softw. 3 (2018) 884. [doi:10.21105/joss.00884](https://doi.org/10.21105/joss.00884)
5. J.A. Duffie, W.A. Beckman, Solar Engineering of Thermal Processes, 4th ed., Wiley, Hoboken, NJ, 2013.
6. A.P. Dobos, PVWatts Version 5 Manual, NREL/TP-6A20-62641, National Renewable Energy Laboratory, Golden, CO, 2014.
7. IEC 61724-1:2021, Photovoltaic system performance – Part 1: Monitoring, International Electrotechnical Commission, Geneva, 2021.
