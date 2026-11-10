# How accurate is the fire evacuation simulation? Verification, sensitivity and a hospital case study of a grid-based evacuation model for early design

PlotCloud Research Notes · Technical note · not peer reviewed · Published online 10 November 2026

PlotCloud Studio. PlotCloud, building performance software for architects. Prepared with AI assistance; human review pending.

## Highlights

- A grid-based stochastic evacuation model for early design is verified.
- 18 component tests after IMO MSC.1/Circ.1533 pass, within 0–3 % (one at 5.6 %).
- A 0.5 m grid keeps 1 m of a 1.8 m corridor; a 0.25 m grid keeps 1.5 m.
- The 90th percentile needs about 50 runs to settle; the mean about 20.
- Staffing, preparation and occupant groups dominate the uncertainty.

## Abstract

Fire Evacuation in PlotCloud estimates how long a building takes to clear, either with everyone leaving at once or by a hospital's progressive horizontal evacuation followed by descent. It is a grid-based stochastic model with hydraulic flow limits after the SFPE Handbook, pre-movement times after PD 7974-6, and five occupant groups (adults, older adults, children, walking-aid users and wheelchair users) whose speeds come from published measurements. This study asks whether the engine implements its equations correctly, how many runs give stable results, how sensitive results are to the grid, to random incidents, to occupant groups and to hospital staffing, and what accuracy can honestly be claimed. Eighteen verification tests after IMO MSC.1/Circ.1533 and the verification categories of NIST TN 1822 and ISO 20414 all pass: speeds, flows and pre-movement distributions agree with analytical values within 0–3 %, and a three-storey building agrees with an SFPE hand calculation within 5.6 %. The study found and fixed five defects. The 0.5 m grid keeps only 1 m of a 1.8 m clear corridor (0.25 m grid: 1.5 m). The mean settles within 1 % after about 20 runs and the 90th percentile needs about 50. Inputs about people dominate the uncertainty: in the example hospital, staffing and patient preparation move the median by 43 % and 20 %, occupant groups move the clinic's everyone-out median by 40 %, and a wheelchair user's wait for assisted descent sets the end of the evacuation when there are wheelchair users above the ground floor. The model suits the comparison of design options under stated assumptions; it is not a prediction of a real evacuation time and not a code-compliance check.

Keywords: Evacuation modelling; Verification; Required safe escape time (RSET); Hospital evacuation; People with reduced mobility; Children; Monte Carlo convergence

## 1. Introduction

Architects meet evacuation questions early: where to put a second stair, how wide a corridor or a cross-corridor door must be, how many beds a smoke compartment can hold, whether a ward can be cleared with the night staff. Prescriptive codes answer with rules on travel distance, exit width and compartment size. Performance-based design asks instead whether the required safe escape time (RSET) stays below the available safe escape time (ASET) with a margin [1]. PD 7974-6 divides RSET into detection, alarm, pre-movement and travel [1], and recorded evacuations show that pre-movement is often the longest and most uncertain part [2].

PlotCloud's Fire Evacuation is a design-stage screening tool inside the architect's model. Earlier versions showed routes and timings without a check against analytical answers, and with parameters chosen by judgement. This article documents the evidence behind each parameter, verifies the engine, measures how much each uncertain input matters, and reports the changes made to the software as a result.

Research questions:

1. Verification: do the walking speeds, flows, pre-movement times and route choices produced by the engine match their analytical values?
2. Numerical uncertainty: how do the grid size and the number of runs affect results?
3. Behavioural and operational uncertainty: how sensitive are results to incidents, occupant groups, staffing and patient preparation?
4. Accuracy: what accuracy can be claimed, and for what use?

## 2. Background

### 2.1. Evacuation time and its stages

The comparison of RSET with ASET underlies life-safety fire engineering [1]. RSET is detection plus alarm plus pre-movement plus travel, travel including the queueing at doors and stairs. Pre-movement times are widely spread and often long [2], so the model draws them at random for each person from a lognormal set by the building use, rather than using a single number.

### 2.2. Movement data

