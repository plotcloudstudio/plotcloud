---
id: report-wayfinding
sim: wayfinding
published: 2026-11-21
publishedText: 21 November 2026
auditText: 20 November 2026
title: Where visitors need signs: decision points, sightlines and a Signage Priority Score on the corridor network
type: Method and data report
summary: How the Wayfinding study finds the decision points on visitor routes from lifts, stairs and entrances, scores each with a Signage Priority Score from six stated factors, and evaluates proposed sign layouts by how many route decisions they guide. The report gives the sources of the route and network methods and of the wayfinding principles, and makes clear that the score's weights and thresholds are SimuSite's own and have not been calibrated against observed wayfinding.
image: img/home/wayfinding.webp
imageAlt: Corridor network with decision points ranked high, medium and low for signage
code: mvp/js/interior/wayfinding-signage.js, mvp/js/interior/wayfinding.js, emb/lib/plansim.js
tests: tests/wayfinding-signage.cjs, tests/wayfinding-layouts.cjs, tests/workspace-wayfinding-signage.cjs, tests/workspace-wayfinding-layout.cjs
keywords:
- Wayfinding
- Signage
- Decision points
- Legibility
- Healthcare planning
highlights:
- Routes run from lift lobbies, stair landings and entrances to each public room's door over the real floor; lifts cost the equivalent of 40 m plus 4 m per floor, stairs 12 m per floor.
- The public floor is thinned to its centre lines (Zhang–Suen) to find junctions, turns and lift or stair exits as candidate sign points.
- The Signage Priority Score weighs choice complexity 25, traffic 20, hidden destination 20, ambiguity 15 and wrong-turn cost 20, and is zeroed where a sign already covers the point; High ≥ 60, Medium ≥ 35.
- A sign counts as seen when at least 2 of the 8 one-metre spots before the point see it within 15 m and 60° of square-on.
- The principles are from the wayfinding literature, but the weights, thresholds and costs are engine choices that have not been calibrated against observed behaviour.
---
# Abstract

Wayfinding, finding one's way to a destination in an unfamiliar building, depends on the configuration of the plan, on what can be seen from each decision point, and on signage [1–4]. Hospitals, universities and transport buildings spend heavily on signs and still generate frequent requests for directions [5]. SimuSite's Wayfinding study helps decide where signs are most needed. It computes shortest routes from the places visitors start (lift lobbies, stair landings and entrances) to the door of each public room, extracts the corridor network, and identifies decision points where routes split. Each point receives a Signage Priority Score from six factors with written formulas: the number of ways on, the number of routes passing, whether the destination is out of sight, how ambiguous the choice is, the cost of a wrong turn, and whether an existing sign already covers it. Proposed sign layouts are then evaluated by the share of route decisions they guide. This report documents the method and its sources. Route finding, skeletonisation and line-of-sight tests are standard; the factors reflect principles from the wayfinding literature [1–4, 6]; the weights, thresholds and costs are SimuSite's choices and have not been compared with observed wayfinding. The study is a structured way to prioritise sign locations, not a prediction of navigation success.

# Body

## 1. Introduction

Weisman identified four classes of environmental variables that affect wayfinding: visual access, architectural differentiation, signs and room numbering, and plan configuration [1]. Passini and Arthur described wayfinding as a sequence of decisions made at decision points, each needing information about the way on, and argued that signs should be placed where decisions are made and should show the destination or the way to it [2, 3]. O'Neill showed that plan complexity reduces wayfinding performance and that signage improves it [4]. In multi-level buildings, vertical transitions are a particular source of disorientation [6]. Space syntax research adds that visual integration of a plan correlates with how easily people find their way [7]. These findings suggest that signs are most needed at decision points with many options, heavy use and poor visual access to destinations.

## 2. Method

### 2.1. Floor, starts and destinations

