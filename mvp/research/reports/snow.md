---
id: report-snow
sim: snow
published: 2026-11-20
publishedText: 20 November 2026
auditText: 20 November 2026
title: Snow drift screening from the winter wind: a lattice-Boltzmann speed field, an empirical deposition rule and basic roof loads
type: Method and data report
summary: How the Snow study estimates where one snowfall drifts deep and where the winter wind scours the ground bare, and what it implies for ground and flat-roof loads. The report gives the sources of the drifting-wind statistic, snow density, transport threshold and roof factor, and flags the drift rule itself as an unvalidated heuristic.
image: img/home/snow.webp
imageAlt: Snow depth around buildings after drifting, deeper in the lee and scoured at corners
code: mvp/js/workspace-chrome.js, mvp/js/wind-lbm.js, mvp/js/snow-analysis.js, emb/lib/climate.js
tests: tests/snow-analysis.test.mjs, tests/free-simulations.cjs
keywords:
- Snowdrift
- Blowing snow
- Snow load
- Lattice Boltzmann method
- Cold-climate design
highlights:
- The drifting wind is the most frequent direction and mean speed of the strongest tenth of below-freezing hours in the project EPW.
- A 2D lattice-Boltzmann flow at 1.5 m gives speed ratios; snow depth is scaled by 1.65 − 0.85 × ratio, clamped to 0.1–2.4 times the fall.
- Ground load is depth × density × g with 150 kg/m³ (200 kg/m³ for falls of 40 cm or more); flat roofs carry 0.8 × the ground load, the NBC basic roof factor.
- The deposition rule and its limits have no published source; drift results are qualitative.
- The study is not a code snow-load calculation: codes use statistical ground snow loads, not a single event.
---
# Abstract

Wind redistributes falling and lying snow around buildings, burying entrances and windward corners of courtyards while scouring others, and loading roofs unevenly [1–3]. Engineering practice handles this with wind-tunnel and water-flume tests, computational models of snow transport, and, for roof loads, the empirical drift provisions of structural codes [3–6]. SimuSite's Snow study is a fast screening for early design. It picks a characteristic drifting wind from the project weather file, computes a two-dimensional lattice-Boltzmann (LBM) flow around the buildings at pedestrian height, and redistributes one user-specified snowfall with an empirical rule: snow deepens where the wind slows and is removed where it speeds up. It reports depth, a drift factor and the implied ground and flat-roof loads. This report documents those steps and their constants. The weather statistic, the density of new snow, the transport threshold and the 0.8 flat-roof factor are sourced or consistent with the literature; the deposition rule (1.65 − 0.85 × speed ratio, clamped to 0.1–2.4) is a heuristic with no published source, and the flow model inherits the limits of the Wind study. The results show the likely pattern, not depths or loads to design to.

# Body

## 1. Introduction

Snow is transported by the wind once the friction velocity exceeds a threshold that depends on the age, temperature and bonding of the snow [7]. Around a building, the flow separates at the windward edges, accelerates around corners and decelerates in the wake; snow is eroded in the accelerated zones and deposited in the decelerated ones [2, 3]. Tominaga's review describes CFD models that couple the airflow to snow transport equations and erosion and deposition fluxes, and notes that even these need careful validation against field or wind-tunnel data [3]. For roof loads, structural codes give the balanced load as a roof factor times a statistical ground snow load, and add empirical drift surcharges at steps and parapets derived from field observations [4–6].

## 2. Method

### 2.1. The drifting wind

The study reads the project's EnergyPlus Weather (EPW) file and selects the hours with dry-bulb temperature at or below 0 °C and wind speed of at least 0.5 m/s [8]. If fewer than 24 such hours exist, it stops and reports that drifting does not apply. Of the selected hours, those at or above the 90th percentile of wind speed are binned into 16 directions; the most frequent direction and the mean speed of its hours define a single drifting wind. The 10 m speed is brought to 1.5 m with the ASHRAE power-law profile for the site's terrain class (α = 0.14, 0.22 or 0.33) [9].

### 2.2. Flow field

The same D2Q9 lattice-Boltzmann solver used by the Wind flow study computes the ratio r of local to free-stream speed on a horizontal grid at about 1.5 m, with the design and the surrounding context buildings as solid cells [10]. Its limits (two-dimensional, laminar at a lattice Reynolds number of order 10–100, unvalidated) are documented in the Wind flow report.