The density–speed–flow relations of Fruin [3] and of Predtechenskii and Milinskii [4], and Weidmann's compilation of free walking speeds [5], underlie the hydraulic method of the SFPE Handbook [6]. In that method, speed falls linearly with density above 0.54 persons/m², S = k(1 − 0.266 D). The maximum specific flow is 1.32 persons/s per metre of effective width through doors and 1.01 on a 7/11 stair. The effective width is the clear width less a boundary layer, 0.15 m each side for doors and stairs. Level walking has k = 1.40, giving 1.19 m/s at low density; a 7/11 stair has k = 1.08, giving 0.92 m/s along the line of travel [6]. Proulx measured evacuations of apartment buildings [7].

### 2.3. Occupants who move differently

Boyce, Shields and Silcock measured people with disabilities moving horizontally and on an incline [8]. As reproduced in the SFPE Handbook's movement chapters, people with walking aids moved at roughly 0.8 m/s on average (from about 0.57 m/s with a walking frame to about 0.94 m/s with crutches), and manual wheelchair users at about 0.69 m/s. Field studies of pedestrians found older pedestrians walking markedly slower than younger ones [9]. Larusdottir and Dederichs measured children in 16 evacuation experiments in ten Danish day-care centres [10]. Children of 3–6 years walked at 0.84 m/s on the level (SD 0.25, range 0.42–1.36) and those of 0–2 years at 0.60 m/s; on spiral stairs speeds were 0.13–0.58 m/s depending on the stair and on familiarity [10], [11].

### 2.4. Hospitals

Patients who cannot walk depend on staff, so hospitals plan for progressive horizontal evacuation into the next smoke compartment, with vertical evacuation as a later stage [12], [13], [14]. Hunt, Galea and Lawrence measured trained staff moving a test subject with four assistance devices through eleven floors of a hospital stair [15]. Joyce, Lawrence and Galea collected device parameters for their planning tool HEPTAD, stated to be for demonstration purposes only [16]. These include preparation times of 29 s for an evacuation chair, 53 s for a rescue sheet and 31 s for a hospital bed, after Hunt et al. [15] and Hoondert and Peters [17].

### 2.5. Models, verification and validation

Building evacuation models range from hydraulic hand methods to coarse networks, fine grids and continuous models [18], such as the social-force model [19]. Grid models commonly route people down distance fields found with Dijkstra's algorithm [20]. NIST TN 1822 sets out verification and validation of evacuation models [21], ISO 20414 turns it into a protocol [22], and IMO MSC.1/Circ.1533 gives simple component tests that are widely reused for buildings [23]. Convergence criteria for the number of stochastic runs were proposed by Ronchi, Reneke and Peacock [24] and extended to several outputs by Smedberg, Ronchi and Kinsey [25].

### 2.6. The gap

The literature gives sourced values for movement, and methods for verification and for run counts. It gives no measured rates for incidents such as falls during an evacuation, and few data for older adults' pre-movement or for the time a wheelchair user waits for assisted descent. This study uses sourced values where they exist, labels every other value as an assumption, and measures how much each assumption matters.

## 3. Methods

### 3.1. The model

Each level of the building model is a grid of 0.5 m cells (0.25 m at the Refined setting). A cell is walkable inside a room, and blocked within half a wall's thickness plus 0.45 of a cell from the wall's centre line. Door openings are cut through the walls, and stairs join the levels in order. For every goal (the outside doors, the stairs down, the next smoke compartment), a distance field is computed with Dijkstra's algorithm on eight neighbours [20]. People move cell to cell down the field, one person per cell. Speed falls with the density in a square of about 2.5 m round each person, v = v₀(1 − 0.266 D)/(1 − 0.266 × 0.54) above 0.54 persons/m² [6]. Doors and stair flights hold tokens that refill at the SFPE specific flow times the effective width, and a person needs a token to pass. Queues therefore form at the right capacity, and a person waiting for help does not hold up those behind. The time step is 0.5 s. In the view, people are grey before they are alerted, yellow while they get ready, and in their group's colour on the move.

### 3.2. Parameters

Table 1. Movement parameters and their sources.

