---
id: report-wind
sim: wind
published: 2026-11-20
publishedText: 20 November 2026
auditText: 20 November 2026
title: Pedestrian wind screening with a two-dimensional lattice-Boltzmann model and the Lawson comfort criteria
type: Method and data report
summary: How the Wind flow study estimates speed-up and shelter at pedestrian height with a 2D D2Q9 lattice-Boltzmann solver, and rates comfort with the City of London Lawson criteria from hourly EPW wind. The report gives the sources of the wind profile, pressure and comfort constants, and explains why the flow model is a qualitative screening that has not been validated.
image: img/home/wind.webp
imageAlt: Wind speed ratio at pedestrian height around buildings, red where the wind speeds up
code: mvp/js/wind-lbm.js, emb/lib/climate.js, mvp/js/workspace-chrome.js
tests: tests/climate-studies.cjs
keywords:
- Pedestrian wind comfort
- Lattice Boltzmann method
- Lawson criteria
- Atmospheric boundary layer
- Urban microclimate
highlights:
- A 2D D2Q9 BGK lattice-Boltzmann flow at about 1.5 m gives speed ratios for each of 8 wind directions.
- EPW wind at 10 m is brought to 1.5 m with ASHRAE power-law profiles (α = 0.14, 0.22, 0.33).
- Comfort classes follow the City of London Lawson criteria (2019): 5 % exceedance thresholds 2.5, 4, 6, 8 m/s and 15 m/s safety.
- The lattice viscosity makes the simulated flow laminar at a Reynolds number of order 10–100, far below real flows.
- The flow model has not been compared with wind-tunnel data; results show patterns, not values to report.
---
# Abstract

Wind at pedestrian level is a frequent cause of discomfort and occasionally of danger around tall or closely spaced buildings, and many cities require wind microclimate assessments [1, 2]. The standard methods are boundary-layer wind tunnel tests and validated computational fluid dynamics (CFD) [3, 4]. SimuSite's Wind flow study offers a fast screening in the browser: a two-dimensional lattice-Boltzmann (LBM) flow on a horizontal slice at about 1.5 m, with buildings as solid cells, gives the ratio of local to free-stream speed for each of eight wind directions [5, 6]. Combined with the hourly wind of the project's EPW file, transformed from 10 m at the station to 1.5 m at the site with ASHRAE power-law profiles [7], it estimates each location's 95th-percentile speed and rates it with the City of London Lawson criteria [2]. This report documents the solver and its parameters and states its limits plainly: the model is two-dimensional (air cannot pass over roofs), its lattice viscosity corresponds to a Reynolds number of order 10–100 rather than 10⁶–10⁷, and it has not been compared with experimental data. The comfort thresholds and the wind profile are correctly sourced; the flow field is a qualitative indicator of channelling and shelter.

# Body

## 1. Introduction

Pedestrian-level wind comfort is assessed by combining the statistical distribution of wind at a reference height with the speed-up factors that the buildings produce at each location, then comparing exceedance probabilities with comfort criteria [1, 3]. Lawson's criteria, in the form adopted by the City of London in 2019, assign each location an activity class by the speed exceeded 5 % of the time [2]. Speed-up factors normally come from wind-tunnel tests or steady RANS or LES CFD following best-practice guidelines such as COST Action 732 and AIJ [3, 4]. Both are beyond early design. A coarse, fast model can still show where channelling and shelter are likely, if its limits are understood.

## 2. Method

### 2.1. Flow model

The site is rasterised on a grid of about 1.5 m at pedestrian height; cells inside buildings (the design and the surrounding buildings) are solid. The lattice-Boltzmann method with the D2Q9 velocity set and the BGK single-relaxation collision operator [5, 6] evolves particle distribution functions; walls use simple bounce-back. The free stream is imposed at the upwind edges as the equilibrium distribution at velocity u₀ = 0.08 (lattice units) in the wind direction; downwind edges are pressure outlets that take the neighbouring cell's velocity at the reference density. The relaxation time τ = 0.7 gives a lattice kinematic viscosity ν = (τ − ½)/3 ≈ 0.067. The solver runs for 3.5 × max(n_x, n_y) steps, i.e. long enough for the free stream to cross the domain about three and a half times. The output at each open cell is the speed ratio |u|/u₀ and a pressure coefficient relative to cells in undisturbed flow.

### 2.2. From weather to local wind

Each hour's EPW wind speed U₁₀ (10 m, open terrain at the station) is transformed to the site at height h = 1.5 m with the power-law profile of ASHRAE Fundamentals [7]: U_h = U₁₀ (δ_met/10)^α_met (h/δ)^α, with station terrain α_met = 0.14, δ_met = 270 m, and site terrain α = 0.14, 0.22 or 0.33 with boundary-layer depths δ = 270, 370 or 460 m for open, suburban and city terrain. The hourly speed at a location is U_h times the speed ratio of the nearest of the eight simulated directions.

### 2.3. Comfort and safety

At each location the hourly local speeds are sorted and the 95th percentile (exceeded 5 % of the time) is compared with the City of London Lawson thresholds [2]: ≤ 2.5 m/s frequent sitting, ≤ 4 occasional sitting, ≤ 6 standing, ≤ 8 walking, above 8 uncomfortable. A location is unsafe for all users if 15 m/s is exceeded more than 0.022 % of the time (about 2 hours a year) [2].

## 3. Parameters and their sources