Each floor is rasterised: walls block except at doors, furniture blocks walking, and rooms are labelled. Rooms named as staff-only (utility, plant, storage and similar) are not walked through and are not destinations. Starts are lift lobbies (just outside the lift door), stair landings, the main entrances on the ground floor, or points the user places. Destinations are the public rooms, grouped by name so that "Patient room 301" and "Patient room 302" form one group. For rooms on other floors, routes go to a lift or stair paired between floors, with a lift costed as 40 m of walking plus 4 m per floor travelled (about 30 s of waiting and ride) and a stair as 12 m per floor.

### 2.2. Routes and network

Shortest routes on the grid use eight directions without corner cutting, and are pulled taut along lines of sight, as in the Circulation study. The public floor is thinned to its centre lines with the Zhang–Suen algorithm [8], spurs shorter than the corridor's width are pruned, and the skeleton becomes a graph whose nodes are junctions of three or more ways, ends, and sharp turns (more than a set angle with runs of at least 2 m on both sides). Junctions, turns and the exits from lifts and stairs are the candidate decision points.

### 2.3. Signage Priority Score

For each candidate point, from the routes passing through it:

- **A, choice complexity**: (branches − 1)/3, plus 0.2 if two branches leave within 45° of each other, capped at 1; 0.33 at a turn.
- **B, traffic**: the number of routes passing, normalised by the largest on the floor.
- **C, hidden destination**: the share of passing routes whose destination door, or a later point of the route, is not in sight from 5 m before the point.
- **D, ambiguity**: 1 minus the largest share of destinations down one branch, plus 0.25 if two branches lead to rooms of the same group, capped at 1.
- **F, wrong-turn cost**: the mean of twice the length (up to 40 m) of the branches a route does not take, divided by 40 m.
- **E, existing coverage**: 1 if an existing sign within 8 m is seen from the main approach, facing it within 60°.

The score is 100 × (25A + 20B + 20C + 15D + 20F)/100 × (1 − E). Points score High at 60 or more, Medium at 35 or more, and Low otherwise; a point on a route scoring at least the threshold (35 by default) with no existing coverage gets a recommended sign. A High point whose way on is mostly out of sight is reported as unresolved.

### 2.4. Sign layouts and their evaluation

A proposed sign stands on the wall ahead of arriving people when one is within 6 m, or hangs over the corridor, faces the main approach and lists, for each way on, the destinations down it with arrows relative to the walker. A route sees a sign if at least 2 of the 8 one-metre spots before the decision point see it, within the reading distance (15 m by default), ahead of the walker and within 60° of square-on. A decision is guided when a sign there is seen and lists the way taken. Three layouts are generated (minimum, recommended, maximum) and compared by sign count, decisions guided, routes fully guided and High points covered. Room identification signs beside doors are checked for being seen within 30° of square-on from 2–10 m.

The reading distance has two settings (added 24 November 2026). By default it is 15 m, an assumed figure. The option *From letter height (ADA 703.5.5)* derives it from the 2010 ADA Standards for Accessible Design [10]:

- Section 703.5.5 sets the minimum height of visual characters, measured on the uppercase I, by the height of the characters' baseline above the floor and by the horizontal viewing distance. Table 703.5.5 has three tiers:
  - baseline 1015–1780 mm: 16 mm below 1830 mm of viewing distance;
  - baseline 1780–3050 mm: 51 mm below 4570 mm;
  - baseline above 3050 mm: 75 mm below 6400 mm.
- In every tier, 3.2 mm is added per 305 mm of distance beyond the first.
- Section 703.5.6 requires visual characters at least 1015 mm above the floor.

The study turns the table round. For the letter height entered, the reading distance is the farthest distance at which that height still meets the table: d = d₀ + (h − h₀)/3.2 × 305 mm. Wall signs are taken with their letters about 1.5 m up (the first tier) and hung signs about 2.3 m up (the second). With 75 mm letters this gives 7.45 m on a wall and 6.86 m hung. A letter below its tier's minimum, or a baseline below 1015 mm, gives no reading distance.