### 2.3. Deposition and erosion rule

Each open cell receives a drift factor f = 1 + k₀ (clamp(1.65 − 0.85 r, 0.1, 2.4) − 1), and a depth equal to the snowfall times f. Thus at r = 0.76 the snow lies as it fell, in still air (r = 0) it reaches 1.65 times the fall, and at r ≥ 1.82 it falls to 0.1 times. The factor k₀ = clamp((1.3 U − 2.5)/3, 0, 1), with U the drifting speed at 1.5 m, scales the effect with the wind: it is zero below about 1.9 m/s at 1.5 m and full above about 4.2 m/s. The code describes this as snow moving once the local wind passes about 4 m/s at 1.5 m. Facades take the depth of the adjacent ground cells; roofs take 0.8 times the fall.

### 2.4. Loads

The density of the fall is 150 kg/m³, or 200 kg/m³ for falls of 40 cm or more, and the load is depth × density × g. The flat-roof load is 0.8 times the open-ground load, the basic roof snow load factor C_b of the National Building Code of Canada for roofs of ordinary size [4]. The study reports the open-ground load, the flat-roof load, the area drifted at least 30 % deeper than the fall, the area scoured below 60 % of the fall, the deepest drift and the mean depth against facades.

### 2.5. Uniform snowfall page

A second tool, linked from the study card, distributes a uniform snowfall over the terrain and roofs by vertical ray sampling and reports areas, volume, mass and water equivalent. Its default density is 100 kg/m³ and it accepts 10–600 kg/m³. It does no drifting.

## 3. Parameters and their sources

Table 1. Inputs and constants of the Snow study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Below-freezing hours | T ≤ 0 °C, U ≥ 0.5 m/s | EPW data [8] | Measured / typical-year data; precipitation is not checked |
| Drifting wind | Top 10 % of speeds; modal direction of 16; mean speed | Engine choice | Reasonable statistic, not from a standard |
| Wind profile | α 0.14 / 0.22 / 0.33 | ASHRAE Fundamentals ch. 24 [9] | Sourced |
| Transport threshold | ≈ 4 m/s at 1.5 m (ramp 1.9–4.2 m/s) | Code comment | Consistent with low thresholds for fresh dry snow [7]; Li and Pomeroy report about 4–11 m/s at 10 m, dry snow averaging 7.7 m/s [7] |
| Drift rule | f = 1.65 − 0.85 r, limits 0.1–2.4 | Engine choice | Flagged: no published source, not calibrated |
| Snow density | 150 kg/m³; 200 kg/m³ if ≥ 40 cm | Engine choice | Plausible upper range of new snow (≈ 50–200 kg/m³ [11]); conservative for load |
| Uniform page density | 100 kg/m³ default | Engine choice | Typical new-snow value [11] |
| Flat-roof factor | 0.8 | NBC 2020 C_b [4] | Sourced (basic factor; ASCE 7 uses 0.7 C_e C_t I_s [5]) |
| Default snowfall | 15 cm (uniform page) / user choice | Engine choice | Editable input |

## 4. Verification and validation status

`tests/snow-analysis.test.mjs` checks the uniform snowfall tool exactly: areas, volume (3.2 m³), mass (320 kg at 100 kg/m³), water equivalent and the handling of sloped surfaces, gaps and invalid inputs. The Workspace drifting study is exercised by the Workspace tests for completion and output format only. The drift pattern has not been compared with field or wind-tunnel data; candidate benchmarks are the snowdrift measurements around a cube by Beyers and Waechter and the cases collected in Tominaga's review [3, 12].