Table 1. Inputs and constants of the Wind flow study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Lattice model | D2Q9, BGK, bounce-back | Qian et al.; Chen & Doolen [5, 6] | Sourced method |
| Relaxation time τ | 0.7 | Engine choice (stability) | Flagged: sets ν and hence a very low Reynolds number |
| Inlet speed u₀ | 0.08 lattice units | Engine choice (Mach ≈ 0.14) | Numerical setting |
| Steps | 3.5 × max(n_x, n_y) | Engine choice | Flagged: convergence not checked |
| Grid | ≈ 1.5 m | Engine choice | Numerical setting; narrow gaps under 2–3 cells are poorly resolved |
| Wind profile | Power law, α 0.14 / 0.22 / 0.33, δ 270 / 370 / 460 m | ASHRAE Fundamentals 2021 ch. 24 [7] | Sourced |
| Reference wind | EPW hourly speed and direction | EPW data dictionary [8] | Measured / typical-year data |
| Comfort classes | 2.5 / 4 / 6 / 8 m/s at 5 % exceedance | City of London Lawson criteria [2] | Sourced |
| Safety | 15 m/s for > 0.022 % of hours | City of London [2] | Sourced |
| Directions | 8 | Engine choice | Numerical setting |

## 4. Verification and validation status

The unit tests in `tests/climate-studies.cjs` check the Lawson classification (thresholds, 5 % rule, safety rule) and the wind profile. The flow solver itself has not been validated against wind-tunnel data; the validation plan names the surface pressures on a cube in a boundary layer (e.g. Castro and Robins [9]) and the AIJ pedestrian-wind benchmark cases [4] as next steps. In the end-to-end audit of 20 November 2026 on a two-storey block with a Chicago TMY3 file, the study completed (eight directions, 1.5 m grid) and reported a largest speed-up of 1.57 in the windiest 1 % of the ground.

## 5. Discussion

The method captures one real mechanism, the horizontal deflection of wind around and between buildings, and will show where a gap channels the flow and where a courtyard is sheltered. It misses others that often dominate pedestrian wind around taller buildings: the downwash of wind from upper floors down a windward facade, flow over roofs, and three-dimensional corner vortices [1, 3]. Because air cannot go over the buildings, speed-up in narrow gaps is overstated, and shelter in the lee of low buildings is overstated too.

The Reynolds number of the simulated flow deserves emphasis. With ν ≈ 0.067 lattice units and u₀ = 0.08, a building 20 cells (30 m) wide gives Re = u₀ L / ν ≈ 24. Real flows around buildings have Re of order 10⁶–10⁷ and are turbulent; wind-tunnel practice requires Re high enough for flow separation at sharp edges to be Reynolds-independent [3]. At Re ≈ 24 the flow is laminar, wakes are long and steady, and separation is not that of a turbulent flow. The speed ratios are therefore qualitatively plausible but not quantitatively transferable. A Smagorinsky subgrid model, a finer grid and a higher Reynolds number, or a three-dimensional solver, would be needed for quantitative use, followed by validation [3, 4].

Applying station wind with a power-law profile is standard practice for screening [7], but local terrain roughness and upwind obstacles are represented only by the chosen terrain class.

## 6. Conclusion

The comfort statistics, thresholds and wind profiles of the Wind flow study are correctly sourced and implemented; the two-dimensional, low-Reynolds-number flow model is not validated. Results indicate where to look and how options compare qualitatively; they should not be presented as a wind microclimate assessment.

# References

1. B. Blocken, J. Carmeliet, Pedestrian wind environment around buildings: literature review and practical examples, J. Therm. Envelope Build. Sci. 28 (2004) 107–159. [doi:10.1177/1097196304044396](https://doi.org/10.1177/1097196304044396)
2. City of London Corporation, Wind Microclimate Guidelines for Developments in the City of London, City of London, August 2019.
3. J. Franke, A. Hellsten, H. Schlünzen, B. Carissimo (Eds.), Best practice guideline for the CFD simulation of flows in the urban environment, COST Action 732, COST Office, Brussels, 2007.
4. Y. Tominaga, A. Mochida, R. Yoshie, H. Kataoka, T. Nozu, M. Yoshikawa, T. Shirasawa, AIJ guidelines for practical applications of CFD to pedestrian wind environment around buildings, J. Wind Eng. Ind. Aerodyn. 96 (2008) 1749–1761. [doi:10.1016/j.jweia.2008.02.058](https://doi.org/10.1016/j.jweia.2008.02.058)
5. Y.H. Qian, D. d'Humières, P. Lallemand, Lattice BGK models for Navier–Stokes equation, Europhys. Lett. 17 (1992) 479–484. [doi:10.1209/0295-5075/17/6/001](https://doi.org/10.1209/0295-5075/17/6/001)
6. S. Chen, G.D. Doolen, Lattice Boltzmann method for fluid flows, Annu. Rev. Fluid Mech. 30 (1998) 329–364. [doi:10.1146/annurev.fluid.30.1.329](https://doi.org/10.1146/annurev.fluid.30.1.329)
7. ASHRAE, ASHRAE Handbook—Fundamentals, chapter 24, Airflow around buildings, ASHRAE, Atlanta, 2021.
8. U.S. Department of Energy, EnergyPlus Auxiliary Programs: EnergyPlus Weather File (EPW) Data Dictionary, EnergyPlus documentation, 2023.
9. I.P. Castro, A.G. Robins, The flow around a surface-mounted cube in uniform and turbulent streams, J. Fluid Mech. 79 (1977) 307–335. [doi:10.1017/S0022112077000172](https://doi.org/10.1017/S0022112077000172)
