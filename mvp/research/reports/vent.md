---
id: report-vent
sim: vent
published: 2026-11-20
publishedText: 20 November 2026
auditText: 20 November 2026
title: Whole-building natural ventilation with a multizone pressure network: wind, stack and single-sided flow
type: Method and data report
summary: How the Natural ventilation study estimates the outdoor air each room receives from wind and buoyancy, with a multizone orifice network solved by Newton–Raphson and the single-sided correlation of de Gids and Phaff. The report gives the sources of the discharge coefficient, wind pressure coefficients and wind profile, and records two departures from the cited sources found in the audit and corrected on 21 November 2026.
image: img/home/vent.webp
imageAlt: Air change rate per room with arrows showing the airflow through windows and doors
code: emb/modeler.html, emb/vent.html, mvp/js/workspace-chrome.js
tests: tests/workspace-vent-acoustics.cjs, tests/vent-cp-swami.test.mjs
keywords:
- Natural ventilation
- Airflow network
- Stack effect
- Wind pressure coefficient
- Single-sided ventilation
highlights:
- Each room is a well-mixed zone; windows and doors are orifices with Cd = 0.6 split into vertical strips so stack flow can reverse with height.
- Wind pressure uses the AIVC low-rise pressure coefficients for the chosen terrain and the ASHRAE conversion of the weather-station wind to roof height on the site; buoyancy uses the ideal-gas density of indoor and outdoor air.
- Rooms ventilated from one facade also get the de Gids and Phaff (1982) single-sided flow when it is larger.
- The audit found that the Workspace pressure-coefficient table differed from the AIVC table the method cites, and that the "neutral plane (stack alone)" was taken from the combined wind-and-stack solution; both are corrected.
---
# Abstract

Natural ventilation supplies outdoor air through windows, doors and vents driven by wind pressure on the facades and by the buoyancy of warm indoor air [1–3]. Design guides such as CIBSE AM10 and the AIVC guide describe two levels of calculation: simple correlations for single rooms, and multizone airflow networks in which each room is a node and each opening a nonlinear flow resistance [1, 2, 4]. SimuSite's Natural ventilation study builds such a network for the whole building model, with every floor, stair and void, and solves it for one wind speed, wind direction and pair of indoor and outdoor temperatures. It reports the outdoor-air flow and air change rate of each room, the share of air that arrives second-hand through other rooms, and the direction of flow through every opening. This report documents the equations, the constants and their sources. The orifice equation, the discharge coefficient, the buoyancy terms and the de Gids and Phaff single-sided correlation are correctly sourced. Three departures from the cited sources were found in the audit: the facade pressure-coefficient table in the Workspace engine was not the AIVC table that the method text and the stand-alone ventilation page use, the station wind was applied to the site without the terrain conversion, and the "neutral plane (stack alone)" value was taken from the combined wind-and-stack pressures. All three were corrected on 21 November 2026; none invalidated the network method.

# Body

## 1. Introduction

For a room with openings on one facade, empirical correlations from field measurement give the ventilation rate directly [3, 5]. For cross-ventilation and for multi-storey buildings with stairs and atria, the flows through all openings are coupled: the pressure in each room adjusts until the mass entering equals the mass leaving. Multizone network models solve this balance; they are the basis of programs such as AIRNET, COMIS and CONTAM [4, 6]. They assume each zone is well mixed and each opening behaves as a sharp-edged orifice, and they need wind pressure coefficients on the facades, which in early design come from generic tables rather than from wind-tunnel tests [2, 7].

## 2. Method

### 2.1. Zones and links

Rooms are taken from the building model on every level. Each exterior window or door becomes a link between its room and outside; each interior door a link between two rooms; each stair or floor void a link between the room below and the room above, or to outside if it reaches the roof. To represent two-way stack flow through a tall opening, each window is divided into six horizontal strips and each door into four, each strip with its own height z [1, 3]. The open area of a window is its width times its height times the opening share set by the user; closed outside doors are given a 1 cm crack.

### 2.2. Pressures

