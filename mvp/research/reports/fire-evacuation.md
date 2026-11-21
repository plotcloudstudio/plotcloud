---
id: report-fire-evacuation
sim: fire-evacuation
published: 2026-11-21
publishedText: 21 November 2026
auditText: 20 November 2026
title: Fire evacuation in the Workspace: the sources of the egress parameters and an audit of the shipped engine
type: Method and data report
summary: A short data report on the Fire evacuation study that lists the sources of its walking speeds, flows, pre-movement times and occupant loads, records the results of the November 2026 audit, and points to the full verification article, which tests the engine against IMO MSC.1/Circ.1533 and an SFPE hand calculation.
image: img/home/fire-evacuation.jpg
imageAlt: Evacuation routes from rooms to exits and assembly points on two floors
code: mvp/js/interior/egress.js, mvp/js/interior/egresscode.js, mvp/js/workspace-chrome.js
tests: tests/egress-engine.test.mjs, tests/workspace-fire-evacuation.cjs
keywords:
- Evacuation modelling
- Required safe escape time
- Hydraulic model
- Pre-movement time
- Progressive horizontal evacuation
highlights:
- Movement follows the SFPE hydraulic model: speed and specific flow fall with density; doors and stairs have specific flow limits.
- Detection, alarm and pre-movement times follow PD 7974-6 by occupancy scenario; occupant loads follow IBC Table 1004.5.
- A full verification article reports 18 component tests after IMO MSC.1/Circ.1533 within 0–3 % (one at 5.6 %) and a 3-storey SFPE comparison within 5.6 %.
- The engine's unit tests and the Workspace tests passed in this audit, except one check of an old page address.
- Staffing, preparation times and occupant groups dominate the uncertainty; results compare designs and are not predictions or code checks.
---
# Abstract

The Fire evacuation study estimates the required safe escape time (RSET) of a building, either with everyone leaving at once or by a hospital's progressive horizontal evacuation followed by descent. It is a grid-based stochastic model with flow limits from the hydraulic model of the SFPE Handbook [1], detection, alarm and pre-movement times from PD 7974-6 [2], occupant loads from IBC Table 1004.5 [3], and occupant groups whose speeds come from published measurements [4, 5]. Because the study already has a detailed verification article, "How accurate is the fire evacuation simulation?", published on this blog on 10 November 2026, this report is brief. It summarises the sources of each parameter, records the results of the November 2026 audit of all SimuSite simulations, and directs readers to the article for the verification tests, sensitivity analyses and the hospital case study.

# Body

## 1. Method in brief

The plan of each floor becomes a walking grid. Occupants are placed by room use at the IBC occupant load factors, or entered by the user, in groups (adults, older adults, children, walking-aid users and wheelchair users). After detection and alarm, each occupant waits a pre-movement time drawn from a distribution for the scenario, then walks the shortest available route to an exit and an assembly point. Speeds fall with local density, and doors and stairs pass people at their specific flows, following the hydraulic model [1]. In hospital mode, inpatients are moved by staff, first horizontally through smoke doors into a neighbouring compartment and then down the stairs, with preparation times by care level. Each scenario is run many times with random fire locations and blocked exits, and the median and 10th and 90th percentiles of RSET are reported.

## 2. Parameters and their sources

Table 1. Main parameters of the Fire evacuation study.

| Parameter | Source | Audit status |
|---|---|---|
| Speed–density and specific flow relations; door and stair flow limits | SFPE Handbook, 5th ed., hydraulic model [1] | Sourced |
| Detection, alarm, pre-movement by scenario | PD 7974-6:2019 [2] | Sourced |
| Occupant load factors | IBC 2021 Table 1004.5 [3] | Sourced |
| Speeds of people with reduced mobility | Measured values in the literature [4, 5] | Sourced; see the verification article |
| Inpatient mobility shares, staff numbers, preparation times | Engine defaults, editable | Assumptions, labelled as such in the results |
| Exit found blocked | 15 % of runs (one exit) | Assumption, labelled |

## 3. Verification

The verification article reports 18 component tests after IMO MSC.1/Circ.1533 [6] and the verification categories of NIST TN 1822 [7] and ISO 20414 [8]: speeds, flows and pre-movement distributions agree with analytical values within 0–3 %, and a three-storey building agrees with an SFPE hand calculation within 5.6 %. It also finds that the 0.5 m grid keeps only 1 m of a 1.8 m clear corridor (0.25 m keeps 1.5 m), that the 90th percentile needs about 50 runs to settle, and that staffing, patient preparation and occupant groups dominate the uncertainty.

## 4. Audit of 21 November 2026

`tests/egress-engine.test.mjs` passed all five of its tests: compartments, stairs and population are found in a ward block; horizontal relocation through the smoke door is repeatable; the fire floor and those above leave by the stair; occupants are placed by room use with stages in order; and inpatients take far longer than everyone walking. `tests/workspace-fire-evacuation.cjs` passed its six checks of the study in the Workspace (building scene, everyone-out run, horizontal-then-down run with a median of 17.2 min, 3D view, playback and saving) and then timed out on a final check that an old page address redirects to the Workspace, which is a navigation test rather than an engine test.

In the end-to-end run of 20 November 2026 on the two-storey audit block, the study reported a median RSET of 17.1 min (10th percentile 12.7 min, 90th percentile 21.7 min) for 52 people with 26 inpatients moved by 7 staff. The result is dominated by the staff-assisted movement of inpatients, as the verification article explains. The study states its assumptions in its results and does not check code compliance; the separate Code check does.

## 5. Conclusion

The Fire evacuation study is the most thoroughly verified of SimuSite's simulations. Its movement and timing parameters are sourced, its engine passes its tests, and its uncertain inputs are labelled as assumptions. For the evidence, read the verification article.

# References

1. S.M.V. Gwynne, E.R. Rosenbaum, Employing the hydraulic model in assessing emergency movement, in: M.J. Hurley (Ed.), SFPE Handbook of Fire Protection Engineering, 5th ed., Springer, New York, 2016.
2. BSI, PD 7974-6:2019, The application of fire safety engineering principles to fire safety design of buildings — Part 6: Human factors: Life safety strategies — Occupant evacuation, behaviour and condition, BSI, London, 2019.
3. International Code Council, 2021 International Building Code, Table 1004.5, Maximum floor area allowances per occupant, ICC, Washington, DC, 2020.
4. K.E. Boyce, T.J. Shields, G.W.H. Silcock, Toward the characterization of building occupancies for fire safety engineering: capabilities of disabled people moving horizontally and on an incline, Fire Technol. 35 (1999) 51–67.
5. A.R. Larusdottir, A.S. Dederichs, Evacuation of children: movement on stairs and on horizontal plane, Fire Technol. 48 (2012) 43–53.
6. International Maritime Organization, MSC.1/Circ.1533, Revised guidelines on evacuation analysis for new and existing passenger ships, IMO, London, 2016.
7. E. Ronchi, E.D. Kuligowski, P.A. Reneke, R.D. Peacock, D. Nilsson, The process of verification and validation of building fire evacuation models, NIST Technical Note 1822, National Institute of Standards and Technology, Gaithersburg, 2013. [doi:10.6028/NIST.TN.1822](https://doi.org/10.6028/NIST.TN.1822)
8. ISO 20414:2020, Fire safety engineering — Verification and validation protocol for building fire evacuation models, International Organization for Standardization, Geneva, 2020.