The table is a compliance minimum, not a measured legibility limit. The derived distance therefore says how far a compliant sign of that size may be read, not how far people actually read it.

## 3. Parameters and their sources

Table 1. Settings of the Wayfinding study.

| Parameter | Value | Source | Audit status |
|---|---|---|---|
| Decision points as sign locations | Junctions, turns, vertical exits | Passini; Arthur and Passini [2, 3] | Sourced principle |
| Factor A, choice complexity | (branches − 1)/3 + 0.2 close | Principle from Weisman, O'Neill [1, 4] | Formula is an engine choice |
| Factor C, visual access | Destination seen from 5 m before | Weisman [1] | Formula is an engine choice |
| Factor D, ambiguity | Share and same-group penalty 0.25 | Arthur and Passini [3] | Formula is an engine choice |
| Factor F, wrong-turn cost | 2 × branch length, cap 40 m | Engine choice | Assumption |
| Weights A, B, C, D, F | 25, 20, 20, 15, 20 | Engine choice | Flagged: not calibrated; editable |
| Classes | High ≥ 60, Medium ≥ 35 | Engine choice | Flagged: not calibrated |
| Lift and stair costs | 40 m + 4 m/floor; 12 m/floor | Engine choice ("about 30 s of wait and ride") | Assumption |
| Sign seen | 2 of 8 spots, within the reading distance, ≤ 60° | Engine choice | Plausible |
| Reading distance, default | 15 m | Engine choice | Assumption; legibility depends on letter height [9] |
| Reading distance, ADA option | From letter height: Table 703.5.5 tiers (16 / 51 / 75 mm below 1830 / 4570 / 6400 mm), + 3.2 mm per 305 mm; letters at least 1015 mm up (703.5.6) | 2010 ADA Standards, 703.5.5 and 703.5.6 [10] | Sourced (a compliance minimum, not a legibility measurement) |
| Letter baseline heights | Wall sign 1.5 m, hung sign 2.3 m | Engine choice | Assumption: picks the Table 703.5.5 tier |
| Existing-sign reach | 8 m | Engine choice | Assumption |
| Skeleton | Zhang–Suen thinning | Zhang and Suen [8] | Sourced |
| Routes | Grid shortest paths, taut | Standard | Sourced |

## 4. Verification and validation status

The repository has four tests for this study. `tests/wayfinding-signage.cjs` and `tests/wayfinding-layouts.cjs` run the engine on synthetic floors and check, among other things, that layouts A, B and C have increasing sign counts, that the recommended layout guides at least 80 % of decisions and covers every High point, that a hung sign shows mirrored arrows on its back face computed from the geometry, that a sign moved into a room is flagged with a visibility issue and passes again when moved back, and that adding the recommended signs reduces the recommendations and raises clarity. The Workspace tests check the study in the application. In our run of `tests/wayfinding-layouts.cjs` on 21 November 2026, all eight checks passed; on the test's hospital floor the minimum and balanced layouts each used 4 signs and the maximum layout 11, all three guided 43 of 43 decisions and 22 of 22 routes, and adding the balanced layout reduced the points needing a sign from 2 to 0. These are consistency tests: they confirm that the score and the evaluation behave as designed, not that the design matches how people find their way.

Two tests cover the reading distance (24 November 2026):

- `tests/ada-sign.test.mjs` checks the derivation against Table 703.5.5:
  - each tier's minimum and its boundaries (1780 and 3050 mm);
  - the 3.2 mm per 305 mm step;
  - the 1015 mm floor of 703.5.6.
- `tests/batch3-options.cjs` runs the hospital example with one proposed sign at every candidate point:

| Reading distance | Decisions guided (of 441) |
|---|---|
| 15 m | 322 |
| ADA, 75 mm letters (7.45 m wall, 6.86 m hung) | 322 |
| ADA, 25 mm letters (2.69 m wall; hung signs below the 51 mm tier minimum) | 29 |

The 75 mm case matches 15 m because the test only looks at the last 8 m before each point.