Indoor pressure in room r at height z is P_r − ρ_i g z, where P_r is the unknown room pressure at z = 0 and ρ_i the indoor air density. Outdoor pressure at an opening is C_p ½ ρ_o U_H² − ρ_o g z, with C_p the wind pressure coefficient for the facade, U_H the wind speed at roof height H and ρ_o the outdoor density [2, 7]. Densities follow the ideal-gas law at the given temperatures. The weather file's wind U_met is measured at 10 m at a station in open terrain. Following ASHRAE Fundamentals, it is carried up to the gradient height of open terrain and back down to roof height in the site's terrain: U_H = U_met (270 / 10)^0.14 (H / δ)^α, with H = max(3 m, top of the building), and δ = 270, 370 or 460 m and α = 0.14, 0.22 or 0.33 for open, suburban and urban terrain [7].

C_p depends on the angle between the wind and the facade's outward normal, interpolated in the AIVC low-rise table at 0°, 45°, 90°, 135° and 180° [2]. The shelter row follows the terrain: open terrain uses the exposed row, suburban the row for neighbours half as tall, and urban the row for neighbours as tall. Roof openings of voids use C_p = −0.5.

**Swami–Chandra option (added 23 November 2026).** As an alternative to the table, the Workspace can take facade C_p from the Swami and Chandra (1988) correlation for surface-averaged pressure coefficients on low-rise buildings [9], in the form given in the EnergyPlus Engineering Reference [10]:

C_p = 0.6 ln[1.248 − 0.703 sin(α/2) − 1.175 sin²α + 0.131 sin³(2αG) + 0.769 cos(α/2) + 0.07 G² sin²(α/2) + 0.717 cos²(α/2)]

Here α is the angle between the wind direction and the facade's outward normal, and G is the natural log of the ratio of the facade's width to the width of the adjacent wall. The study takes these widths from the plan's bounding box: a facade facing mostly along the plan's y axis spans its x extent. The correlation was fitted to surface-averaged data for rectangular, exposed low-rise buildings with sides up to 8:1 and has no shelter term [9], so the option is labelled "exposed" and the terrain's shelter class is not applied to it. At α = 0 it gives 0.603. For a square plan (G = 0) it gives −0.443 at 90° and −0.364 at 180°, against 0.7, −0.5 and −0.2 in the AIVC exposed row.

### 2.3. Flow equation and solution

The mass flow through a link is the orifice equation ṁ = C_d A √(2 ρ |Δp|) sign(Δp), with C_d = 0.6 and ρ the density of the air upstream [1, 3]. Below |Δp| = 0.02 Pa the relation is linearised so that the Jacobian stays finite. The mass balance of every room is solved for the room pressures with Newton–Raphson, a damping factor of 0.8 and up to 120 iterations [4]. Flow rates are then converted to volume flows, and the outdoor-air fraction of each room is found by Gauss–Seidel iteration on f_r Q_in,r = Q_out→r + Σ f_s Q_s→r, so that air arriving through a corridor counts as partly used air.

### 2.4. Single-sided ventilation

The network cannot represent the turbulent pumping that ventilates a room with openings on one facade only. For such rooms the study also computes the de Gids and Phaff correlation, Q = (A/2) √(C₁ U² + C₂ H ΔT + C₃), with C₁ = 0.001, C₂ = 0.0035 and C₃ = 0.01, where A is the open area, H the opening height and U the 10 m wind speed [5]. This is the form given in CIBSE AM10 and BS 5925 [1, 3]. The larger of the network and correlation flows is used.

### 2.5. Outputs

The study reports for each room the outdoor-air flow in L/s, the air change rate (flow × 3.6 / volume), the outdoor-air fraction, and the building total. It also reports a stack-only neutral plane height, z_n = Σ V_r (−P_r / (Δρ g)) / Σ V_r, from a second solve of the same network with no wind. The legend compares air change rates with a user-set target; the ASHRAE 62.1 natural ventilation procedure governs opening size, not a fixed rate [8].

A "Through the year" mode takes the window-open hours of the project weather file (hours with outdoor temperature in a user-set range), groups them by 16 wind directions, 5 speed bands and 3 temperature bands, solves the network once per group, and reports for each room the share of window-open hours at or above the target and the median air change rate. Indoor temperature in each group is the set value or 1 K above outdoor, whichever is higher.

## 3. Parameters and their sources