| Parameter | Value | Source |
|---|---|---|
| Door specific flow | 1.32 persons/s/m of effective width | [6] |
| Stair specific flow (7/11) | 1.01 persons/s/m of effective width | [6] |
| Boundary layer | 0.15 m each side | [6] |
| Speed–density relation | v₀(1 − 0.266 D), D > 0.54 persons/m² | [6] |
| Pre-movement | lognormal through the use's 1st and 99th percentiles (office 30–120 s; shop, clinic or assembly 30–180 s; hotel 120–900 s) | after [1], [2]; values to edit |
| Occupant load | by room name, m² per person | [26] |
| Patient preparation (hospital mode) | 29 s helped, 31 s bed, +53 s at the stair for a bed patient | [16], [15], [17] |
| Staff per patient (hospital mode) | 1 helped, 2 for a bed; 1:4 by day, 1:8 at night; at least 2 on a floor with patients | assumption |

### 3.3. Occupant groups

Table 2. Occupant groups. Speeds are mean (SD), truncated to the range shown; pre-movement factors multiply the building use's draw.

| Group | Level speed, m/s | Stair speed, m/s | Pre-movement | Fall chance, level / stair | Source |
|---|---|---|---|---|---|
| Adults | 1.19 (0.2), 0.6–1.6 | 0.92 (0.15) | ×1 | 1.5 % / 0.8 % | [6] |
| Older adults (65+) | 1.0 (0.15), 0.6–1.3 | 0.7 (0.12) | ×1.3 | 4 % / 2 % | scaled after [9]; factors assumed |
| Children | 0.84 (0.25), 0.42–1.36 | 0.48 (0.1) | with their adult | 5 % / 3 % | [10] |
| Walking-aid users | 0.8 (0.15), 0.45–1.1 | 0.35 (0.05) | ×1.2 | 6 % / 3 % | [8]; factors assumed |
| Wheelchair users | 0.69 (0.15), 0.4–1.0 | carried 0.35 | ×1.2 | 0.5 % / – | [8]; descent assumed |
| Hard of hearing | as adults | as adults | ×1, alerted 30 s–2 min late without visual alarm signals | 1.5 % / 0.8 % | assumption |
| Low vision | 0.8 (0.15), 0.45–1.1 | 0.5 (0.1) | ×1.2 | 3 % / 2 % | assumption |
| Cognitive or learning disability | as adults | as adults | ×1.5 | 1.5 % / 0.8 % | assumption |

By default the groups share the occupant load of each floor by the building use. For example, the shop, clinic or assembly use has 57 % adults, 18 % older adults, 12 % children, 6 % walking-aid users, 2 % wheelchair users, 2 % people hard of hearing, 1 % with low vision and 2 % with a cognitive or learning disability. The last three groups follow the advice to plan for people who need help because of their mobility, vision, hearing or cognition; their values are assumptions. The designer can set any number per floor and group, including more people than the occupant load. Children are placed first in rooms that families use, and each walks with an adult of the same room (or the nearest within 15 m) at the slower pace of the two. Above the ground floor, a wheelchair user waits in the stair's refuge for helpers and an evacuation chair: a lognormal wait with a median of 2 min (an assumption), plus about 29 s to transfer [16]. They are then carried down at 0.35 m/s (an assumption), taking two places in the stair flow.

### 3.4. Incidents

These are assumptions to test sensitivity, not measured rates:

- In each run a person may trip, with the chances in Table 2, after walking 3–28 m. They stay down for 5 s to 2 min (median 20 s), and others pass round them.
- A fall on a stair holds that flight for 5–90 s.
- In 15 % of runs one outside door is found blocked.
- Nobody passes through the room of fire origin, except its own occupants and, as a recorded exception, people whose only way out it is.
- In hospital mode, 10 % of staff are held up for 30 s to 2 min, and 3 % of the patients who walk alone trip.

### 3.5. Experiments

Verification (Section 4) uses small synthetic geometries with fixed inputs, each with an analytical answer. Convergence (Section 5) runs a three-storey block of waiting rooms 300 times. The sensitivity studies (Section 6) vary one input at a time. The case study (Section 7) runs the PlotCloud example hospital in the browser, 50 runs per variant. All runs are seeded and can be reproduced exactly.

## 4. Verification

Table 3. Verification tests, after IMO MSC.1/Circ.1533 [23] and the verification categories of [21], [22].