In the end-to-end audit of 20 November 2026 on the two-storey audit block, the study found 24 routes from 3 starts (1 stair, 2 entrances), 3 decision points on visitor routes (0 High, 1 Medium, 2 Low), recommended 1 sign, reported no unresolved points and no route without a valid path, and estimated that existing signage covered 25 % of the choices.

## 5. Discussion

**Grounded principles, uncalibrated numbers.** Each factor corresponds to a variable that the literature associates with wayfinding difficulty [1–4, 6, 7]. The functional forms, weights and class thresholds are reasonable but arbitrary; another reasonable choice could reorder Medium points. The weights are exposed so that a wayfinding consultant can adjust them, and the study reports the factors behind each score. Calibration would require comparing scores with observed hesitation, errors or requests for directions in existing buildings, for example by the methods of Hölscher and colleagues [6].

**What a plan cannot show.** Landmarks, colour, lighting, the content and legibility of signs, and the familiarity of visitors all affect wayfinding and are not modelled [3, 5]. By default the visibility test assumes a sign is legible within 15 m, which depends on letter height; the ADA option (Section 2.4) replaces this with the distance at which the entered letter height meets ADA Table 703.5.5, a compliance threshold rather than a legibility measurement; signage guidance relates letter height to viewing distance [9].

**Groups from names.** Destination groups and staff-only rooms are read from room names. Inconsistent naming will distort ambiguity scores and routes; the user can correct groups.

## 6. Conclusion

The Wayfinding study turns established wayfinding principles into an explicit, adjustable score and evaluates sign layouts with geometric tests. Its route and network methods are standard and its tests confirm internal consistency. Its weights, thresholds and costs are uncalibrated engine choices, so its output should be used to prioritise and discuss sign locations with a wayfinding designer, not to claim a level of wayfinding performance.

# References

1. J. Weisman, Evaluating architectural legibility: way-finding in the built environment, Environ. Behav. 13 (2) (1981) 189–204. [doi:10.1177/0013916581132004](https://doi.org/10.1177/0013916581132004)
2. R. Passini, Wayfinding in Architecture, Van Nostrand Reinhold, New York, 1984.
3. P. Arthur, R. Passini, Wayfinding: People, Signs, and Architecture, McGraw-Hill, New York, 1992.
4. M.J. O'Neill, Effects of signage and floor plan configuration on wayfinding accuracy, Environ. Behav. 23 (5) (1991) 553–574. [doi:10.1177/0013916591235002](https://doi.org/10.1177/0013916591235002)
5. J.R. Carpman, M.A. Grant, Design That Cares: Planning Health Facilities for Patients and Visitors, 3rd ed., Jossey-Bass, San Francisco, 2016.
6. C. Hölscher, T. Meilinger, G. Vrachliotis, M. Brösamle, M. Knauff, Up the down staircase: wayfinding strategies in multi-level buildings, J. Environ. Psychol. 26 (4) (2006) 284–299. [doi:10.1016/j.jenvp.2006.09.002](https://doi.org/10.1016/j.jenvp.2006.09.002)
7. S. Haq, C. Zimring, Just down the road a piece: the development of topological knowledge of building layouts, Environ. Behav. 35 (1) (2003) 132–160.
8. T.Y. Zhang, C.Y. Suen, A fast parallel algorithm for thinning digital patterns, Commun. ACM 27 (3) (1984) 236–239. [doi:10.1145/357994.358023](https://doi.org/10.1145/357994.358023)
9. D. Gibson, The Wayfinding Handbook: Information Design for Public Places, Princeton Architectural Press, New York, 2009.
10. U.S. Department of Justice, 2010 ADA Standards for Accessible Design, Section 703.5.5 Character Height and Table 703.5.5 Visual Character Height; Section 703.5.6 Height From Finish Floor or Ground. U.S. Access Board. [access-board.gov/ada/#ada-703](https://www.access-board.gov/ada/#ada-703)