Table 1. Inputs and constants of the Natural ventilation study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Discharge coefficient C_d | 0.6 | CIBSE AM10; BS 5925 [1, 3] | Sourced (sharp-edged opening) |
| Flow exponent | 0.5 | Orifice equation [1, 4] | Sourced |
| Strips per window / door | 6 / 4 | Engine choice | Numerical setting |
| Linearisation threshold | 0.02 Pa | Engine choice | Numerical setting |
| Wind profile α, gradient height δ | 0.14 / 0.22 / 0.33; 270 / 370 / 460 m | ASHRAE Fundamentals ch. 24 [7] | Sourced; station-to-site conversion added 21 November 2026 |
| Reference height | max(3 m, roof) | Engine choice | Reasonable for low-rise tables [2] |
| Facade C_p (Workspace before 21 November 2026) | 0.6, 0.4, −0.3, −0.45, −0.35 at 0–180° | Not traced | Replaced by the AIVC table |
| Facade C_p (Workspace and Ventilation page) | Exposed 0.7, 0.35, −0.5, −0.4, −0.2; half-height neighbours 0.4, 0.1, −0.3, −0.35, −0.2; equal-height neighbours 0.2, 0.05, −0.25, −0.3, −0.25 | AIVC guide, low-rise tables [2] | Sourced |
| Facade C_p, Swami–Chandra option | 0.6 ln[…] by angle and side ratio G (formula in Section 2.2) | Swami and Chandra 1988 [9]; EnergyPlus Engineering Reference [10] | Sourced; exposed, rectangular plans only; G from the plan's bounding box (added 23 November 2026) |
| Roof void C_p | −0.5 | Engine choice | Assumption, consistent in sign with flat-roof suction [2, 7] |
| Single-sided C₁, C₂, C₃ | 0.001, 0.0035, 0.01 | de Gids and Phaff [5]; CIBSE AM10 [1] | Sourced |
| Defaults | U_10 3.5 m/s, from 225°, T_o 20 °C, T_i 24 °C | Engine choice | Editable inputs |
| Closed-door crack | 1 cm × door width | Engine choice | Assumption |

## 4. Verification and validation status

The Workspace test `tests/workspace-vent-acoustics.cjs` checks that the network covers rooms on both levels, that ajar windows let in less air than open ones, that stack alone still gives a positive flow, that air enters on one side and leaves on the other, and that the through-the-year mode returns more than 500 window-open hours. These are qualitative checks. There is no comparison against measured airflows or against CONTAM. A useful next step would be the analytical two-opening stack case, Q = C_d A* √(2 g h ΔT / T), and the cross-ventilation case Q = C_d A* U √ΔC_p, which have closed-form solutions [1, 3], followed by a CONTAM comparison for a multi-storey case [6].

In the end-to-end audit of 20 November 2026 on a two-storey, twenty-room block with a Chicago TMY3 file (wind from the south at 4.9 m/s), the study reported 13,485 L/s of outdoor air, 32.4 air changes per hour for the whole building and at least 5 air changes per hour in every room, and a neutral plane at −1.0 m. After the corrections of 21 November 2026 (AIVC table, suburban terrain, station-to-site wind, stack-only neutral plane) the same case gives 7,829 L/s, 18.8 air changes per hour, every room still at 5 or more, and a stack-only neutral plane 3.0 m above level 0, inside the two-storey building as expected. The lower flow comes mainly from the suburban wind at roof height, which is about 0.6 times the open-terrain wind at 10 m, and from the smaller sheltered pressure coefficients.

**Swami–Chandra coefficients.** `tests/vent-cp-swami.test.mjs` runs the engine's function in Node and checks it against the printed formula. It gives 0.603 at 0°, −0.443 at 90° and −0.364 at 180° for a square plan, matches the formula at 25 combinations of angle (15–165°) and side-ratio log (−1 to ln 3), and treats ±α and α + 360° alike. For comparison with the AIVC exposed row at 0°, 45°, 90°, 135° and 180°, it gives 0.603, 0.323, −0.443, −0.535 and −0.364, against 0.7, 0.35, −0.5, −0.4 and −0.2. On the hospital example, with the wind from 225° and 20 °C outside and 22 °C inside, the network gave a mean of 2.54 air changes per hour at 2 m/s and 10.22 at 8 m/s with the AIVC suburban row, and 3.56 and 14.24 with Swami–Chandra. The difference is mostly the absence of shelter in the correlation. With the default AIVC option the Workspace result is unchanged from before (1.68 air changes per hour in the hospital example's default run).