| Test | What it checks | Expected | Measured | Difference |
|---|---|---|---|---|
| V1 | Speed in a corridor, 40 m at 1 m/s (IMO test 1), 0.5 m grid | 39.5 s | 39.5 s | 0 % |
| V1b | The same, 0.25 m grid | 39.5 s | 39.5 s | 0 % |
| V2 | One stair flight at 0.5 m/s (IMO tests 2–3), mean of 200 runs | 14 s | 14.13 s | 0.9 % |
| V3 | 100 people through a 1 m door (IMO test 4) | 0.92 p/s | 0.93 p/s | 0.6 % |
| V3b | Through a 2 m door | 2.24 p/s | 2.25 p/s | 0.3 % |
| V3c | 1 m door, 0.25 m grid | 0.92 p/s | 0.93 p/s | 0.6 % |
| V4a | Pre-movement, office, 1st percentile (IMO test 5) | 30 s | 30.95 s | 3.2 % |
| V4b | Pre-movement, office, median | 60 s | 59.84 s | -0.3 % |
| V4c | Pre-movement, office, 99th percentile | 120 s | 119.18 s | -0.7 % |
| V5 | 20 people round a corner (IMO test 6) | all out | all out | pass |
| V6a | Adult walking speed, mean (IMO test 7) | 1.19 m/s | 1.19 m/s | -0.3 % |
| V6b | Walking-aid speed, mean | 0.8 m/s | 0.82 m/s | 1.9 % |
| V7 | Nearest exit taken, uncongested (IMO test 10) | 6 of 6 | 6 of 6 | pass |
| V8 | An exit found blocked: the other used | 6 of 6 | 6 of 6 | pass |
| V9 | The room of fire origin avoided | longer than 24.54 m | 28.74 m | pass |
| V10 | Three-storey office block, 72 people, against an SFPE hand calculation | 83.34 s | 88 s | 5.6 % |

All 18 tests pass, counting the two grid measurements of Section 5. In V1 the expected time runs to the doorway cells, where the engine counts a person as out. The hand calculation in V10 takes the stair as the controlling component: 48 people from the upper floors at 1.11 persons/s, plus the walk to the stair and from its foot [6]. The engine is 4.7 s slower, the expected direction, since the hand method ignores the time a queue takes to form and the slowing where floors merge.

The tests found five defects, all fixed:

1. On a 0.25 m grid the crowd window of 5 × 5 cells was only 1.56 m², so a lone walker counted as 0.64 persons/m² and slowed by about 3 %. The window is now about 2.5 m square on any grid.
2. En-suite bathrooms were given occupants, and when their patient room was the fire room these people had no way out. En-suites now carry no load, and people whose only way out is through the fire room take it and are reported.
3. An IT room counted as a patient room, leaving one member of staff for a bed patient who needs two. That run never finished and was reported as 0 s. Support rooms are now excluded, and a floor with patients has at least two staff.
4. Door and stair flows used the full clear width with a stair flow of 1.1. They now use the effective width and 1.01, reducing a 1.1 m flight's capacity by about a third.
5. A wheelchair user was given a new refuge wait at every floor of a building with a separate stair object per storey. The wait is now taken once, after which they are carried on down.

## 5. Numerical uncertainty

### 5.1. Grid

Table 4. Walkable width kept of a 2 m corridor with 0.2 m walls on its centre lines (1.8 m clear).

| Grid | Walkable width | Difference |
|---|---|---|
| 0.5 m | 1 m | -44.4 % |
| 0.25 m | 1.5 m | -16.7 % |

Walls must block at least one cell wherever they lie, which costs width on a coarse grid. Door and stair capacities come from tokens, not cells, so flows are unaffected (V3, V3c), but corridors and the crowding in them are modelled narrower than they are. In the example hospital, the 0.25 m grid lowers the hospital-mode median by 3 % (Section 7). The Refined setting now uses the 0.25 m grid.

### 5.2. Number of runs

Table 5. Running statistics over 300 runs of a three-storey block of waiting rooms (96 people, everyone out, alarm at 60 s, incidents on).