In the end-to-end audit of 20 November 2026 (two-storey block, Chicago O'Hare TMY3 file, 30 cm fall), the study found 1,862 hours at or below 0 °C, a drifting wind from the north-north-west at 9.0 m/s at 10 m, 0.44 kPa on open ground (30 cm × 150 kg/m³ × g, checked by hand), 0.35 kPa on a flat roof, 837 m² drifted at least 30 % deeper, 1,656 m² scoured, a deepest drift of 49 cm and a mean of 43 cm against the facades.

## 5. Discussion

**What it shows.** The rule ties deposition to low wind speed and erosion to high speed, which is the first-order mechanism described in the literature [2, 3]. Lee-side drifts and corner scour will appear in the right places for the given wind direction, within the limits of a two-dimensional flow.

**What it misses.** Real drifting depends on the snow flux arriving from upwind fetch, on the duration of the storm, and on the wind history, not on the local speed alone [1, 3]. Snow does not accumulate without limit in still air, and erosion does not depend linearly on the speed ratio. Drifts on roofs, at roof steps and behind parapets, which govern structural design, are not modelled; the code drift provisions of NBC and ASCE 7 should be used for those [4–6]. Two-dimensional flow over-predicts both channelling and shelter because air cannot pass over the buildings.

**Loads.** Code ground snow loads are statistical values (for example the 1-in-50-year load) that include accumulation over a season and rain on snow [4, 5]. A single fall of user-chosen depth at a fixed density is not equivalent. The study's loads are a way to visualise the consequence of a given fall, and the method text says it is not a snow load calculation.

**Precipitation.** The weather selection uses temperature and wind only; it does not check whether snow fell or lay on the ground in those hours. EPW files carry snow depth and liquid precipitation fields, but these are often missing in typical-year files [8].

## 6. Conclusion

The drifting-wind statistic, terrain profile, density and flat-roof factor of the Snow study are sourced or consistent with published values, and the uniform snowfall tool is verified exactly. The deposition rule is a heuristic and the flow is the unvalidated two-dimensional model of the Wind study. The study is a qualitative screening for entrances, paths and courtyards in early design, not a source of design snow loads.

# References

1. R.D. Tabler, Controlling Blowing and Drifting Snow with Snow Fences and Road Design, Final report, NCHRP Project 20-7(147), Transportation Research Board, Washington, DC, 2003.
2. M. O'Rourke, Snow loads: guide to the snow load provisions of ASCE 7-10, ASCE Press, Reston, 2012.
3. Y. Tominaga, Computational fluid dynamics simulation of snowdrift around buildings: past achievements and future perspectives, Cold Reg. Sci. Technol. 150 (2018) 2–14. [doi:10.1016/j.coldregions.2017.05.004](https://doi.org/10.1016/j.coldregions.2017.05.004)
4. National Research Council Canada, National Building Code of Canada 2020, Part 4, Subsection 4.1.6, Loads due to snow and rain, NRC, Ottawa, 2022.
5. ASCE, Minimum Design Loads and Associated Criteria for Buildings and Other Structures, ASCE/SEI 7-22, chapter 7, Snow loads, ASCE, Reston, 2022.
6. M.J. O'Rourke, W. Tobiasson, E. Wood, Proposed code provisions for drifted snow loads, J. Struct. Eng. 112 (9) (1986) 2080–2092. [doi:10.1061/(ASCE)0733-9445(1986)112:9(2080)](https://doi.org/10.1061/(ASCE)0733-9445(1986)112:9(2080))
7. L. Li, J.W. Pomeroy, Estimates of threshold wind speeds for snow transport using meteorological data, J. Appl. Meteorol. 36 (1997) 205–213. [doi:10.1175/1520-0450(1997)036<0205:EOTWSF>2.0.CO;2](https://doi.org/10.1175/1520-0450(1997)036%3C0205:EOTWSF%3E2.0.CO;2)
8. U.S. Department of Energy, EnergyPlus Auxiliary Programs: EnergyPlus Weather File (EPW) Data Dictionary, EnergyPlus documentation, 2023.
9. ASHRAE, ASHRAE Handbook—Fundamentals, chapter 24, Airflow around buildings, ASHRAE, Atlanta, 2021.
10. S. Chen, G.D. Doolen, Lattice Boltzmann method for fluid flows, Annu. Rev. Fluid Mech. 30 (1998) 329–364. [doi:10.1146/annurev.fluid.30.1.329](https://doi.org/10.1146/annurev.fluid.30.1.329)
11. A. Judson, N. Doesken, Density of freshly fallen snow in the central Rocky Mountains, Bull. Am. Meteorol. Soc. 81 (7) (2000) 1577–1587. [doi:10.1175/1520-0477(2000)081<1577:DOFFSI>2.3.CO;2](https://doi.org/10.1175/1520-0477(2000)081%3C1577:DOFFSI%3E2.3.CO;2)
12. M. Beyers, B. Waechter, Modeling transient snowdrift development around complex three-dimensional structures, J. Wind Eng. Ind. Aerodyn. 96 (2008) 1603–1615.