## 5. Discussion

**Pressure coefficients.** Generic C_p tables are the largest source of uncertainty in network models, often ±50 % or more on the flow [2, 4]. The stand-alone ventilation page uses the AIVC low-rise table with three shelter classes, which the method text cites [2]. At the time of the audit the Workspace engine used a different single table (0.6, 0.4, −0.3, −0.45, −0.35) with no shelter class and no source in the code; its leeward and side values differed from the AIVC exposed row by up to 0.2. It now uses the AIVC table, with the shelter class taken from the project's terrain. The Swami and Chandra correlation [9], which gives C_p as a function of wind angle and side ratio, is now available as an option (Section 2.2). It suits exposed, rectangular buildings. In sheltered sites the AIVC rows remain the better default.

**Wind profile.** ASHRAE converts the meteorological-station wind to the site by passing through the gradient height: U_H = U_met (δ_met / H_met)^α_met (H / δ)^α [7]. At the time of the audit the engine applied the site exponent directly to the station speed at 10 m, which assumes the station is in the same terrain as the site and, for an airport station and an urban site, overstates the wind at roof height by about 20–40 %. The engine now applies the full conversion, assuming the station is in open terrain, as airport stations usually are.

**Neutral plane.** The code describes the neutral plane as the height where inside and outside pressure match with no wind, but at the time of the audit the value was computed from room pressures solved with wind included. In a strong wind the room pressures are set mainly by the facade pressures, and the computed height fell below the floor, as the audit's −1.0 m showed. The engine now solves the network a second time with no wind and takes the neutral plane from that solution.

**Model limits.** Well-mixed zones cannot show air speed or the distribution of fresh air within a room, and the orifice model does not apply to large openings with bidirectional turbulent exchange [1, 3]. Each solve is a single steady condition. The through-the-year mode averages steady solutions over binned hours; it does not model thermal mass, the indoor temperature response, or occupants closing windows.

## 6. Conclusion

The network method, discharge coefficient, buoyancy terms and single-sided correlation of the Natural ventilation study are correctly sourced and implemented. The pressure-coefficient table, the station-to-site wind conversion and the stack-only neutral plane were corrected after the audit. Results are suitable for comparing opening strategies in early design, not for demonstrating compliance.

# References

1. CIBSE, AM10: Natural ventilation in non-domestic buildings, Chartered Institution of Building Services Engineers, London, 2005.
2. M.W. Liddament, A Guide to Energy Efficient Ventilation, Air Infiltration and Ventilation Centre (AIVC), Coventry, 1996.
3. British Standards Institution, BS 5925:1991, Code of practice for ventilation principles and designing for natural ventilation, BSI, London, 1991.
4. D. Etheridge, Natural Ventilation of Buildings: Theory, Measurement and Design, Wiley, Chichester, 2012. [doi:10.1002/9781119951773](https://doi.org/10.1002/9781119951773)
5. W. de Gids, H. Phaff, Ventilation rates and energy consumption due to open windows: a brief overview of research in the Netherlands, Air Infiltration Review, AIVC, 1982.
6. W.S. Dols, B.J. Polidoro, CONTAM User Guide and Program Documentation, Version 3.4, NIST Technical Note 1887 Rev. 1, National Institute of Standards and Technology, Gaithersburg, 2020. [doi:10.6028/NIST.TN.1887r1](https://doi.org/10.6028/NIST.TN.1887r1)
7. ASHRAE, ASHRAE Handbook—Fundamentals, chapter 24, Airflow around buildings, ASHRAE, Atlanta, 2021.
8. ASHRAE, ANSI/ASHRAE Standard 62.1-2022, Ventilation and Acceptable Indoor Air Quality, ASHRAE, Atlanta, 2022.
9. M.V. Swami, S. Chandra, Correlations for pressure distribution on buildings and calculation of natural-ventilation airflow, ASHRAE Transactions 94 (1) (1988) 243–266.
10. U.S. Department of Energy, EnergyPlus Engineering Reference, version 9.6, AirflowNetwork model, wind pressure calculations (surface-average calculation for low-rise buildings after Swami and Chandra). [bigladdersoftware.com](https://bigladdersoftware.com/epx/docs/9-6/engineering-reference/airflownetwork-model.html)