| Runs | Mean, s | 90th percentile, s | 95 % CI of the mean, s |
|---|---|---|---|
| 10 | 328.7 | 347.0 | ±13.2 |
| 20 | 337.4 | 371.5 | ±12.0 |
| 50 | 337.7 | 374.0 | ±7.6 |
| 100 | 338.0 | 376.0 | ±6.0 |
| 300 | 336.9 | 383.5 | ±4.0 |

The running mean stays within 1 % from run to run after 20 runs, a simplified form of the criterion in [24]. The 90th percentile, the figure that matters for design, keeps rising until about 50 runs; at 20 runs it is 3 % below its 300-run value. The default is now 50 runs, and 100 for presentation.

## 6. Sensitivity

### 6.1. Incidents

Table 6. Incidents, everyone out, the block of waiting rooms, 100 runs each (legacy population without groups).

| Variant | Median, s | 90th percentile, s |
|---|---|---|
| No incidents | 317.5 | 358.0 |
| Default incidents | 333.0 | 376.0 |
| Falls twice as likely | 340.0 | 379.0 |
| No falls | 331.0 | 374.0 |
| Twice the children | 345.0 | 401.0 |
| A third of people slow (walking aids) | 347.5 | 387.0 |

Incidents add about 5 % to the median and 5 % to the 90th percentile. Doubling the share of children adds 12 % to the 90th percentile over the case without incidents.

### 6.2. Occupant groups

Table 7. Occupant groups, everyone out, the same block, shop, clinic or assembly use, 50 runs each. "Others" is the time the last person who is not a wheelchair user gets out.

| Variant | Median, s | 90th percentile, s | Others out, median, s | Last wheelchair user, median, s |
|---|---|---|---|---|
| Everyone an adult (no groups) | 309.5 | 362.5 | 309.5 | – |
| The use's mix of groups | 468.0 | 569.0 | 355.0 | 468.0 |
| The mix, no incidents | 466.0 | 560.0 | 353.0 | 466.0 |
| Two more wheelchair users on each upper floor | 544.0 | 644.0 | 365.0 | 544.0 |
| The same, helpers at the stair after 4 min instead of 2 | 763.5 | 1096.0 | 365.5 | 763.5 |

The use's mix of groups adds 51 % to the median over a population of adults only. The mix includes wheelchair users on the upper floors, and they set the end: everyone else is out by a median of 355.0 s (15 % more than the adults-only case, from slower walking, longer pre-movement and children paired with adults), while the last wheelchair user, carried down the stair after waiting for help, is out at 468.0 s. With two more wheelchair users on each upper floor the end moves to 544.0 s. If help reaches the stair after 4 min instead of 2, that becomes 763.5 s. For a building with wheelchair users above the ground floor, the arrangements for assisted descent, not the exit widths, set the total time.

### 6.3. Hospital staffing and preparation

Table 8. Hospital mode on a three-storey ward block, horizontal then down, 50 runs each.

| Variant | Median, min | 90th percentile, min | Horizontal stage, median, min |
|---|---|---|---|
| Day staffing 1:4, preparation times on | 17.6 | 22.7 | 3.7 |
| Day staffing, no preparation times (the model before) | 14.9 | 17.9 | 3.1 |
| Night staffing 1:8 | 29.7 | 41.6 | 4.9 |
| More dependent patients (20 % walk, 40 % helped, 40 % bed) | 23.4 | 29.1 | 3.6 |
| No incidents | 18.1 | 23.0 | 3.6 |

Night staffing adds 69 % to the median, and the preparation times, left out of earlier versions, add 18 %.

## 7. Case study: the PlotCloud example hospital

The example is a generic three-storey inpatient building of about 61 × 27 m, with an entrance and clinics on the ground floor and two inpatient units above (52 single patient rooms). Each inpatient floor has two smoke compartments separated by cross-corridor doors, and two exit stairs with 1.65 m flights serve every floor, entered at the ends of both corridors. Its means of egress meets every check of the software's Ontario Building Code screening (Section 10). Before that screening, the stairs had 1.4 m flights and were entered 8 m in from the corridors' ends, leaving dead-end corridors; both were corrected. In each run the fire starts in a random compartment with patients (hospital mode) or a random occupied room (everyone out).

![Fig. 1. Routes of the run nearest the median in the example hospital, hospital mode: each route shaded by when that person reached safety (lighter sooner, darker later); stairs outlined and labelled, exits in green, smoke doors in orange.](img/research/evacuation-routes.jpg?v=20261110-2)

Table 9. Hospital mode, horizontal then down, 50 runs each.

| Variant | Patients · staff | 10th %, min | Median, min | 90th %, min | Horizontal stage, min |
|---|---|---|---|---|---|
| Day staffing 1:4 | 52 · 14 | 12.7 | 15.7 | 21.4 | 4.5 |
| Night staffing 1:8 | 52 · 8 | 17.5 | 22.4 | 34.0 | 5.2 |
| Day, no preparation times | 52 · 14 | 10.5 | 13.1 | 16.4 | 4.0 |
| Day, no incidents | 52 · 14 | 13.0 | 15.8 | 21.7 | 4.5 |
| Day, 0.25 m grid | 52 · 14 | 12.6 | 15.3 | 20.6 | 4.4 |

Table 10. Everyone out, clinic use (shop, clinic or assembly), 50 runs each. People by group: 138 adults, 45 older adults, 30 children, 15 walking-aid users, 5 wheelchair users.

| Variant | 10th %, min | Median, min | 90th %, min | Incidents per run |
|---|---|---|---|---|
| Clinic use, alarm 60 s | 6.3 | 7.3 | 9.1 | 7.2 |
| Clinic use, alarm 60 s, no incidents | 6.4 | 7.6 | 9.7 | 0 |
| Clinic use, alarm 60 s, 0.25 m grid | 6.4 | 7.3 | 9.8 | 6.6 |
| Clinic use, alarm 3 min | 8.4 | 9.3 | 10.7 | 7.1 |
| Clinic use, everyone an adult (no groups) | 4.5 | 5.2 | 5.7 | 0 |

What a design team would take from this case:

- Horizontal relocation clears the fire compartment in about 4.5 minutes by day. That is the figure to compare with the time a compartment can be held, and it is far shorter than full evacuation.
- Full vertical evacuation takes 15.7 minutes by day (90th percentile 21.4) and 22.4 at night (90th percentile 34.0). The night shift, not the stair width, is the constraint. This argues for planning around horizontal relocation and staff deployment rather than more stair capacity.
- For everyone out, a realistic mix of people raises the median from 5.2 to 7.3 min. In the run shown, the 5 wheelchair users, waiting at the stairs for assisted descent, are the last out: 7.3 min, against 5.3 min for everyone else.
- An alarm at 3 minutes instead of 60 s moves the median by 2.0 min. Detection and staff response are worth more here than wider exits.

## 8. Discussion: how accurate is it?

The errors are of three kinds, and of different sizes:

- Numerical, meaning whether the code does what its equations say: 0–3 % for speeds, flows and pre-movement, and 5.6 % against a building-scale hand calculation. This is the only kind this study measures directly.
- Discretisation: up to 3 % in the hospital case on the 0.5 m grid, mainly because corridors are narrowed.
- Input uncertainty: 20–69 % for staffing and preparation in hospitals, 40 % for the occupant mix, and several minutes for the assumed wait before assisted descent. This is by far the largest.

How far the predictions lie from real evacuations is unknown until they are compared with measured drills, as TN 1822 and ISO 20414 require for validation [21], [22]. The results should therefore be read comparatively: option A against option B, day against night, one stair against two, under the same stated assumptions. They are not a forecast of the minutes a real evacuation will take, not an RSET for a fire engineering submission without a qualified engineer's review, and not evidence of code compliance.

## 9. Limitations

- There is no fire or smoke model and no ASET. Lifts are not used.
- Older adults' pre-movement, the wait for assisted descent, the carried descent speed and all incident rates are assumptions.
- There is no counterflow and no behaviour beyond parent–child pairs and hospital staff. People take the shortest available route.
- Stairs are queues with a travel time, the flight length taken as 1.75 times the rise.
- The 0.5 m grid narrows corridors.
- No empirical validation has been done.

## 10. Implications for the software

The following changes were made as a result of this study:

- Door and stair flows now use effective widths and the SFPE 7/11 values.
- Five occupant groups, with their speeds, reaction factors and fall chances, can be set per floor.
- Wheelchair users wait at a refuge for assisted descent.
- The density window has a fixed area on any grid.
- En-suites carry no occupant load, support rooms are not patient rooms, and each floor with patients has at least two staff.
- In hospital mode, patients take preparation time before an assisted move.
- A room whose only way out is through the fire room is reported.
- People are shown grey until alerted and yellow while getting ready, and the results chart has a line for each group.
- Escape routes are drawn from every starting room, down the stairs and out of the door to an assembly point outside. Main routes are solid with direction chevrons and alternatives dashed. The fire origin, an assumed smoke zone and blocked exits each have their own pattern and symbol, not only a colour. Queues appear as numbered badges during playback, and route cards give people, distance, estimated time, the narrowest point, queueing, smoke and the alternative for each route.
- Scenarios (as set, an assumed smoke zone, the main exit blocked) can be compared side by side with the same people and seeds. Everyone out warns when the model has patient rooms, since it treats every occupant as able to leave on their own.
- The Refined setting uses a 0.25 m grid, and the default is 50 runs.
- A code-check mode screens the model's means of egress against the Ontario Building Code 2024, Part 3: number of exits, travel distance, distance between exits, exit width for the occupant load, minimum widths of exit doors and stairs, corridor widths, doorways for beds and dead-end corridors. It is a screening for the design team, not a compliance determination.
- An available safe escape time (ASET) can be entered, or read from an FDS device file at a tenability threshold, and is compared with the evacuation time.
- Drill records can be loaded and compared with the runs, which supports the validation this article calls for. A protocol describes what to record.
- A brief for the fire engineer can be downloaded, with the inputs, sources, results, ASET, drill comparison, code check, limitations and a review block.

## 11. Conclusions

The engine reproduces the hydraulic values it is built on and passes component tests after IMO MSC.1/Circ.1533. Its numerical error is small beside the uncertainty in the people it models. For architects, the practical lessons match the literature. In care buildings, evacuation time is set mostly by staff, patient dependency and assisted descent, and by detection and pre-movement, more than by exit width. The next step is validation against recorded drills, particularly hospital drills with timed patient movements.

## CRediT authorship contribution statement

PlotCloud Studio: Conceptualization, Methodology, Software, Validation, Formal analysis, Writing – original draft. The software and this text were developed with AI assistance (Claude, Anthropic). Human subject-matter review is pending.

## Declaration of competing interest

The authors develop PlotCloud, the software evaluated in this article. No external funding was received.

## Data availability

The engine, test scripts and results are public: [engine source](https://github.com/plotcloudstudio/plotcloud/blob/main/mvp/js/interior/egress.js), [verification and sensitivity script](https://github.com/plotcloudstudio/plotcloud/blob/main/tests/validation/egress-verification.mjs), [hospital case script](https://github.com/plotcloudstudio/plotcloud/blob/main/tests/validation/egress-hospital-case.cjs), [verification results (JSON)](research/egress-verification.json), [hospital case results (JSON)](research/egress-hospital-case.json), [this article as text](research/fire-evacuation-accuracy.md). All runs are seeded and reproducible.

## Acknowledgements

None.

## References

1. BSI, PD 7974-6:2019. The application of fire safety engineering principles to fire safety design of buildings. Part 6: Human factors: Life safety strategies. Occupant evacuation, behaviour and condition (Sub-system 6), British Standards Institution, London, 2019.
2. D.A. Purser, M. Bensilum, Quantification of behaviour for engineering design standards and escape time calculations, Saf. Sci. 38 (2001) 157–182.
3. J.J. Fruin, Pedestrian Planning and Design, Metropolitan Association of Urban Designers and Environmental Planners, New York, 1971.
4. V.M. Predtechenskii, A.I. Milinskii, Planning for Foot Traffic Flow in Buildings, Amerind Publishing, New Delhi, 1978.
5. U. Weidmann, Transporttechnik der Fussgänger, Schriftenreihe des IVT Nr. 90, ETH Zürich, 1993.
6. S.M.V. Gwynne, E.R. Rosenbaum, Employing the hydraulic model in assessing emergency movement, in: M.J. Hurley (Ed.), SFPE Handbook of Fire Protection Engineering, 5th ed., Springer, New York, 2016.
7. G. Proulx, Evacuation time and movement in apartment buildings, Fire Saf. J. 24 (1995) 229–246.
8. K.E. Boyce, T.J. Shields, G.W.H. Silcock, Toward the characterization of building occupancies for fire safety engineering: capabilities of disabled people moving horizontally and on an incline, Fire Technol. 35 (1999) 51–67.
9. R.L. Knoblauch, M.T. Pietrucha, M. Nitzburg, Field studies of pedestrian walking speed and start-up time, Transp. Res. Rec. 1538 (1996) 27–38.
10. A.R. Larusdottir, A.S. Dederichs, A step towards including children's evacuation parameters and behavior in fire safe building design, Fire Saf. Sci. 10 (2011) 187–195. [doi:10.3801/IAFSS.FSS.10-187](https://doi.org/10.3801/IAFSS.FSS.10-187)
11. A.R. Larusdottir, A.S. Dederichs, Evacuation of children: movement on stairs and on horizontal plane, Fire Technol. 48 (2012) 43–53.
12. Department of Health, Health Technical Memorandum 05-02: Firecode. Guidance in support of functional provisions (fire safety in the design of healthcare premises), London, 2015.
13. CSA Group, CSA Z8000-18, Canadian health care facilities, Toronto, 2018.
14. NFPA, NFPA 101, Life Safety Code, chapters on new and existing health care occupancies, National Fire Protection Association, Quincy, MA (current edition).
15. A. Hunt, E.R. Galea, P.J. Lawrence, An analysis and numerical simulation of the performance of trained hospital staff using movement assist devices to evacuate people with reduced mobility, Fire Mater. 39 (2015) 407–429. [doi:10.1002/fam.2215](https://doi.org/10.1002/fam.2215)
16. M.S. Joyce, P.J. Lawrence, E.R. Galea, Hospital Evacuation Planning Tool for Assistance Devices (HEPTAD), Fire Mater. (2020). [doi:10.1002/fam.2856](https://doi.org/10.1002/fam.2856)
17. P. Hoondert, B. Peters, New design approach for fire safe hospital wards, in: Interflam 2019, Interscience Communications, Egham, 2019, pp. 597–608 (as cited in Joyce et al. 2020).
18. E.D. Kuligowski, R.D. Peacock, B.L. Hoskins, A Review of Building Evacuation Models, 2nd ed., NIST Technical Note 1680, National Institute of Standards and Technology, Gaithersburg, MD, 2010.
19. D. Helbing, P. Molnár, Social force model for pedestrian dynamics, Phys. Rev. E 51 (1995) 4282–4286.
20. E.W. Dijkstra, A note on two problems in connexion with graphs, Numer. Math. 1 (1959) 269–271.
21. E. Ronchi, E.D. Kuligowski, P.A. Reneke, R.D. Peacock, D. Nilsson, The Process of Verification and Validation of Building Fire Evacuation Models, NIST Technical Note 1822, National Institute of Standards and Technology, Gaithersburg, MD, 2013.
22. ISO, ISO 20414:2020. Fire safety engineering. Verification and validation protocol for building fire evacuation models, International Organization for Standardization, Geneva, 2020.
23. IMO, MSC.1/Circ.1533. Revised guidelines on evacuation analysis for new and existing passenger ships, International Maritime Organization, London, 2016.
24. E. Ronchi, P.A. Reneke, R.D. Peacock, A method for the analysis of behavioural uncertainty in evacuation modelling, Fire Technol. 50 (2014) 1545–1571. [doi:10.1007/s10694-013-0352-7](https://doi.org/10.1007/s10694-013-0352-7)
25. E. Smedberg, E. Ronchi, M.J. Kinsey, Multifactor variance assessment for determining the number of repeat simulation runs in evacuation modelling, Fire Technol. 57 (2021).
26. ICC, International Building Code 2021, Table 1004.5, Maximum floor area allowances per occupant, International Code Council, Washington, DC, 2021.
